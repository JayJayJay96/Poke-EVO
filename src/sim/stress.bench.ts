import { test } from 'vitest';
import { TUNING, type PokemonId } from '../data/content';
import { createSeededRng } from './rng';
import { STRESS_MUTATION_BUILDS, setupMutationStress, setupStress, topUpStress } from './stress';
import type { World } from './types';
import { createWorld, step } from './world';

// Sim-only cost of one 60 Hz step in the stress scenario (no rendering).
// Budget: the sim should stay well under 16.7 ms per frame; aim for < 4 ms.
// Run with `npm run bench` (Vitest 5: `bench` is a test-context fixture).

function warmUp(world: World): World {
  // Warm up so projectiles, gems and the pool reach a steady state.
  for (let i = 0; i < 300; i++) {
    topUpStress(world);
    step(world, { moveX: 1, moveY: 0 }, TUNING.stepSeconds);
  }
  return world;
}

function stressWorld(): World {
  const world = createWorld({ rng: createSeededRng(99), spawnRadius: 800 });
  setupStress(world);
  return warmUp(world);
}

/** One step, walking in a slow circle so the horde keeps moving. */
function stepper(world: World): () => void {
  let frame = 0;
  return () => {
    topUpStress(world);
    const a = (frame++ / 240) * Math.PI * 2;
    step(world, { moveX: Math.cos(a), moveY: Math.sin(a) }, TUNING.stepSeconds);
  };
}

test('stress: 500 enemies + maxed build', async ({ bench }) => {
  await bench('one sim step', stepper(stressWorld())).run();
});

// D47: the same, on a map where every chunk is woods (the densest biome).
test('stress: 500 enemies + maxed build + dense obstacles', async ({ bench }) => {
  const world = createWorld({ rng: createSeededRng(99), spawnRadius: 800, obstacleDensity: 1 });
  world.map.forceBiome = 'woods';
  setupStress(world);
  await bench('one sim step (dense obstacles)', stepper(warmUp(world))).run();
});

// P4f-8: the same horde against each line's final stage with a Mutation on every move.
for (const pokemonId of Object.keys(STRESS_MUTATION_BUILDS) as PokemonId[]) {
  test(`stress: 500 enemies + maxed Mutations (${pokemonId})`, async ({ bench }) => {
    const world = createWorld({ rng: createSeededRng(99), pokemonId, spawnRadius: 800 });
    setupMutationStress(world);
    await bench(`one sim step (${pokemonId} Mutations)`, stepper(warmUp(world))).run();
  });
}
