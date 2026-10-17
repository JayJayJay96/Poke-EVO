import { writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { POKEMON, type PokemonId } from '../data/content';
import { playLine } from './balance';

// Early-vs-late gamble report (§5): DPS and effective HP per line at ~5, ~9 and ~15 min,
// averaged over a few seeds. Run with `npm run balance` (slow: full 15-min runs).
// Bench mode hides console output, so the table goes to balance-report.md (gitignored).
// Target (provisional): Lapras ahead at 5 min, level by ~9, behind the 3-stage lines at 15.

const SEEDS = [1, 2, 3, 4];
/** Just before 15:00: the run ends at 900 s. */
const CHECKPOINTS = [300, 540, 890];

test('early-vs-late gamble', { timeout: 30 * 60_000 }, () => {
  const rows: Record<string, string | number>[] = [];
  for (const id of Object.keys(POKEMON) as PokemonId[]) {
    const runs = SEEDS.map((seed) => playLine(id, seed, CHECKPOINTS));
    CHECKPOINTS.forEach((time, i) => {
      const at = runs.map((r) => r[i]!);
      const avg = (f: (c: (typeof at)[number]) => number) => at.reduce((s, c) => s + f(c), 0) / at.length;
      rows.push({
        line: id,
        min: Math.round(time / 60),
        level: Math.round(avg((c) => c.level)),
        form: at[0]!.form,
        dps: Math.round(avg((c) => c.dps)),
        ehp: Math.round(avg((c) => c.effectiveHp)),
      });
    });
  }
  const cols = Object.keys(rows[0]!);
  const table = [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`]
    .concat(rows.map((r) => `| ${cols.map((c) => r[c]).join(' | ')} |`))
    .join('\n');
  writeFileSync('balance-report.md', `# Gamble balance (seeds ${SEEDS.join(', ')})\n\n${table}\n`);
});
