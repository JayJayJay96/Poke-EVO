import { describe, expect, it } from 'vitest';
import { NO_HIT, damageEnemy } from './combat';
import { createSeededRng } from './rng';
import { createWorld, spawnEnemy } from './world';

// Pause screen numbers (2026-10-24): total damage and each move's share.
describe('damage counters', () => {
  it("count every hit in the total and a move's own hits on the move", () => {
    const world = createWorld({ rng: createSeededRng(1), spawnRadius: 600, spawnEnabled: false, pokemonId: 'charmander' });
    const slot = world.moves[0]!;
    const enemy = spawnEnemy(world, 'raticate', 900, 0);
    const own = damageEnemy(world, enemy, 5, { ...NO_HIT, slot, attackType: null });
    const other = damageEnemy(world, enemy, 3); // a status tick or proc: no slot
    expect(slot.damageDealt).toBeCloseTo(own);
    expect(world.damageDealt).toBeCloseTo(own + other);
  });
});
