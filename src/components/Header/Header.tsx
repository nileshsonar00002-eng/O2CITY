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

export function Header({ dataStatus: _dataStatus }: HeaderProps) {
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

  return (
    <header
      ref={headerRef}
      className="site-header is-wide sticky top-0 z-40 border-b border-slate-200/60 bg-white/85 shadow-[0_1px_12px_-4px_rgba(15,23,42,0.06)] backdrop-blur-xl"
    >
      <div
        ref={innerRef}
        className="header-inner mx-auto flex h-[70px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8"
      >
        <Link
          to="/"
          className="group flex items-center gap-2.5 rounded-lg py-1 pr-2 text-left"
        >
          <svg
            viewBox="0 0 64 54"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-9 w-11 shrink-0"
            aria-hidden="true"
          >
            {/* Outer O ring */}
            <circle
              cx="25"
              cy="25"
              r="17"
              stroke="#0F172A"
              strokeWidth="7.5"
            />
            {/* Green inner breath arc */}
            <path
              d="M14.5 26.5A10.5 10.5 0 0 0 32.5 32.5"
              stroke="#16A34A"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* White cutout halo for interlocking 2 */}
            <path
              d="M31.5 27.5C31.5 21.5 36.2 17.5 42.2 17.5C48.2 17.5 52.5 21.2 52.5 26.5C52.5 31.2 49.2 34.4 42.5 39.2L35.5 44.2H53.5"
              stroke="#FFFFFF"
              strokeWidth="10.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            {/* Interlocking 2 */}
            <path
              d="M31.5 27.5C31.5 21.5 36.2 17.5 42.2 17.5C48.2 17.5 52.5 21.2 52.5 26.5C52.5 31.2 49.2 34.4 42.5 39.2L35.5 44.2H53.5"
              stroke="#0F172A"
              strokeWidth="6.2"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </svg>
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              O2CITY
            </span>
            <span className="mt-0.5 text-[11px] font-medium tracking-wide text-slate-500">
              Know Your Air. Live Better.
            </span>
          </span>
        </Link>

        <nav className="site-nav flex items-center gap-5" aria-label="Primary">
          <ul
            ref={menuRef}
            id="o2-site-menu"
            className="site-menu rounded-2xl border border-slate-200/80 bg-white p-2 shadow-lg lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
          >
            {NAV_ITEMS.map((item) => {
              const isCurrent = location.pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`relative block rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                      isCurrent
                        ? 'bg-emerald-50/90 font-semibold text-emerald-700 ring-1 ring-emerald-200/70'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

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
