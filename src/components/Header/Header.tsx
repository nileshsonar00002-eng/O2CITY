import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { DataStatus } from '../../types/aqi';

interface HeaderProps {
  dataStatus: DataStatus;
}

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/map', label: 'Map' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/about', label: 'About' },
  { to: '/help', label: 'Help' },
] as const;

export function Header({ dataStatus }: HeaderProps) {
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [isWide, setIsWide] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sync popover attribute and wide/collapsed state via ResizeObserver (no hardcoded breakpoint)
  useEffect(() => {
    const header = headerRef.current;
    const inner = innerRef.current;
    const menu = menuRef.current;
    if (!header || !inner || !menu) return;

    let lastHeaderWidth = header.clientWidth;

    const measure = () => {
      const wasOpen = menu.matches(':popover-open') || menu.classList.contains(':popover-open');
      header.classList.add('is-measuring');
      header.classList.add('is-wide');
      menu.removeAttribute('popover');

      const fits = inner.scrollWidth <= inner.clientWidth + 1;
      setIsWide(fits);

      if (fits) {
        header.classList.add('is-wide');
        menu.removeAttribute('popover');
        setMenuOpen(false);
      } else {
        header.classList.remove('is-wide');
        menu.setAttribute('popover', 'auto');
        if (wasOpen) {
          try {
            menu.showPopover();
          } catch {
            // Ignore if already open or unsupported
          }
        }
      }

      requestAnimationFrame(() => {
        header.classList.remove('is-measuring');
      });
    };

    measure();

    const observer = new ResizeObserver(() => {
      const currentWidth = header.clientWidth;
      if (header.classList.contains('is-wide') || currentWidth > lastHeaderWidth) {
        measure();
      }
      lastHeaderWidth = currentWidth;
    });

    observer.observe(header);
    observer.observe(menu);

    const handleToggle = (event: Event) => {
      const toggleEvent = event as ToggleEvent;
      setMenuOpen(toggleEvent.newState === 'open');
    };
    menu.addEventListener('toggle', handleToggle);

    return () => {
      observer.disconnect();
      menu.removeEventListener('toggle', handleToggle);
    };
  }, []);

  // Close mobile popover on route change
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu || isWide) return;
    if (menu.matches(':popover-open')) {
      try {
        menu.hidePopover();
      } catch {
        // Ignore
      }
    }
  }, [location.pathname, isWide]);

  const statusConfig =
    dataStatus === 'live'
      ? {
          dot: 'bg-emerald-500',
          ping: 'bg-emerald-400',
          text: 'Live Data',
          pill: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
        }
      : dataStatus === 'delayed'
        ? {
            dot: 'bg-amber-500',
            ping: 'bg-amber-400',
            text: 'Delayed Data',
            pill: 'bg-amber-50 text-amber-800 border-amber-200/80',
          }
        : {
            dot: 'bg-slate-400',
            ping: 'bg-slate-300',
            text: 'Awaiting Data',
            pill: 'bg-slate-100 text-slate-700 border-slate-200',
          };

  return (
    <header
      ref={headerRef}
      className="site-header is-wide sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md"
    >
      <div
        ref={innerRef}
        className="header-inner mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <Link
          to="/"
          className="group flex items-center gap-3 rounded-lg py-1 pr-2 text-left"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 shadow-sm ring-1 ring-slate-900/10">
            <span className="h-4 w-4 rounded-full border-2 border-emerald-400 bg-emerald-400/20" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              O2CITY
            </span>
            <span className="mt-0.5 text-[11px] font-medium tracking-wide text-slate-500">
              Know Your Air. Live Better.
            </span>
          </span>
        </Link>

        <nav className="site-nav flex items-center gap-4" aria-label="Primary">
          <ul
            ref={menuRef}
            id="o2-site-menu"
            className="site-menu rounded-2xl border border-slate-200 bg-white p-2 shadow-lg lg:shadow-none"
          >
            {NAV_ITEMS.map((item) => {
              const isCurrent = location.pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`block rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                      isCurrent
                        ? 'bg-emerald-50 font-semibold text-emerald-800 underline decoration-emerald-500 decoration-2 underline-offset-4'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div
            className={`hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium sm:inline-flex ${statusConfig.pill}`}
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {dataStatus === 'live' && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 motion-reduce:hidden ${statusConfig.ping}`}
                />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${statusConfig.dot}`} />
            </span>
            <span>{statusConfig.text}</span>
          </div>

          <button
            type="button"
            className="menu-button inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
            popoverTarget="o2-site-menu"
            popoverTargetAction="toggle"
            aria-controls="o2-site-menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
