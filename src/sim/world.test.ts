import { describe, expect, it } from 'vitest';
import { ENEMIES, MOVES, POKEMON, TUNING, type EnemyId } from '../data/content';
import { WAVES } from '../data/waves';
import { createSeededRng } from './rng';
import { SpatialHash } from './spatialHash';
import type { InputState, World } from './types';
import {
  createWorld,
  dropGem,
  findNearestEnemy,
  gainXp,
  pickEnemyKind,
  spawnEnemy,
  step,
  waveAt,
  xpToNext,
} from './world';

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

function makeWorld(options: { spawnEnabled?: boolean; seed?: number } = {}): World {
  return createWorld({
    rng: createSeededRng(options.seed ?? 1),
    spawnRadius: 600,
    spawnEnabled: options.spawnEnabled ?? false,
  });
}

function run(world: World, seconds: number, input: InputState = IDLE): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) step(world, input, DT);
}

describe('rng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('SpatialHash', () => {
  it('returns items in nearby cells only', () => {
    const hash = new SpatialHash(64);
    hash.insert(0, 10, 10);
    hash.insert(1, 50, 20);
    hash.insert(2, 1000, 1000);
    const out = hash.query(0, 0, 70, []);
    expect(out.sort()).toEqual([0, 1]);
  });

  it('is empty after clear and reusable', () => {
    const hash = new SpatialHash(64);
    hash.insert(0, 0, 0);
    hash.clear();
    expect(hash.query(0, 0, 100, [])).toEqual([]);
    hash.insert(5, 0, 0);
    expect(hash.query(0, 0, 10, [])).toEqual([5]);
  });

  it('handles negative coordinates', () => {
    const hash = new SpatialHash(64);
    hash.insert(0, -10, -10);
    hash.insert(1, -500, -500);
    expect(hash.query(-1, -1, 20, [])).toEqual([0]);
  });
});

describe('player movement', () => {
  it('moves at its speed', () => {
    const world = makeWorld();
    run(world, 1, { moveX: 1, moveY: 0 });
    expect(world.player.x).toBeCloseTo(POKEMON.charmander.speed, 0);
    expect(world.player.y).toBe(0);
  });

  it('normalises diagonals', () => {
    const world = makeWorld();
    run(world, 1, { moveX: 1, moveY: 1 });
    expect(Math.hypot(world.player.x, world.player.y)).toBeCloseTo(POKEMON.charmander.speed, 0);
  });
});

describe('Ember auto-fire', () => {
  it('does not fire without a target', () => {
    const world = makeWorld();
    run(world, 2);
    expect(world.projectiles).toHaveLength(0);
  });

  it('fires at the nearest enemy and kills a Rattata in two hits', () => {
    const world = makeWorld();
    world.player.invulnLeft = 99; // isolate shooting from contact damage
    spawnEnemy(world, 'rattata', 200, 0);
    step(world, IDLE, DT);
    expect(world.projectiles).toHaveLength(1);
    expect(world.projectiles[0]!.vx).toBeGreaterThan(0);

    const hitsToKill = Math.ceil(ENEMIES.rattata.maxHp / MOVES.ember.damage);
    expect(hitsToKill).toBe(2);
    run(world, 2);
    expect(world.kills).toBe(1);
    expect(world.enemies).toHaveLength(0);
  });

  it('picks the nearest enemy within range only', () => {
    const world = makeWorld();
    const far = spawnEnemy(world, 'rattata', 250, 0);
    const near = spawnEnemy(world, 'rattata', 0, -100);
    expect(findNearestEnemy(world, 300)).toBe(near);
    expect(findNearestEnemy(world, 50)).toBeUndefined();
    near.hp = 0;
    expect(findNearestEnemy(world, 300)).toBe(far);
  });
});

describe('contact damage and fainting', () => {
  it('hits once per invulnerability window', () => {
    const world = makeWorld();
    world.moves = []; // no shooting, so the Rattata stays alive
    const enemy = spawnEnemy(world, 'rattata', 0, 0);
    const max = world.player.maxHp;

    step(world, IDLE, DT);
    expect(world.player.hp).toBe(max - enemy.contactDamage);

    run(world, TUNING.player.invulnSeconds * 0.5);
    expect(world.player.hp).toBe(max - enemy.contactDamage);

    run(world, TUNING.player.invulnSeconds);
    expect(world.player.hp).toBe(max - 2 * enemy.contactDamage);
  });

  it('faints at 0 HP and then freezes the run', () => {
    const world = makeWorld();
    world.moves = [];
    world.player.hp = 5;
    spawnEnemy(world, 'rattata', 0, 0);
    step(world, IDLE, DT);
    expect(world.player.hp).toBe(0);
    expect(world.status).toBe('fainted');

    const frozenAt = world.time;
    run(world, 1, { moveX: 1, moveY: 0 });
    expect(world.time).toBe(frozenAt);
  });
});

describe('waves', () => {
  it('keyframes are ordered, start at 0 and always have someone to spawn', () => {
    expect(WAVES[0]!.at).toBe(0);
    for (let i = 0; i < WAVES.length; i++) {
      const total = Object.values(WAVES[i]!.weights).reduce((sum, w) => sum + (w ?? 0), 0);
      expect(total).toBeGreaterThan(0);
      if (i > 0) expect(WAVES[i]!.at).toBeGreaterThan(WAVES[i - 1]!.at);
    }
  });

  it('interpolates interval and HP scale between keyframes and holds after the last', () => {
    const [a, b] = [WAVES[0]!, WAVES[1]!];
    const mid = waveAt((a.at + b.at) / 2);
    expect(mid.spawnInterval).toBeCloseTo((a.spawnInterval + b.spawnInterval) / 2);
    expect(mid.hpScale).toBeCloseTo((a.hpScale + b.hpScale) / 2);
    expect(mid.weights).toBe(a.weights);

    const last = WAVES[WAVES.length - 1]!;
    expect(waveAt(last.at + 1000).spawnInterval).toBe(last.spawnInterval);
  });

  it('picks enemy kinds by weight', () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 200; i++) expect(pickEnemyKind({ rattata: 1 }, rng)).toBe('rattata');

    const counts: Record<EnemyId, number> = { rattata: 0, pidgey: 0, raticate: 0 };
    const draws = 8000;
    for (let i = 0; i < draws; i++) counts[pickEnemyKind({ rattata: 3, pidgey: 1 }, rng)]++;
    expect(counts.raticate).toBe(0);
    expect(counts.rattata / draws).toBeGreaterThan(0.72);
    expect(counts.rattata / draws).toBeLessThan(0.78);
  });

  it('scales spawned enemy HP', () => {
    const world = makeWorld();
    const enemy = spawnEnemy(world, 'raticate', 0, 0, 2);
    expect(enemy.maxHp).toBe(ENEMIES.raticate.maxHp * 2);
    expect(enemy.hp).toBe(enemy.maxHp);
  });
});

describe('spawner', () => {
  it('spawns on the ring around the player', () => {
    const world = makeWorld({ spawnEnabled: true });
    world.moves = [];
    run(world, WAVES[0]!.spawnInterval + DT);
    expect(world.enemies.length).toBeGreaterThanOrEqual(1);
    const enemy = world.enemies[0]!;
    const dist = Math.hypot(enemy.x - world.player.x, enemy.y - world.player.y);
    // It has walked inward for at most a couple of steps since spawning.
    expect(dist).toBeGreaterThan(world.spawnRadius - 5);
    expect(dist).toBeLessThanOrEqual(world.spawnRadius);
  });

  it('never exceeds the enemy cap', () => {
    const world = makeWorld({ spawnEnabled: true });
    world.moves = [];
    for (let i = 0; i < TUNING.spawn.maxEnemies; i++) spawnEnemy(world, 'rattata', 5000, i * 25);
    run(world, 3);
    expect(world.enemies).toHaveLength(TUNING.spawn.maxEnemies);
  });
});

describe('XP and levels', () => {
  it('xp curve starts at the base and keeps rising', () => {
    expect(xpToNext(1)).toBe(TUNING.xp.curve.base);
    for (let level = 2; level <= 60; level++) {
      expect(xpToNext(level)).toBeGreaterThan(xpToNext(level - 1));
    }
  });

  it('levels up exactly at the threshold and queues a level-up', () => {
    const world = makeWorld();
    gainXp(world, xpToNext(1) - 1);
    expect(world.level).toBe(1);
    gainXp(world, 1);
    expect(world.level).toBe(2);
    expect(world.xp).toBe(0);
    expect(world.pendingLevelUps).toBe(1);
  });

  it('a big pickup can grant several levels with the remainder kept', () => {
    const world = makeWorld();
    const needed = xpToNext(1) + xpToNext(2) + xpToNext(3);
    gainXp(world, needed + 2);
    expect(world.level).toBe(4);
    expect(world.xp).toBe(2);
    expect(world.pendingLevelUps).toBe(3);
  });

  it('a kill drops a gem worth the enemy XP', () => {
    const world = makeWorld();
    world.player.invulnLeft = 99;
    spawnEnemy(world, 'raticate', 250, 0, 0.2); // low HP so it dies far away
    run(world, 3);
    expect(world.kills).toBe(1);
    // Raticate dies out of magnet range, so its gem is still on the ground.
    expect(world.gems).toHaveLength(1);
    expect(world.gems[0]!.value).toBe(ENEMIES.raticate.xp);
  });

  it('gems inside the magnet radius fly in and are collected', () => {
    const world = makeWorld();
    dropGem(world, world.player.pickupRadius - 5, 0, 3);
    run(world, 0.5);
    expect(world.gems).toHaveLength(0);
    expect(world.xp).toBe(3);
  });

  it('gems outside the magnet radius stay until the player comes close', () => {
    const world = makeWorld();
    dropGem(world, 200, 0, 1);
    run(world, 1);
    expect(world.gems).toHaveLength(1);
    expect(world.xp).toBe(0);
    run(world, 1, { moveX: 1, moveY: 0 });
    expect(world.gems).toHaveLength(0);
    expect(world.xp).toBe(1);
  });

  it('merges XP into the oldest gem once the gem budget is full', () => {
    const world = makeWorld();
    for (let i = 0; i < TUNING.xp.maxGems; i++) dropGem(world, 1000 + i, 1000, 1);
    dropGem(world, 0, 5000, 4);
    expect(world.gems).toHaveLength(TUNING.xp.maxGems);
    expect(world.gems[0]!.value).toBe(5);
  });
});

describe('run end', () => {
  it('survives at the run time limit and then freezes', () => {
    const world = makeWorld();
    world.time = TUNING.runSeconds - DT / 2;
    step(world, IDLE, DT);
    expect(world.status).toBe('survived');
    const at = world.time;
    run(world, 1);
    expect(world.time).toBe(at);
  });
});

describe('enemy separation', () => {
  it('pushes overlapping enemies apart', () => {
    const world = makeWorld();
    world.moves = [];
    const a = spawnEnemy(world, 'rattata', 1000, 0);
    const b = spawnEnemy(world, 'rattata', 1000, 1);
    run(world, 0.5);
    expect(Math.abs(a.y - b.y)).toBeGreaterThan(1);
  });

  it('separates exactly stacked enemies', () => {
    const world = makeWorld();
    world.moves = [];
    const a = spawnEnemy(world, 'rattata', 1000, 0);
    const b = spawnEnemy(world, 'rattata', 1000, 0);
    run(world, 0.5);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1);
  });
});
