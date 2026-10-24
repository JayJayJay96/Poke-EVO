import { describe, expect, it } from 'vitest';
import { TUNING } from '../data/content';
import { maybeDropBerry, maybeDropMagnet } from './combat';
import { createSeededRng } from './rng';
import type { InputState, World } from './types';
import { createWorld, step } from './world';

// Berries and Magnets (owner 2026-10-24): own caps, expiry, magnets pull berries.
const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

function makeWorld(): World {
  return createWorld({ rng: createSeededRng(3), spawnRadius: 500, spawnEnabled: false, pokemonId: 'charmander' });
}

function run(world: World, seconds: number): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) step(world, IDLE, DT);
}

const onGround = (world: World, kind: 'oran' | 'magnet') => world.berries.filter((b) => b.kind === kind && !b.collected).length;

describe('drops', () => {
  it('a full berry budget no longer blocks magnets; magnets have their own cap', () => {
    const world = makeWorld();
    for (let i = 0; i < TUNING.heal.maxBerries; i++) maybeDropBerry(world, 2000 + i, 0, 1);
    expect(onGround(world, 'oran')).toBe(TUNING.heal.maxBerries);
    for (let i = 0; i < 2000; i++) maybeDropMagnet(world, 3000, 0);
    expect(onGround(world, 'magnet')).toBe(TUNING.magnet.maxMagnets);
  });

  it('untouched drops expire, freeing the budget', () => {
    const world = makeWorld();
    for (let i = 0; i < TUNING.heal.maxBerries; i++) maybeDropBerry(world, 2000 + i, 0, 1);
    maybeDropBerry(world, 0, 2000, 1);
    expect(onGround(world, 'oran')).toBe(TUNING.heal.maxBerries); // full: nothing new
    run(world, TUNING.heal.dropLifetimeSeconds + 0.1);
    expect(world.berries).toHaveLength(0);
    maybeDropBerry(world, 0, 2000, 1);
    expect(onGround(world, 'oran')).toBe(1);
  });

  it('a Magnet pulls Oran Berries within screen range, and they heal on arrival', () => {
    const world = makeWorld();
    world.player.hp = 40;
    world.berries.push({ id: world.nextId++, kind: 'oran', x: 300, y: 0, collected: false });
    world.berries.push({ id: world.nextId++, kind: 'oran', x: 900, y: 0, collected: false }); // off screen
    world.berries.push({ id: world.nextId++, kind: 'magnet', x: 0, y: 0, collected: false });
    step(world, IDLE, DT);
    expect(world.berries.find((b) => b.x === 900)!.magnetized).toBeFalsy();
    run(world, 2);
    expect(world.player.hp).toBe(40 + TUNING.heal.berryHeal);
    expect(world.berries.map((b) => b.x)).toEqual([900]);
  });
});
