import { writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { POKEMON, type PokemonId } from '../data/content';
import { playLine } from './balance';

// Early-vs-late gamble report (§5): DPS and effective HP per line at ~5, ~9 and ~15 min,
// averaged over a few seeds. Run with `npm run balance` (slow: full 15-min runs).
// Bench mode hides console output, so the table goes to balance-report.md (gitignored).
// Target (§5, D19): Lapras ahead at 5 min, level by ~9; at 15 every 3-stage final form above Raichu and
// Lapras, which are within ~10% of each other. D21 judges it without Mutations (`dps`); P4h-9 adds the
// site-taking bot (walks to sites, random cards); D25 makes `site dps` the D19 reference.

// 8 seeds: random card picks are noisy (P4f plan).
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
// The D19 reference (site dps) uses 24: with 8, one seed's spread (up to ~5×) leaves the mean only good to
// about ±15%, wider than D19's 10% margins (2026-10-23 balance pass). ~6 min more per report.
const SITE_SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
/** Just before 15:00: the run ends at 900 s. */
const CHECKPOINTS = [300, 540, 890];

test('early-vs-late gamble', { timeout: 120 * 60_000 }, () => {
  const rows: Record<string, string | number>[] = [];
  for (const id of Object.keys(POKEMON) as PokemonId[]) {
    const runs = SEEDS.map((seed) => playLine(id, seed, CHECKPOINTS));
    const siteRuns = SITE_SEEDS.map((seed) => playLine(id, seed, CHECKPOINTS, { sites: true }));
    CHECKPOINTS.forEach((time, i) => {
      const at = runs.map((r) => r[i]!);
      const siteAt = siteRuns.map((r) => r[i]!);
      const avg = (f: (c: (typeof at)[number]) => number, of = at) => of.reduce((s, c) => s + f(c), 0) / of.length;
      // Sum of Mutation ranks held (a rank-III Mutation counts 3).
      const ranks = (c: (typeof at)[number]) => c.mutations.split(' ').filter(Boolean).reduce((s, m) => s + Number(m.at(-1)), 0);
      rows.push({
        line: id,
        min: Math.round(time / 60),
        level: Math.round(avg((c) => c.level)),
        form: at[0]!.form,
        dps: Math.round(avg((c) => c.dps)),
        ehp: Math.round(avg((c) => c.effectiveHp)),
        'site dps': Math.round(avg((c) => c.dps, siteAt)),
        // Standard error of that mean: two lines closer than ~2 s.e. aren't really ordered.
        's.e.': Math.round(
          Math.sqrt(
            siteAt.reduce((s, c) => s + (c.dps - avg((x) => x.dps, siteAt)) ** 2, 0) / (siteAt.length - 1) / siteAt.length,
          ),
        ),
        'site level': Math.round(avg((c) => c.level, siteAt)),
        sites: avg((c) => c.sites, siteAt).toFixed(1),
        'mutation ranks': avg(ranks, siteAt).toFixed(1),
        surges: avg((c) => c.surges, siteAt).toFixed(1),
      });
    });
  }
  const cols = Object.keys(rows[0]!);
  const table = [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`]
    .concat(rows.map((r) => `| ${cols.map((c) => r[c]).join(' | ')} |`))
    .join('\n');
  const caveat =
    'The bot is invulnerable and never at low HP: Shell, Blaze and hit-taken / low-HP effects never fire. ' +
    'Full-HP and movement effects (Bloom, Charge) do, so those lines read high.';
  const seeds = `seeds 1–${SEEDS.length}; site columns 1–${SITE_SEEDS.length}`;
  writeFileSync('balance-report.md', `# Gamble balance (${seeds})\n\n${caveat}\n\n${table}\n`);
});
