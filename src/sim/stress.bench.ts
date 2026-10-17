import { test } from 'vitest';
import { TUNING } from '../data/content';
import { createSeededRng } from './rng';
import { setupStress, topUpStress } from './stress';
import type { World } from './types';
import { createWorld, step } from './world';

// Sim-only cost of one 60 Hz step in the stress scenario (no rendering).
// Budget: the sim should stay well under 16.7 ms per frame; aim for < 4 ms.
// Run with `npm run bench` (Vitest 5: `bench` is a test-context fixture).

function stressWorld(): World {
  const world = createWorld({ rng: createSeededRng(99), spawnRadius: 800 });
  setupStress(world);
  // Warm up so projectiles, gems and the pool reach a steady state.
  for (let i = 0; i < 300; i++) {
    topUpStress(world);
    step(world, { moveX: 1, moveY: 0 }, TUNING.stepSeconds);
  }
  return world;
}

test('stress: 500 enemies + maxed build', async ({ bench }) => {
  const world = stressWorld();
  let frame = 0;
  await bench('one sim step', () => {
    topUpStress(world);
    // Walk in a slow circle so the horde keeps moving.
    const a = (frame++ / 240) * Math.PI * 2;
    step(world, { moveX: Math.cos(a), moveY: Math.sin(a) }, TUNING.stepSeconds);
  }).run();
});
