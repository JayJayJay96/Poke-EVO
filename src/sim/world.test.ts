import { describe, expect, it } from 'vitest';
import { AUGMENT_IDS, AUGMENTS, MAX_RANK, MAX_SOCKETS, REROLLS_PER_RUN } from '../data/augments';
import { ENEMIES, POKEMON, TUNING, type EnemyId } from '../data/content';
import { MOVES, type MoveId } from '../data/moves';
import { BOOST_IDS, BOOST_MAX_PICKS, ITEM_IDS, MAX_ITEMS, POTION_HEAL } from '../data/upgrades';
import { WAVES } from '../data/waves';
import { damageEnemy, dropGem, findNearestEnemy } from './combat';
import {
  augmentPool,
  buildCardPool,
  canReroll,
  chooseAugment,
  chooseCard,
  chooseSkill,
  gainXp,
  isAugmentLevel,
  makeOffer,
  rerollAugments,
  xpToNext,
} from './progression';
import { createSeededRng } from './rng';
import { SpatialHash } from './spatialHash';
import { computeModifiers, createSlot, refreshStats } from './stats';
import type { InputState, World } from './types';
import { createWorld, pickEnemyKind, spawnEnemy, step, waveAt } from './world';

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };
const NO_BOOSTS = Object.fromEntries(BOOST_IDS.map((id) => [id, 0])) as World['boosts'];

function makeWorld(options: { spawnEnabled?: boolean; seed?: number } = {}): World {
  return createWorld({
    rng: createSeededRng(options.seed ?? 1),
    spawnRadius: 600,
    spawnEnabled: options.spawnEnabled ?? false,
  });
}

/** A world whose only move is `moveId`. */
function worldWithMove(moveId: MoveId): World {
  const world = makeWorld();
  world.moves = [createSlot(moveId)];
  refreshStats(world);
  return world;
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

describe('Ember (projectile form)', () => {
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

    expect(Math.ceil(ENEMIES.rattata.maxHp / MOVES.ember.damage)).toBe(2);
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

describe('Scratch (melee form)', () => {
  it('hits enemies inside the arc toward the target and misses those behind', () => {
    const world = worldWithMove('scratch');
    world.player.invulnLeft = 99;
    const front = spawnEnemy(world, 'raticate', 40, 0);
    const behind = spawnEnemy(world, 'raticate', -45, 0);
    front.speed = 0;
    behind.speed = 0;
    step(world, IDLE, DT);
    expect(front.hp).toBeCloseTo(front.maxHp - MOVES.scratch.damage);
    expect(behind.hp).toBe(behind.maxHp);
    expect(world.swings).toHaveLength(1);
  });

  it('does not swing when nothing is in reach', () => {
    const world = worldWithMove('scratch');
    const far = spawnEnemy(world, 'raticate', 300, 0);
    far.speed = 0;
    step(world, IDLE, DT);
    expect(world.swings).toHaveLength(0);
    expect(world.moves[0]!.cooldownLeft).toBe(0);
  });
});

describe('Fire Spin (orbit form)', () => {
  it('hits enemies the balls pass through, limited by the hit interval', () => {
    const world = worldWithMove('fireSpin');
    world.player.invulnLeft = 99;
    const def = MOVES.fireSpin;
    if (def.form !== 'orbit') throw new Error('fireSpin should be an orbit');
    const target = spawnEnemy(world, 'raticate', def.orbitRadius, 0, 10);
    target.speed = 0;

    step(world, IDLE, DT);
    expect(target.hp).toBeCloseTo(target.maxHp - def.damage);

    run(world, def.duration);
    const hits = Math.round((target.maxHp - target.hp) / def.damage);
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(hits).toBeLessThanOrEqual(Math.ceil(def.duration / def.hitInterval) + 1);
    expect(world.moves[0]!.activeLeft).toBeLessThanOrEqual(0);
  });
});

describe('Dragon Rage (beam form)', () => {
  it('ticks damage along the line and misses enemies beside it', () => {
    const world = worldWithMove('dragonRage');
    world.player.invulnLeft = 99;
    const def = MOVES.dragonRage;
    if (def.form !== 'beam') throw new Error('dragonRage should be a beam');
    const onLine = spawnEnemy(world, 'raticate', 150, 0);
    const beside = spawnEnemy(world, 'raticate', 150, 60);
    onLine.speed = 0;
    beside.speed = 0;

    run(world, def.duration + 0.05);
    const ticks = Math.round((onLine.maxHp - onLine.hp) / def.damage);
    expect(ticks).toBeGreaterThanOrEqual(Math.floor(def.duration / def.tickInterval));
    expect(beside.hp).toBe(beside.maxHp);
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

describe('stats', () => {
  it('stacks boosts additively and cooldown multiplicatively, plus items', () => {
    const m = computeModifiers({ ...NO_BOOSTS, damage: 2, cooldown: 2 }, ['quickClaw']);
    expect(m.damageMult).toBeCloseTo(1.2);
    expect(m.cooldownMult).toBeCloseTo(0.92 * 0.92 * 0.85);
  });

  it('refreshStats applies max HP (with the matching heal), speed and pickup', () => {
    const world = makeWorld();
    world.player.hp = 50;
    world.boosts.hp = 1;
    world.boosts.speed = 1;
    world.items.push('expShare');
    refreshStats(world);
    expect(world.player.maxHp).toBe(120);
    expect(world.player.hp).toBe(70);
    expect(world.player.speed).toBeCloseTo(POKEMON.charmander.speed * 1.08);
    expect(world.player.pickupRadius).toBeCloseTo(TUNING.player.baseMagnetRadius * 1.5);
  });

  it('move stats follow damage and cooldown modifiers', () => {
    const world = makeWorld();
    world.boosts.damage = 1;
    refreshStats(world);
    expect(world.moves[0]!.stats.damage).toBeCloseTo(MOVES.ember.damage * 1.1);
  });

  it('a guaranteed crit deals ×1.5', () => {
    const world = makeWorld();
    const enemy = spawnEnemy(world, 'rattata', 500, 0);
    damageEnemy(world, enemy, 10, 1);
    expect(enemy.hp).toBe(enemy.maxHp - 15);
  });

  it('Leftovers regenerates HP over time', () => {
    const world = makeWorld();
    world.items.push('leftovers');
    refreshStats(world);
    world.player.hp = 50;
    run(world, 2);
    expect(world.player.hp).toBeCloseTo(52, 0);
  });
});

describe('level-up cards', () => {
  it('the pool offers learnset moves, every boost and every item at the start', () => {
    const world = makeWorld();
    const pool = buildCardPool(world);
    const learnset = POKEMON.charmander.learnset.length;
    expect(pool).toHaveLength(learnset + BOOST_IDS.length + ITEM_IDS.length);
  });

  it('drops owned moves, maxed boosts and items once the item slots are full', () => {
    const world = makeWorld();
    world.moves.push(createSlot('scratch'));
    world.boosts.damage = BOOST_MAX_PICKS;
    world.items = ITEM_IDS.slice(0, MAX_ITEMS);
    const pool = buildCardPool(world);
    expect(pool.some((c) => c.kind === 'move' && c.moveId === 'scratch')).toBe(false);
    expect(pool.some((c) => c.kind === 'boost' && c.boostId === 'damage')).toBe(false);
    expect(pool.some((c) => c.kind === 'item')).toBe(false);
  });

  it('offers 3 distinct cards, or a Potion when nothing is left', () => {
    const world = makeWorld(); // next level is 2: a normal level
    const offer = makeOffer(world);
    if (offer.kind !== 'cards') throw new Error('expected a normal card offer');
    expect(offer.cards).toHaveLength(3);
    expect(new Set(offer.cards.map((c) => JSON.stringify(c))).size).toBe(3);

    for (const id of BOOST_IDS) world.boosts[id] = BOOST_MAX_PICKS;
    world.items = ITEM_IDS.slice(0, MAX_ITEMS);
    for (const id of POKEMON.charmander.learnset) world.moves.push(createSlot(id));
    expect(makeOffer(world)).toEqual({ kind: 'cards', cards: [{ kind: 'potion' }] });
  });

  it('pauses the run while cards wait, applies the choice and chains pending level-ups', () => {
    const world = makeWorld();
    gainXp(world, xpToNext(1) + xpToNext(2)); // two level-ups
    step(world, IDLE, DT);
    expect(world.offer).not.toBeNull();

    const pausedAt = world.time;
    run(world, 1);
    expect(world.time).toBe(pausedAt);

    world.offer = { kind: 'cards', cards: [{ kind: 'move', moveId: 'fireSpin' }] };
    chooseCard(world, 0);
    expect(world.moves.map((s) => s.moveId)).toContain('fireSpin');
    expect(world.pendingLevelUps).toBe(1);
    expect(world.offer).not.toBeNull(); // the second level-up is offered right away

    world.offer = { kind: 'cards', cards: [{ kind: 'boost', boostId: 'damage' }] };
    chooseCard(world, 0);
    expect(world.boosts.damage).toBe(1);
    expect(world.offer).toBeNull();
    run(world, 0.5);
    expect(world.time).toBeGreaterThan(pausedAt);
  });

  it('a Potion heals without exceeding max HP', () => {
    const world = makeWorld();
    world.player.hp = world.player.maxHp - 5;
    world.pendingLevelUps = 1;
    world.offer = { kind: 'cards', cards: [{ kind: 'potion' }] };
    chooseCard(world, 0);
    expect(world.player.hp).toBe(world.player.maxHp);
    expect(POTION_HEAL).toBeGreaterThan(5);
  });
});

describe('augments', () => {
  /** Puts the world on a pending augment level (Lv 3) with the given moves equipped. */
  function onAugmentLevel(moveIds: MoveId[] = []): World {
    const world = makeWorld();
    for (const id of moveIds) world.moves.push(createSlot(id));
    refreshStats(world);
    world.level = 3;
    world.pendingLevelUps = 1;
    world.offer = makeOffer(world);
    return world;
  }

  it('every 3rd level is an augment level', () => {
    expect([1, 2, 3, 4, 5, 6, 9, 10].map(isAugmentLevel)).toEqual([false, false, true, false, false, true, true, false]);
    const world = onAugmentLevel(['scratch']);
    expect(world.offer).toEqual({ kind: 'pickSkill', slots: [0, 1] });
  });

  it('pools only augments the move tags allow', () => {
    const world = onAugmentLevel(['scratch', 'fireSpin']);
    const ids = (slot: number) => augmentPool(world, slot).map((c) => c.augmentId);
    // Ember is a projectile: projectile-only augments are allowed.
    expect(ids(0)).toEqual(expect.arrayContaining(['multishot', 'scatter', 'velocity', 'extend']));
    // Scratch (melee) gets neither projectile augments nor Extend.
    expect(ids(1)).not.toContain('multishot');
    expect(ids(1)).not.toContain('extend');
    expect(ids(1)).toContain('powerUp');
    // Fire Spin (orbit) can Extend but not Multishot.
    expect(ids(2)).toContain('extend');
    expect(ids(2)).not.toContain('velocity');
  });

  it('pick skill → 3 distinct augment cards → socketed at rank I', () => {
    const world = onAugmentLevel();
    chooseSkill(world, 0);
    const offer = world.offer;
    if (offer?.kind !== 'augment') throw new Error('expected an augment offer');
    expect(offer.slot).toBe(0);
    expect(offer.cards).toHaveLength(3);
    expect(new Set(offer.cards.map((c) => c.augmentId)).size).toBe(3);
    expect(offer.cards.every((c) => c.rank === 1)).toBe(true);

    const picked = offer.cards[0]!.augmentId;
    chooseAugment(world, 0);
    expect(world.moves[0]!.sockets).toEqual([{ augmentId: picked, rank: 1 }]);
    expect(world.offer).toBeNull();
    expect(world.pendingLevelUps).toBe(0);
  });

  it('picking an owned augment ranks it up in the same socket, never a duplicate', () => {
    const world = onAugmentLevel();
    world.moves[0]!.sockets.push({ augmentId: 'multishot', rank: 1 });
    world.offer = { kind: 'augment', slot: 0, cards: [{ augmentId: 'multishot', rank: 2 }] };
    chooseAugment(world, 0);
    expect(world.moves[0]!.sockets).toEqual([{ augmentId: 'multishot', rank: 2 }]);
  });

  it('full sockets offer only rank-ups, and maxed augments drop out', () => {
    const world = onAugmentLevel();
    world.moves[0]!.sockets = [
      { augmentId: 'powerUp', rank: MAX_RANK },
      { augmentId: 'multishot', rank: 1 },
      { augmentId: 'velocity', rank: 2 },
    ];
    expect(world.moves[0]!.sockets).toHaveLength(MAX_SOCKETS);
    expect(augmentPool(world, 0)).toEqual([
      { augmentId: 'multishot', rank: 2 },
      { augmentId: 'velocity', rank: 3 },
    ]);
  });

  it('falls back to Power Surge when nothing can be augmented', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [
      { augmentId: 'powerUp', rank: MAX_RANK },
      { augmentId: 'multishot', rank: MAX_RANK },
      { augmentId: 'velocity', rank: MAX_RANK },
    ];
    world.level = 3;
    world.pendingLevelUps = 1;
    world.offer = makeOffer(world);
    expect(world.offer).toEqual({ kind: 'cards', cards: [{ kind: 'bigBoost' }] });
    const before = world.moves[0]!.stats.damage;
    chooseCard(world, 0);
    expect(world.bigBoosts).toBe(1);
    expect(world.moves[0]!.stats.damage).toBeGreaterThan(before);
  });

  it('rerolls are limited per run and only offered when the pool is bigger than the hand', () => {
    const world = onAugmentLevel();
    chooseSkill(world, 0);
    expect(canReroll(world)).toBe(true);
    for (let i = 0; i < REROLLS_PER_RUN; i++) expect(rerollAugments(world)).toBe(true);
    expect(world.rerollsLeft).toBe(0);
    expect(rerollAugments(world)).toBe(false);
    expect(world.offer?.kind).toBe('augment');
  });

  it('augment ranks change move stats', () => {
    const world = makeWorld();
    const ember = world.moves[0]!;
    ember.sockets = [
      { augmentId: 'powerUp', rank: 1 },
      { augmentId: 'multishot', rank: 2 },
    ];
    refreshStats(world);
    expect(ember.stats.damage).toBeCloseTo(MOVES.ember.damage * 1.15);
    expect(ember.stats.cooldown).toBeCloseTo(MOVES.ember.cooldown * 1.4);
    expect(ember.stats.extraCount).toBe(2);
  });

  it('Multishot makes Ember fire extra projectiles', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [{ augmentId: 'multishot', rank: 2 }];
    refreshStats(world);
    spawnEnemy(world, 'rattata', 250, 0);
    step(world, IDLE, DT);
    expect(world.projectiles).toHaveLength(3);
  });

  it('Glass raises the damage the player takes', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [{ augmentId: 'glass', rank: 1 }];
    refreshStats(world);
    world.moves = [];
    const enemy = spawnEnemy(world, 'rattata', 0, 0);
    step(world, IDLE, DT);
    expect(world.player.hp).toBeCloseTo(world.player.maxHp - enemy.contactDamage * 1.1);
  });

  it('every augment has three ranks, each with card text', () => {
    for (const id of AUGMENT_IDS) {
      const ranks = AUGMENTS[id].ranks;
      expect(ranks).toHaveLength(3);
      for (const rank of ranks) expect(rank.text.length).toBeGreaterThan(0);
    }
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
