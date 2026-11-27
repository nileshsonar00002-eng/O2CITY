import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

// Allow Node's native TS runner to resolve Vercel-style `.js` imports to `.ts` files in `api/`.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.js') && context.parentURL?.includes('/api/')) {
      const tsUrl = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
      if (existsSync(fileURLToPath(tsUrl))) {
        return nextResolve(tsUrl.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { computeUtcHourBucket, DatabaseIngestError } = await import('../api/_lib/ingestService.ts');

describe('computeUtcHourBucket', () => {
  it('truncates UTC ISO timestamps to the start of the UTC hour', () => {
    assert.equal(
      computeUtcHourBucket('2026-11-27T07:42:19.832Z'),
      '2026-11-27T07:00:00.000Z'
    );
    assert.equal(
      computeUtcHourBucket('2026-11-27T07:00:00.000Z'),
      '2026-11-27T07:00:00.000Z'
    );
  });

  it('converts timezone-offset timestamps (e.g. IST +05:30) to UTC before truncating', () => {
    // 13:45:00+05:30 === 08:15:00Z -> 08:00:00.000Z
    assert.equal(
      computeUtcHourBucket('2026-11-27T13:45:00+05:30'),
      '2026-11-27T08:00:00.000Z'
    );
    // 01:10:00+05:30 === previous day 19:40:00Z -> 19:00:00.000Z
    assert.equal(
      computeUtcHourBucket('2026-11-27T01:10:00+05:30'),
      '2026-11-26T19:00:00.000Z'
    );
  });

  it('throws DatabaseIngestError for invalid fetchedAt timestamps', () => {
    assert.throws(
      () => computeUtcHourBucket('not-a-timestamp'),
      (err: unknown) =>
        err instanceof DatabaseIngestError && err.code === 'INVALID_FETCHED_AT'
    );
  });
});
