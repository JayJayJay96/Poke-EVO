import { expect, it } from 'vitest';
import { measureDps } from './balance';
import { gainXp, xpToNext } from './progression';
import { createSeededRng } from './rng';
import type { World } from './types';
import { createWorld } from './world';

/** Charmander with 4 banked level-ups: the bank auto-opens its card window on the next step (D39). */
function banked(): World {
  const w = createWorld({ rng: createSeededRng(3), pokemonId: 'charmander', spawnEnabled: false });
  let xp = 0;
  for (let level = 1; level < 5; level++) xp += xpToNext(level);
  gainXp(w, xp);
  return w;
}

it('measureDps closes a window that opens mid-measurement instead of freezing at ~0 DPS', () => {
  const frozen = measureDps(banked());
  const w = banked();
  const resolved = measureDps(w, undefined, () => {
    w.offer = null;
    w.pendingLevelUps = 0;
  });
  expect(frozen).toBeLessThan(1);
  expect(resolved).toBeGreaterThan(5);
});
