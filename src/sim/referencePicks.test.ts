import { describe, expect, it } from 'vitest';
import { TUNING } from '../data/content';
import { damageEnemy, findTarget, makeHitInfo } from './combat';
import { spawnEntity } from './mutationDefs/util';
import { setMutation } from './mutations';
import { createSeededRng } from './rng';
import { createSlot, refreshStats } from './stats';
import type { World } from './types';
import { createWorld, spawnEnemy, step } from './world';

// Owner picks after the reference-pack review (2026-10-22): Predatory, Volatility, bosses break Ice Wall.

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };

function makeWorld(pokemonId: 'charmander' | 'lapras' = 'charmander'): World {
  return createWorld({ rng: createSeededRng(3), spawnEnabled: false, pokemonId });
}

describe('Predatory (2026-10-22)', () => {
  it('aims at the lowest-HP % enemy in range instead of the nearest', () => {
    const world = makeWorld();
    const ember = world.moves[0]!;
    const near = spawnEnemy(world, 'raticate', 80, 0, 10);
    const weak = spawnEnemy(world, 'raticate', -200, 0, 10);
    weak.hp = weak.maxHp * 0.3;
    expect(findTarget(world, ember, 320)).toBe(near);
    ember.sockets = [{ augmentId: 'predatory', rank: 1 }];
    refreshStats(world);
    expect(findTarget(world, ember, 320)).toBe(weak);
    expect(findTarget(world, ember, 150)).toBe(near); // out-of-range weaklings don't count
  });

  it('ranks II/III add damage only against enemies below half HP, and only on the move’s own hits', () => {
    const world = makeWorld();
    const ember = world.moves[0]!;
    ember.sockets = [{ augmentId: 'predatory', rank: 3 }];
    refreshStats(world);
    const full = spawnEnemy(world, 'raticate', 500, 0, 100);
    const low = spawnEnemy(world, 'raticate', 500, 50, 100);
    low.hp = low.maxHp * 0.4;
    const hit = makeHitInfo(ember.stats, ember);
    const fullBefore = full.hp;
    const lowBefore = low.hp;
    damageEnemy(world, full, 100, hit);
    damageEnemy(world, low, 100, hit);
    expect((lowBefore - low.hp) / (fullBefore - full.hp)).toBeCloseTo(1.2);
    const procBefore = low.hp;
    damageEnemy(world, low, 100, { ...hit, fromProc: true });
    expect(procBefore - low.hp).toBeCloseTo(fullBefore - full.hp); // procs get no bonus
  });
});

describe('Volatility (2026-10-22)', () => {
  it('rolls a new damage multiplier every cast, within the rank range, averaging about ×1.1 at rank I', () => {
    const world = makeWorld();
    const ember = world.moves[0]!;
    ember.sockets = [{ augmentId: 'volatility', rank: 1 }];
    refreshStats(world);
    const target = spawnEnemy(world, 'raticate', 100, 0, 1e6);
    target.speed = 0;
    const rolls: number[] = [];
    for (let i = 0; i < 400; i++) {
      ember.cooldownLeft = 0;
      step(world, IDLE, DT);
      rolls.push(ember.volatileMult);
    }
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(0.5);
    expect(Math.max(...rolls)).toBeLessThanOrEqual(1.7);
    expect(new Set(rolls).size).toBeGreaterThan(100);
    const mean = rolls.reduce((a, b) => a + b, 0) / rolls.length;
    expect(mean).toBeGreaterThan(1.02);
    expect(mean).toBeLessThan(1.18);
  });

  it('without it the multiplier stays at 1', () => {
    const world = makeWorld();
    spawnEnemy(world, 'raticate', 100, 0, 1e6).speed = 0;
    for (let i = 0; i < 30; i++) step(world, IDLE, DT);
    expect(world.moves[0]!.volatileMult).toBe(1);
  });
});

describe('Ice Wall vs bosses (2026-10-22)', () => {
  it('holds normal enemies but a boss smashes through it', () => {
    for (const kind of ['raticate', 'snorlax'] as const) {
      const world = makeWorld('lapras');
      const slot = createSlot('iceBeam');
      setMutation(slot, 'iceBeam.iceWall');
      world.moves = [slot];
      refreshStats(world);
      const wall = spawnEntity(world, 'iceBeam.iceWall', 200, -100, 10);
      wall.x2 = 200;
      wall.y2 = 100;
      wall.radius = 10;
      const enemy = spawnEnemy(world, kind, 200, 0, 100);
      enemy.speed = 0;
      step(world, IDLE, DT);
      const standing = world.entities.some((e) => e.id === wall.id && e.lifeLeft > 0);
      expect(standing).toBe(kind !== 'snorlax');
    }
  });
});
