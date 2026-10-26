import { expect, it } from 'vitest';
import { TUNING } from '../data/content';
import { measureDps, steer } from './balance';
import { cellsOf, chunkKey, generateChunk } from './map';
import { gainXp, xpToNext } from './progression';
import { createSeededRng } from './rng';
import type { World } from './types';
import { createWorld, step } from './world';

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

it('the bot steers round water and obstacle pairs to reach where it is heading (D47 map)', () => {
  const reach = (steered: boolean): number => {
    const w = createWorld({ rng: createSeededRng(1), pokemonId: 'charmander', spawnEnabled: false, mapSeed: 1, obstacleDensity: 1 });
    w.moves = [];
    // A stream x −100…100, y −300…300 with a tree pair beside it, between the bot and its goal.
    const rows = ['..........', '..........', '....ww....', '....ww....', '...Tww....', '...Tww....', '....ww....', '....ww....', '..........', '..........'];
    const chunk = generateChunk(1, 0, 0);
    const cells = cellsOf(rows);
    const own = [{ x: -150, y: -50, radius: 45, kind: 'tree' as const }, { x: -150, y: 50, radius: 45, kind: 'tree' as const }];
    w.map.chunks.set(chunkKey(0, 0), { ...chunk, tiles: rows, own, near: own, slots: [], cells, water: true, patches: null, ledges: [], nearLedges: null });
    w.player.x = -350;
    w.player.y = 0;
    const goal = { x: 350, y: 0 };
    const state = { side: 0 };
    let closest = Infinity;
    for (let i = 0; i < 12 / TUNING.stepSeconds; i++) {
      const d = Math.hypot(goal.x - w.player.x, goal.y - w.player.y) || 1;
      const dx = (goal.x - w.player.x) / d;
      const dy = (goal.y - w.player.y) / d;
      const [mx, my] = steered ? steer(w, dx, dy, state) : [dx, dy];
      step(w, { moveX: mx, moveY: my }, TUNING.stepSeconds);
      closest = Math.min(closest, Math.hypot(goal.x - w.player.x, goal.y - w.player.y));
    }
    return closest;
  };
  expect(reach(false)).toBeGreaterThan(300); // straight at it: stuck on the near shore
  expect(reach(true)).toBeLessThan(20);
});
