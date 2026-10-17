import { describe, expect, it } from 'vitest';
import { AUGMENT_IDS, AUGMENTS, MAX_RANK, MAX_SOCKETS, REROLLS_PER_RUN, isSpecialAugment } from '../data/augments';
import { ABILITIES, ENEMIES, POKEMON, TUNING, type EnemyId } from '../data/content';
import { MOVES, type MeleeMoveDef, type MoveId, type ProjectileMoveDef, type ZoneMoveDef } from '../data/moves';
import { BOOST_IDS, BOOST_MAX_PICKS, ITEM_IDS, MAX_ITEMS, POTION_HEAL } from '../data/upgrades';
import { effectiveness, moveType } from '../data/typeChart';
import { WAVES } from '../data/waves';
import {
  NO_HIT,
  abilityDamageMult,
  damageEnemy,
  dropGem,
  findNearestEnemy,
  isAbilityActive,
  maybeDropBerry,
  applyStatuses,
  knockbackResistance,
  makeHitInfo,
  updateStatuses,
} from './combat';
import { castMelee } from './forms/melee';
import { castProjectile, createProjectile } from './forms/projectile';
import { castZone } from './forms/zoneCast';
import {
  chooseEvolutionTrait,
  dismissEvolution,
  dueEvolutionStage,
  finishEvolutionCinematic,
  upgradeSignatureByLevel,
} from './evolution';
import {
  augmentPool,
  backFromReplace,
  backToSkills,
  buildCardPool,
  canReroll,
  chooseAugment,
  chooseCard,
  chooseReplace,
  chooseSkill,
  gainXp,
  isAugmentLevel,
  makeAugmentOffer,
  makeOffer,
  rerollAugments,
  xpToNext,
} from './progression';
import { createSeededRng } from './rng';
import { SpatialHash } from './spatialHash';
import { computeModifiers, createSlot, currentStage, refreshStats } from './stats';
import { STRESS_ENEMIES, setupStress, topUpStress } from './stress';
import type { AugmentSocket, InputState, Projectile, World } from './types';
import { createWorld, pickEnemyKind, spawnEnemy, step, waveAt } from './world';
import { spawnZone } from './zones';

// P4a adds statuses, abilities, zone-cast and chain tests at the end; P4b Squirtle; P4c Bulbasaur.
const DT = TUNING.stepSeconds;
/** Charmander is Fire, so Fire moves carry the same-type bonus (D11). */
const STAB = 1 + TUNING.stabBonus;
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
    expect(world.player.x).toBeCloseTo(POKEMON.charmander.stages[0]!.speed, 0);
    expect(world.player.y).toBe(0);
  });

  it('normalises diagonals', () => {
    const world = makeWorld();
    run(world, 1, { moveX: 1, moveY: 1 });
    expect(Math.hypot(world.player.x, world.player.y)).toBeCloseTo(POKEMON.charmander.stages[0]!.speed, 0);
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
    expect(target.hp).toBeCloseTo(target.maxHp - def.damage * STAB);

    run(world, def.duration);
    const hits = Math.round((target.maxHp - target.hp) / (def.damage * STAB));
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
    expect(world.player.speed).toBeCloseTo(POKEMON.charmander.stages[0]!.speed * 1.08);
    expect(world.player.pickupRadius).toBeCloseTo(TUNING.player.baseMagnetRadius * 1.5);
  });

  it('move stats follow damage and cooldown modifiers', () => {
    const world = makeWorld();
    world.boosts.damage = 1;
    refreshStats(world);
    expect(world.moves[0]!.stats.damage).toBeCloseTo(MOVES.ember.damage * 1.1 * STAB);
  });

  it('a guaranteed crit deals ×1.5', () => {
    const world = makeWorld();
    const enemy = spawnEnemy(world, 'rattata', 500, 0);
    damageEnemy(world, enemy, 10, { ...NO_HIT, critChance: 1 });
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
    const learnset = POKEMON.charmander.learnset.filter((e) => e.fromStage === 0).length;
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
    for (const e of POKEMON.charmander.learnset) if (e.fromStage === 0) world.moves.push(createSlot(e.move));
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
    expect(world.offer).toEqual({ kind: 'pickSkill', slots: [0, 1], drawn: {} });
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
    world.offer = { kind: 'augment', slot: 0, cards: [{ augmentId: 'multishot', rank: 2 }], skills: [0], drawn: {} };
    chooseAugment(world, 0);
    expect(world.moves[0]!.sockets).toEqual([{ augmentId: 'multishot', rank: 2 }]);
  });

  it('full sockets still offer rank-ups plus new augments (as replacements); maxed ones drop out', () => {
    const world = onAugmentLevel();
    world.moves[0]!.sockets = [
      { augmentId: 'powerUp', rank: MAX_RANK },
      { augmentId: 'multishot', rank: 1 },
      { augmentId: 'velocity', rank: 2 },
    ];
    expect(world.moves[0]!.sockets).toHaveLength(MAX_SOCKETS);
    const pool = augmentPool(world, 0);
    expect(pool).toContainEqual({ augmentId: 'multishot', rank: 2 });
    expect(pool).toContainEqual({ augmentId: 'velocity', rank: 3 });
    expect(pool.some((c) => c.augmentId === 'powerUp')).toBe(false);
    expect(pool).toContainEqual({ augmentId: 'pierce', rank: 1 });
  });

  it('falls back to Power Surge when no move can take an augment', () => {
    const world = makeWorld();
    world.moves = []; // the only way to have nothing to augment now that full moves can replace
    world.level = 3;
    world.pendingLevelUps = 1;
    world.offer = makeOffer(world);
    expect(world.offer).toEqual({ kind: 'cards', cards: [{ kind: 'bigBoost' }] });
    const before = world.mods.damageMult;
    chooseCard(world, 0);
    expect(world.bigBoosts).toBe(1);
    expect(world.mods.damageMult).toBeGreaterThan(before);
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
    expect(ember.stats.damage).toBeCloseTo(MOVES.ember.damage * 1.15 * STAB);
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

  it('every augment has 1–3 ranks, each with card text', () => {
    for (const id of AUGMENT_IDS) {
      const ranks = AUGMENTS[id].ranks;
      expect(ranks.length).toBeGreaterThanOrEqual(1);
      expect(ranks.length).toBeLessThanOrEqual(MAX_RANK);
      for (const rank of ranks) expect(rank.text.length).toBeGreaterThan(0);
    }
  });
});

describe('performance budgets', () => {
  /** A harmless projectile parked far away, to fill the budget. */
  function filler(id: number): Projectile {
    return Object.assign(createProjectile(), { id, x: 50_000, y: 50_000, radius: 1, speed: 1, lifeLeft: 99, dead: false });
  }

  it('a cast clipped by the projectile cap fires fewer, heavier projectiles', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [{ augmentId: 'multishot', rank: MAX_RANK }]; // 5 per cast
    refreshStats(world);
    const max = TUNING.budget.maxProjectiles;
    for (let i = 0; i < max - 1; i++) world.projectiles.push(filler(-i - 1));
    spawnEnemy(world, 'rattata', 250, 0);
    step(world, IDLE, DT);
    expect(world.projectiles).toHaveLength(max);
    const fresh = world.projectiles.find((p) => p.damage > 0)!;
    expect(fresh.damage).toBeCloseTo(world.moves[0]!.stats.damage * 5);
  });

  it('a full budget spends the cast without spawning', () => {
    const world = makeWorld();
    const max = TUNING.budget.maxProjectiles;
    for (let i = 0; i < max; i++) world.projectiles.push(filler(-i - 1));
    spawnEnemy(world, 'rattata', 250, 0);
    step(world, IDLE, DT);
    expect(world.projectiles).toHaveLength(max);
    expect(world.moves[0]!.cooldownLeft).toBeGreaterThan(0);
  });

  it('dead projectiles are reused instead of reallocated', () => {
    const world = makeWorld();
    world.player.invulnLeft = 99;
    const target = spawnEnemy(world, 'raticate', 250, 0, 10);
    target.speed = 0;
    step(world, IDLE, DT);
    const first = world.projectiles[0]!;
    first.lifeLeft = 0; // expires on the next step
    step(world, IDLE, DT);
    expect(world.projectiles).not.toContain(first);
    expect(world.projectilePool).toContain(first);
    run(world, MOVES.ember.cooldown);
    expect(world.projectiles).toContain(first);
    expect(world.projectilePool).not.toContain(first);
  });

  it('stress mode holds 500 enemies with a fully socketed build and never pauses or faints', () => {
    const world = makeWorld();
    setupStress(world);
    expect(world.enemies).toHaveLength(STRESS_ENEMIES);
    expect(world.moves).toHaveLength(4);
    expect(world.moves.every((s) => s.sockets.length === MAX_SOCKETS)).toBe(true);
    for (let i = 0; i < 240; i++) {
      topUpStress(world);
      step(world, { moveX: 1, moveY: 0 }, DT);
      expect(world.projectiles.length).toBeLessThanOrEqual(TUNING.budget.maxProjectiles);
    }
    topUpStress(world);
    expect(world.enemies).toHaveLength(STRESS_ENEMIES);
    expect(world.status).toBe('running');
    expect(world.offer).toBeNull();
    expect(world.kills).toBeGreaterThan(0);
  });
});

describe('evolution', () => {
  const stages = POKEMON.charmander.stages;

  /** Total XP to reach `level` from Lv 1. */
  function xpForLevel(level: number): number {
    let total = 0;
    for (let l = 1; l < level; l++) total += xpToNext(l);
    return total;
  }

  it('stage data rises with each evolution', () => {
    for (let i = 1; i < stages.length; i++) {
      const [a, b] = [stages[i - 1]!, stages[i]!];
      expect(b.level).toBeGreaterThan(a.level);
      expect(b.maxHp).toBeGreaterThan(a.maxHp);
      expect(b.speed).toBeGreaterThan(a.speed);
      expect(b.radius).toBeGreaterThan(a.radius);
      expect(b.damageMult).toBeGreaterThan(a.damageMult);
    }
  });

  it('reaching the stage level starts the cinematic before any level-up cards and pauses the run', () => {
    const world = makeWorld();
    gainXp(world, xpForLevel(stages[1]!.level));
    step(world, IDLE, DT);
    expect(world.evolution).toEqual({ fromStage: 0, toStage: 1, phase: 'cinematic', traitChoices: null });
    expect(world.offer).toBeNull();
    const at = world.time;
    run(world, 1);
    expect(world.time).toBe(at);
  });

  it('finishing the cinematic applies the new stage, with the max-HP gain healed', () => {
    const world = makeWorld();
    world.player.hp = 50;
    gainXp(world, xpForLevel(stages[1]!.level));
    step(world, IDLE, DT);
    finishEvolutionCinematic(world);
    const s1 = stages[1]!;
    expect(world.player.stage).toBe(1);
    expect(world.player.maxHp).toBe(s1.maxHp);
    expect(world.player.hp).toBe(50 + (s1.maxHp - stages[0]!.maxHp));
    expect(world.player.speed).toBeCloseTo(s1.speed);
    expect(world.player.radius).toBe(s1.radius);
    expect(world.moves[0]!.moveId).toBe(s1.signatureMove);
    expect(world.moves[0]!.stats.damage).toBeCloseTo(MOVES[s1.signatureMove].damage * s1.damageMult * STAB);
    expect(world.evolution?.phase).toBe('summary');
  });

  it('dismissing the summary hands over to the queued level-up cards', () => {
    const world = makeWorld();
    gainXp(world, xpForLevel(stages[1]!.level));
    const pending = world.pendingLevelUps;
    step(world, IDLE, DT);
    finishEvolutionCinematic(world);
    dismissEvolution(world);
    expect(world.evolution).toBeNull();
    expect(world.offer).not.toBeNull();
    expect(world.pendingLevelUps).toBe(pending);
  });

  it('a jump past both stage levels evolves twice, one at a time', () => {
    const world = makeWorld();
    gainXp(world, xpForLevel(stages[2]!.level));
    step(world, IDLE, DT);
    expect(world.evolution?.toStage).toBe(1);
    finishEvolutionCinematic(world);
    dismissEvolution(world);
    expect(world.evolution).toEqual({ fromStage: 1, toStage: 2, phase: 'cinematic', traitChoices: null });
    finishEvolutionCinematic(world);
    dismissEvolution(world);
    expect(world.player.stage).toBe(2);
    expect(dueEvolutionStage(world)).toBeNull();
  });

  it('cinematic and summary steps ignore calls in the wrong phase', () => {
    const world = makeWorld();
    dismissEvolution(world);
    finishEvolutionCinematic(world);
    expect(world.evolution).toBeNull();
    expect(world.player.stage).toBe(0);
  });
});

describe('signature tiers', () => {
  const stages = POKEMON.charmander.stages;

  /** Pushes the world straight into the summary of evolving to `toStage`. */
  function evolveTo(world: World, toStage: number): void {
    world.evolution = { fromStage: world.player.stage, toStage, phase: 'cinematic', traitChoices: null };
    finishEvolutionCinematic(world);
    world.evolution = null;
  }

  it('each tier keeps every tag of the previous tier (evolution only adds tags)', () => {
    for (let i = 1; i < stages.length; i++) {
      const before = MOVES[stages[i - 1]!.signatureMove].tags;
      const after = MOVES[stages[i]!.signatureMove].tags;
      for (const tag of before) expect(after).toContain(tag);
      expect(after.length).toBeGreaterThan(before.length);
    }
  });

  it('evolving swaps the signature move in place and keeps its augments', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [{ augmentId: 'powerUp', rank: 1 }];
    refreshStats(world);
    evolveTo(world, 1);
    const slot = world.moves[0]!;
    expect(slot.moveId).toBe('flameBurst');
    expect(slot.sockets).toEqual([{ augmentId: 'powerUp', rank: 1 }]);
    expect(slot.stats.damage).toBeCloseTo(MOVES.flameBurst.damage * stages[1]!.damageMult * 1.15 * STAB);
  });

  it('carried augments stay valid and never duplicate after two evolutions', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [
      { augmentId: 'multishot', rank: 1 },
      { augmentId: 'blazeCore', rank: 1 },
    ];
    evolveTo(world, 1);
    evolveTo(world, 2);
    expect(world.moves[0]!.moveId).toBe('blastBurn');
    const pool = augmentPool(world, 0);
    const newOnes = pool.filter((c) => c.rank === 1).map((c) => c.augmentId);
    expect(newOnes).not.toContain('multishot');
    expect(newOnes).not.toContain('blazeCore');
    expect(pool).toContainEqual({ augmentId: 'multishot', rank: 2 });
  });

  it('Flame Burst splashes enemies near the impact and spares those further out', () => {
    const world = worldWithMove('flameBurst');
    world.player.invulnLeft = 99;
    const primary = spawnEnemy(world, 'raticate', 150, 0);
    const nearby = spawnEnemy(world, 'raticate', 150, 30);
    const far = spawnEnemy(world, 'raticate', 150, 130);
    for (const e of [primary, nearby, far]) e.speed = 0;
    run(world, 0.5);
    const def = MOVES.flameBurst;
    if (def.form !== 'projectile' || !def.explosion) throw new Error('flameBurst should explode');
    expect(primary.hp).toBeCloseTo(primary.maxHp - def.damage * STAB);
    expect(nearby.hp).toBeCloseTo(nearby.maxHp - def.damage * STAB * def.explosion.damageFraction);
    expect(far.hp).toBe(far.maxHp);
  });

  it('Blast Burn leaves a crater that ticks for its duration, then disappears', () => {
    const world = worldWithMove('blastBurn');
    world.player.invulnLeft = 99;
    const def = MOVES.blastBurn;
    if (def.form !== 'projectile' || !def.crater || !def.explosion) throw new Error('blastBurn should leave a crater');
    const target = spawnEnemy(world, 'raticate', 150, 0, 20);
    target.speed = 0;
    run(world, 0.5);
    expect(world.zones).toHaveLength(1);
    world.moves[0]!.cooldownLeft = 999; // isolate the crater from further casts
    const afterImpact = target.hp;
    run(world, def.crater.duration + 0.5);
    const tickDamage = def.damage * def.crater.damageFraction;
    const ticks = Math.round((afterImpact - target.hp) / tickDamage);
    const expected = def.crater.duration / def.crater.tickInterval;
    expect(ticks).toBeGreaterThanOrEqual(expected - 1);
    expect(ticks).toBeLessThanOrEqual(expected);
    expect(world.zones).toHaveLength(0);
  });

  it('the zone budget skips new zones once full', () => {
    const world = makeWorld();
    for (let i = 0; i < TUNING.budget.maxZones; i++) expect(spawnZone(world, i * 10, 0, 20, 5, 0.5, 1, 0)).toBe(true);
    expect(spawnZone(world, 0, 0, 20, 5, 0.5, 1, 0)).toBe(false);
    expect(world.zones).toHaveLength(TUNING.budget.maxZones);
  });

  it('tag and exclusive augments only appear on the right moves', () => {
    const world = makeWorld();
    world.moves = ['ember', 'flameBurst', 'blastBurn', 'scratch'].map((id) => createSlot(id as MoveId));
    const has = (slot: number, id: string) => augmentPool(world, slot).some((c) => c.augmentId === id);
    expect(has(0, 'wideBlast')).toBe(false);
    expect(has(1, 'wideBlast')).toBe(true);
    expect(has(1, 'linger')).toBe(false);
    expect(has(2, 'linger')).toBe(true);
    expect(has(0, 'blazeCore')).toBe(true);
    expect(has(3, 'blazeCore')).toBe(false);
    expect(has(1, 'megaFlare')).toBe(false);
    expect(has(2, 'megaFlare')).toBe(true);
  });

  it('Blaze Core scales damage with missing HP when the hit lands', () => {
    const world = makeWorld();
    world.player.hp = world.player.maxHp * 0.5; // above Blaze's 30% threshold
    const enemy = spawnEnemy(world, 'raticate', 500, 0);
    damageEnemy(world, enemy, 10, { ...NO_HIT, missingHpBonus: 0.8 });
    expect(enemy.hp).toBeCloseTo(enemy.maxHp - 10 * (1 + 0.8 * 0.5));
  });
});

describe('behaviour augments', () => {
  /** Ember with the given augments, facing a line of stationary Raticates along +x. */
  function emberVsLine(augments: { augmentId: AugmentSocket['augmentId']; rank: number }[], xs: number[]): {
    world: World;
    targets: ReturnType<typeof spawnEnemy>[];
  } {
    const world = makeWorld();
    world.player.invulnLeft = 99;
    world.moves[0]!.sockets = augments;
    refreshStats(world);
    const targets = xs.map((x) => {
      const e = spawnEnemy(world, 'raticate', x, 0, 10);
      e.speed = 0;
      return e;
    });
    return { world, targets };
  }

  it('without Pierce a projectile stops at the first enemy', () => {
    const { world, targets } = emberVsLine([], [100, 160]);
    step(world, IDLE, DT);
    world.moves[0]!.cooldownLeft = 999;
    run(world, 0.8);
    expect(targets[0]!.hp).toBeLessThan(targets[0]!.maxHp);
    expect(targets[1]!.hp).toBe(targets[1]!.maxHp);
  });

  it('Pierce I passes through one enemy and stops at the next', () => {
    const { world, targets } = emberVsLine([{ augmentId: 'pierce', rank: 1 }], [100, 160, 220]);
    step(world, IDLE, DT);
    world.moves[0]!.cooldownLeft = 999;
    run(world, 1);
    expect(targets[0]!.hp).toBeLessThan(targets[0]!.maxHp);
    expect(targets[1]!.hp).toBeLessThan(targets[1]!.maxHp);
    expect(targets[2]!.hp).toBe(targets[2]!.maxHp);
  });

  it('Homing curves toward an enemy the straight shot would miss', () => {
    const world = makeWorld();
    world.player.invulnLeft = 99;
    world.moves[0]!.sockets = [{ augmentId: 'homing', rank: 1 }];
    refreshStats(world);
    const aimed = spawnEnemy(world, 'raticate', 200, 0, 10);
    aimed.speed = 0;
    step(world, IDLE, DT); // fires along +x
    aimed.hp = 0; // the original target vanishes mid-flight
    const other = spawnEnemy(world, 'raticate', 150, 90, 10);
    other.speed = 0;
    world.moves[0]!.cooldownLeft = 999;
    run(world, 1);
    expect(other.hp).toBeLessThan(other.maxHp);
  });

  it('Return passes through on the way out, hits again on the way back and ends at the player', () => {
    const { world, targets } = emberVsLine([{ augmentId: 'boomerang', rank: 1 }], [80]);
    const lifetime = MOVES.ember.form === 'projectile' ? MOVES.ember.projectileLifetime : 0;
    step(world, IDLE, DT);
    world.moves[0]!.cooldownLeft = 999;
    const proj = world.projectiles[0]!;
    run(world, lifetime / 2 + 0.05);
    expect(proj.returning).toBe(true);
    run(world, lifetime);
    expect(world.projectiles).toHaveLength(0);
    const hits = Math.round((targets[0]!.maxHp - targets[0]!.hp) / MOVES.ember.damage);
    expect(hits).toBe(2); // once on each leg
  });

  it('Knockback staggers an enemy away from the hit, reduced by its weight', () => {
    const { world, targets } = emberVsLine([{ augmentId: 'knockback', rank: 3 }], [120]);
    const startX = targets[0]!.x;
    run(world, 0.8); // one Ember hit
    const pushed = targets[0]!.x - startX;
    const expected = 55 * (1 - ENEMIES.raticate.weightKg / (ENEMIES.raticate.weightKg + TUNING.knockbackWeightK));
    expect(pushed).toBeGreaterThan(expected * 0.8);
    expect(pushed).toBeLessThan(55);
  });

  it('Burn deals damage over 3 s in 0.25 s ticks after the hit', () => {
    const world = makeWorld();
    const enemy = spawnEnemy(world, 'raticate', 500, 0, 10);
    enemy.speed = 0;
    damageEnemy(world, enemy, 10, { ...NO_HIT, burnDps: 4 });
    const afterHit = enemy.hp;
    for (let i = 0; i < Math.round(TUNING.status.burnSeconds / DT) + 30; i++) updateStatuses(world, DT);
    expect(afterHit - enemy.hp).toBeCloseTo(4 * TUNING.status.burnSeconds, 0);
    expect(enemy.burnLeft).toBeLessThanOrEqual(0);
  });

  it('Burn ticks are plain hits: no lifesteal from them', () => {
    const world = makeWorld();
    world.player.hp = 50;
    const enemy = spawnEnemy(world, 'raticate', 500, 0, 10);
    damageEnemy(world, enemy, 10, { ...NO_HIT, burnDps: 4, lifesteal: 0.5 });
    expect(world.player.hp).toBeCloseTo(55); // 50% of the 10 hit
    for (let i = 0; i < 60; i++) updateStatuses(world, DT);
    expect(world.player.hp).toBeCloseTo(55);
  });

  it('Lifesteal heals a share of damage actually dealt, capped at max HP', () => {
    const world = makeWorld();
    world.player.hp = world.player.maxHp - 1;
    const enemy = spawnEnemy(world, 'rattata', 500, 0);
    damageEnemy(world, enemy, 1000, { ...NO_HIT, lifesteal: 0.5 });
    expect(world.player.hp).toBe(world.player.maxHp);
  });

  it('single-rank augments never offer a rank-up', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [
      { augmentId: 'homing', rank: 1 },
      { augmentId: 'boomerang', rank: 1 },
    ];
    const pool = augmentPool(world, 0);
    expect(pool.some((c) => c.augmentId === 'homing')).toBe(false);
    expect(pool.some((c) => c.augmentId === 'boomerang')).toBe(false);
  });

  it('Burn only rolls on Fire moves, Knockback not on beams or orbits', () => {
    const world = makeWorld();
    world.moves = (['ember', 'scratch', 'fireSpin', 'dragonRage'] as MoveId[]).map((id) => createSlot(id));
    const has = (slot: number, id: string) => augmentPool(world, slot).some((c) => c.augmentId === id);
    expect(has(0, 'burn')).toBe(true);
    expect(has(1, 'burn')).toBe(false);
    expect(has(1, 'knockback')).toBe(true);
    expect(has(2, 'knockback')).toBe(false);
    expect(has(3, 'knockback')).toBe(false);
  });
});

describe('P3 playtest revisions (D11)', () => {
  const stages = POKEMON.charmander.stages;

  function evolveTo(world: World, toStage: number): void {
    world.evolution = { fromStage: world.player.stage, toStage, phase: 'cinematic', traitChoices: null };
    finishEvolutionCinematic(world);
  }

  it('Blast Burn with Pierce leaves only one crater per projectile', () => {
    const world = worldWithMove('blastBurn');
    world.player.invulnLeft = 99;
    world.moves[0]!.sockets = [{ augmentId: 'pierce', rank: MAX_RANK }];
    refreshStats(world);
    for (const x of [120, 180, 240, 300]) spawnEnemy(world, 'raticate', x, 0, 20).speed = 0;
    step(world, IDLE, DT);
    world.moves[0]!.cooldownLeft = 999;
    run(world, 1);
    expect(world.enemies.filter((e) => e.hp < e.maxHp).length).toBeGreaterThanOrEqual(3); // it pierced
    expect(world.zones).toHaveLength(1);
  });

  it('a new augment on a full move opens the replace window; Back returns to the same cards', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [
      { augmentId: 'powerUp', rank: 2 },
      { augmentId: 'multishot', rank: 1 },
      { augmentId: 'velocity', rank: 1 },
    ];
    const cards = [{ augmentId: 'pierce' as const, rank: 1 }];
    world.level = 3;
    world.pendingLevelUps = 1;
    world.offer = { kind: 'augment', slot: 0, cards, skills: [0], drawn: {} };
    chooseAugment(world, 0);
    expect(world.offer).toEqual({ kind: 'replace', slot: 0, card: cards[0], cards, skills: [0], drawn: {} });
    backFromReplace(world);
    expect(world.offer).toEqual({ kind: 'augment', slot: 0, cards, skills: [0], drawn: {} });
    expect(world.pendingLevelUps).toBe(1);
  });

  it('replacing puts the new augment at rank I in the chosen socket', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [
      { augmentId: 'powerUp', rank: 3 },
      { augmentId: 'multishot', rank: 1 },
      { augmentId: 'velocity', rank: 1 },
    ];
    world.level = 3;
    world.pendingLevelUps = 1;
    world.offer = { kind: 'replace', slot: 0, card: { augmentId: 'pierce', rank: 1 }, cards: [], skills: [0], drawn: {} };
    chooseReplace(world, 0);
    expect(world.moves[0]!.sockets).toEqual([
      { augmentId: 'pierce', rank: 1 },
      { augmentId: 'multishot', rank: 1 },
      { augmentId: 'velocity', rank: 1 },
    ]);
    expect(world.moves[0]!.stats.pierce).toBe(1);
    expect(world.offer).toBeNull();
  });

  it('every augment window holds at least one behaviour/exclusive card when available', () => {
    const world = makeWorld({ seed: 123 });
    for (let i = 0; i < 300; i++) {
      const offer = makeAugmentOffer(world, 0);
      if (offer.kind !== 'augment') throw new Error('expected augment offer');
      expect(offer.cards).toHaveLength(3);
      expect(new Set(offer.cards.map((c) => c.augmentId)).size).toBe(3);
      expect(offer.cards.some((c) => isSpecialAugment(c.augmentId))).toBe(true);
    }
  });

  it('STAB: moves sharing a type with the Pokémon get +20%', () => {
    const world = makeWorld();
    world.moves.push(createSlot('scratch'));
    refreshStats(world);
    expect(world.moves[0]!.stats.damage).toBeCloseTo(MOVES.ember.damage * STAB); // Fire on Fire
    expect(world.moves[1]!.stats.damage).toBeCloseTo(MOVES.scratch.damage); // Normal on Fire
  });

  it('Flying moves only appear on cards from Charizard, and get STAB there', () => {
    const world = makeWorld();
    const flyingCards = () =>
      buildCardPool(world).filter((c) => c.kind === 'move' && (c.moveId === 'airSlash' || c.moveId === 'hurricane'));
    expect(flyingCards()).toHaveLength(0);
    evolveTo(world, 1);
    world.evolution = null;
    expect(flyingCards()).toHaveLength(0);
    evolveTo(world, 2);
    expect(stages[2]!.types).toContain('Flying');
    expect(flyingCards()).toHaveLength(2);
    world.moves.push(createSlot('airSlash'));
    refreshStats(world);
    expect(world.moves.at(-1)!.stats.damage).toBeCloseTo(MOVES.airSlash.damage * stages[2]!.damageMult * STAB);
  });

  it('Charizard asks for a trait; the card cannot be dismissed until one is chosen', () => {
    const world = makeWorld();
    // Read through a getter: evolveTo reassigns world.evolution behind TypeScript's narrowing.
    const evolution = () => world.evolution;
    evolveTo(world, 1);
    expect(evolution()?.traitChoices).toBeNull();
    world.evolution = null;
    evolveTo(world, 2);
    expect(evolution()?.traitChoices).toEqual(['blazePlus', 'solarPower']);
    dismissEvolution(world);
    expect(evolution()).not.toBeNull();
    chooseEvolutionTrait(world, 0);
    expect(world.player.ability).toBe('blazePlus');
    expect(world.evolution).toBeNull();
  });

  it('Blaze+ kicks in below 40% HP with +70%', () => {
    const world = makeWorld();
    world.player.ability = 'blazePlus';
    world.player.hp = world.player.maxHp * 0.35;
    expect(isAbilityActive(world)).toBe(true);
    expect(abilityDamageMult(world)).toBeCloseTo(1.7);
  });

  it('Solar Power: Fire moves +30% on top of STAB, and drains HP but never below 1', () => {
    const world = makeWorld();
    world.player.ability = 'solarPower';
    refreshStats(world);
    expect(world.moves[0]!.stats.damage).toBeCloseTo(MOVES.ember.damage * (1 + TUNING.stabBonus + 0.3));
    expect(isAbilityActive(world)).toBe(false);
    world.moves = [];
    world.player.hp = 3;
    run(world, 5);
    expect(world.player.hp).toBe(1);
  });
});

describe('P3 re-playtest revisions (D12)', () => {
  it('Return costs 30% damage', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [{ augmentId: 'boomerang', rank: 1 }];
    refreshStats(world);
    expect(world.moves[0]!.stats.damage).toBeCloseTo(MOVES.ember.damage * 0.7 * STAB);
  });

  it('Back from the augment cards returns to move selection, and the same move shows the same cards', () => {
    const world = makeWorld();
    world.moves.push(createSlot('scratch'));
    world.level = 3;
    world.pendingLevelUps = 1;
    world.offer = makeOffer(world);
    chooseSkill(world, 0);
    const first = world.offer;
    if (first?.kind !== 'augment') throw new Error('expected augment offer');
    backToSkills(world);
    expect(world.offer?.kind).toBe('pickSkill');
    chooseSkill(world, 1); // look at another move…
    backToSkills(world);
    chooseSkill(world, 0); // …and come back: no free reroll
    const again = world.offer;
    if (again?.kind !== 'augment') throw new Error('expected augment offer');
    expect(again.cards).toEqual(first.cards);
    expect(world.pendingLevelUps).toBe(1);
  });

  it('a reroll replaces the remembered cards for that move', () => {
    const world = makeWorld();
    world.level = 3;
    world.pendingLevelUps = 1;
    world.offer = makeOffer(world);
    chooseSkill(world, 0);
    expect(rerollAugments(world)).toBe(true);
    const rerolled = world.offer;
    if (rerolled?.kind !== 'augment') throw new Error('expected augment offer');
    backToSkills(world);
    chooseSkill(world, 0);
    expect(world.offer?.kind === 'augment' && world.offer.cards).toEqual(rerolled.cards);
  });

  it('Oran Berries drop by chance, are not magnetized, and heal when walked over', () => {
    const world = makeWorld();
    world.moves = [];
    maybeDropBerry(world, 60, 0, 1);
    maybeDropBerry(world, 60, 0, 0);
    expect(world.berries).toHaveLength(1);
    world.player.hp = 50;
    run(world, 0.5); // berry is outside reach: nothing happens
    expect(world.berries).toHaveLength(1);
    expect(world.player.hp).toBe(50);
    run(world, 0.5, { moveX: 1, moveY: 0 });
    expect(world.berries).toHaveLength(0);
    expect(world.player.hp).toBe(50 + TUNING.heal.berryHeal);
  });

  it('berries respect their budget', () => {
    const world = makeWorld();
    for (let i = 0; i < TUNING.heal.maxBerries + 5; i++) maybeDropBerry(world, 1000 + i * 20, 0, 1);
    expect(world.berries).toHaveLength(TUNING.heal.maxBerries);
  });

  it('Raticate drops berries far more often than Rattata', () => {
    expect(ENEMIES.raticate.berryChance).toBeGreaterThan(ENEMIES.rattata.berryChance * 10);
  });

  it('Glass on a non-signature move still raises damage taken', () => {
    const world = makeWorld();
    const spin = createSlot('fireSpin');
    spin.sockets = [{ augmentId: 'glass', rank: 1 }];
    world.moves = [spin];
    refreshStats(world);
    expect(world.mods.damageTakenMult).toBeCloseTo(1.1);
    world.moves = [];
    const enemy = spawnEnemy(world, 'rattata', 0, 0);
    step(world, IDLE, DT);
    expect(world.player.hp).toBeCloseTo(world.player.maxHp - enemy.contactDamage * 1.1);
  });
});

describe('P4a engine: statuses, abilities, zone-cast, chain', () => {
  function still(world: World, kind: EnemyId, x: number, y: number, hpScale = 10) {
    const e = spawnEnemy(world, kind, x, y, hpScale);
    e.speed = 0;
    return e;
  }

  it('slow scales enemy movement for its duration', () => {
    const world = makeWorld();
    world.moves = [];
    const normal = spawnEnemy(world, 'rattata', 1000, 0);
    const slowed = spawnEnemy(world, 'rattata', 1000, 300);
    applyStatuses(slowed, { slow: 0.5, stun: 0, poisonDps: 0 });
    run(world, 1);
    const moved = (e: { x: number; y: number }, x0: number, y0: number) => Math.hypot(e.x - x0, e.y - y0);
    expect(moved(slowed, 1000, 300) / moved(normal, 1000, 0)).toBeCloseTo(0.5, 1);
  });

  it('stunned enemies neither move nor deal contact damage', () => {
    const world = makeWorld();
    world.moves = [];
    const e = spawnEnemy(world, 'rattata', 0, 0);
    applyStatuses(e, { slow: 0, stun: 2, poisonDps: 0 });
    run(world, 1);
    expect(world.player.hp).toBe(world.player.maxHp);
    expect(e.x).toBe(0);
  });

  it('poison ticks dps × 3 s, like burn', () => {
    const world = makeWorld();
    const e = still(world, 'raticate', 500, 0);
    applyStatuses(e, { slow: 0, stun: 0, poisonDps: 4 });
    const before = e.hp;
    for (let i = 0; i < Math.round(TUNING.status.poisonSeconds / DT) + 30; i++) updateStatuses(world, DT);
    expect(before - e.hp).toBeCloseTo(4 * TUNING.status.poisonSeconds, 0);
  });

  it('Shell blocks one contact hit, then recharges', () => {
    const world = makeWorld();
    world.moves = [];
    world.player.ability = 'shell';
    refreshStats(world);
    const e = spawnEnemy(world, 'rattata', 0, 0);
    step(world, IDLE, DT);
    expect(world.player.hp).toBe(world.player.maxHp);
    expect(world.player.blockReadyLeft).toBeGreaterThan(7);
    run(world, TUNING.player.invulnSeconds + 0.1);
    expect(world.player.hp).toBe(world.player.maxHp - e.contactDamage);
  });

  it('Shell Armor cuts damage taken by 15%', () => {
    const world = makeWorld();
    world.moves = [];
    world.player.ability = 'shellArmor';
    refreshStats(world);
    const e = spawnEnemy(world, 'rattata', 0, 0);
    step(world, IDLE, DT);
    expect(world.player.hp).toBeCloseTo(world.player.maxHp - e.contactDamage * 0.85);
  });

  it('Static paralyses enemies that touch the player', () => {
    const world = makeWorld();
    world.moves = [];
    world.player.ability = 'static';
    refreshStats(world);
    const e = spawnEnemy(world, 'rattata', 0, 0);
    step(world, IDLE, DT);
    expect(e.stunLeft).toBeGreaterThan(0.9);
  });

  it('Leech gives every move lifesteal; Chlorophyll adds speed and cuts cooldowns; Rain Dish regenerates', () => {
    const world = makeWorld();
    world.moves.push(createSlot('scratch'));
    world.player.ability = 'leech';
    refreshStats(world);
    expect(world.moves.every((s) => s.stats.lifesteal === 0.03)).toBe(true);

    world.player.ability = 'chlorophyll';
    refreshStats(world);
    expect(world.player.speed).toBeCloseTo(POKEMON.charmander.stages[0]!.speed * 1.15);
    expect(world.moves[0]!.stats.cooldown).toBeCloseTo(MOVES.ember.cooldown * 0.9);

    world.player.ability = 'rainDish';
    refreshStats(world);
    expect(world.mods.regenPerSec).toBeCloseTo(1.5);
  });

  it('a zone-cast move drops a status zone on the nearest enemy that ticks its effects', () => {
    const world = makeWorld();
    const target = still(world, 'raticate', 120, 40);
    const slot = createSlot('ember');
    slot.stats.poisonPct = 0.5;
    const def = { ...MOVES.ember, form: 'zone', range: 300, radius: 50, duration: 2, tickInterval: 0.5 } as unknown as ZoneMoveDef;
    expect(castZone(world, slot, def)).toBe(true);
    expect(world.zones).toHaveLength(1);
    expect(world.zones[0]!.x).toBe(120);
    expect(world.zones[0]!.poisonDps).toBeGreaterThan(0);
    world.moves = [];
    run(world, 0.6);
    expect(target.poisonLeft).toBeGreaterThan(0);
    expect(target.hp).toBeLessThan(target.maxHp);
  });

  it('innate chain jumps to nearby enemies, never back, up to its jump count', () => {
    const world = makeWorld();
    world.player.invulnLeft = 99;
    const a = still(world, 'raticate', 100, 0);
    const b = still(world, 'raticate', 100, 90);
    const c = still(world, 'raticate', 100, 180);
    const d = still(world, 'raticate', 100, 270);
    const slot = createSlot('ember');
    const def = { ...MOVES.ember, chain: { jumps: 2, damageFraction: 0.5 } } as ProjectileMoveDef;
    world.moves = [];
    expect(castProjectile(world, slot, def)).toBe(true);
    run(world, 0.5);
    expect(a.hp).toBeCloseTo(a.maxHp - slot.stats.damage);
    expect(b.hp).toBeCloseTo(b.maxHp - slot.stats.damage * 0.5);
    expect(c.hp).toBeCloseTo(c.maxHp - slot.stats.damage * 0.5);
    expect(d.hp).toBe(d.maxHp);
  });

  it('a 360° melee swing hits enemies behind as well', () => {
    const world = makeWorld();
    const front = still(world, 'raticate', 40, 0);
    const behind = still(world, 'raticate', -45, 0);
    const slot = createSlot('scratch');
    const def = { ...MOVES.scratch, arcDegrees: 360 } as MeleeMoveDef;
    world.moves = [];
    step(world, IDLE, DT); // builds the spatial hash the swing queries
    expect(castMelee(world, slot, def)).toBe(true);
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(behind.hp).toBeLessThan(behind.maxHp);
  });
});

describe('every line (data rules)', () => {
  for (const def of Object.values(POKEMON)) {
    it(`${def.stages[0]!.name}: stages rise and each signature tier only adds tags`, () => {
      for (let i = 1; i < def.stages.length; i++) {
        const [a, b] = [def.stages[i - 1]!, def.stages[i]!];
        expect(b.level).toBeGreaterThan(a.level);
        expect(b.maxHp).toBeGreaterThan(a.maxHp);
        expect(b.damageMult).toBeGreaterThan(a.damageMult);
        const before = MOVES[a.signatureMove].tags;
        const after = MOVES[b.signatureMove].tags;
        for (const tag of before) expect(after).toContain(tag);
      }
      const last = def.stages[def.stages.length - 1]!;
      if (def.stages.length > 1) expect(last.abilityChoices?.length).toBe(2); // D13: every evolving line picks a trait
    });
  }
});

describe('Squirtle line (P4b, redesigned D14)', () => {
  function squirtle(): World {
    return createWorld({ rng: createSeededRng(3), spawnRadius: 600, spawnEnabled: false, pokemonId: 'squirtle' });
  }
  function still(world: World, x: number, y: number, kind: EnemyId = 'raticate') {
    const e = spawnEnemy(world, kind, x, y, 10);
    e.speed = 0;
    return e;
  }

  it('starts as Squirtle with Shell and Bubble, tankier than Charmander', () => {
    const world = squirtle();
    expect(currentStage(world).name).toBe('Squirtle');
    expect(world.player.ability).toBe('shell');
    expect(world.moves[0]!.moveId).toBe('bubble');
    expect(world.player.maxHp).toBeGreaterThan(POKEMON.charmander.stages[0]!.maxHp);
  });

  it('Bubble slows what it hits', () => {
    const world = squirtle();
    world.player.invulnLeft = 99;
    const target = still(world, 150, 0);
    run(world, 0.8);
    expect(target.slowLeft).toBeGreaterThan(0);
    expect(target.slow).toBeCloseTo(0.35);
  });

  it('Water Pulse staggers (small push), slows and splashes', () => {
    const world = squirtle();
    world.player.invulnLeft = 99;
    world.moves = [createSlot('waterPulse')];
    refreshStats(world);
    expect(world.moves[0]!.stats.knockback).toBe(15);
    const target = still(world, 150, 0);
    const nearby = still(world, 150, 30);
    run(world, 0.9);
    expect(target.x).toBeGreaterThan(150);
    expect(target.x).toBeLessThan(150 + 15);
    expect(nearby.hp).toBeLessThan(nearby.maxHp);
  });

  it("Blastoise's trait options both keep Shell", () => {
    const last = POKEMON.squirtle.stages[2]!;
    for (const id of last.abilityChoices!) expect(ABILITIES[id].blockEvery).toBe(8);
  });

  it('Withdraw bashes all around (stagger + brief stun); Water Gun hits along its line', () => {
    const world = squirtle();
    world.player.invulnLeft = 99;
    world.moves = [createSlot('withdraw'), createSlot('waterGun')];
    refreshStats(world);
    const front = still(world, 30, 0);
    const behind = still(world, -35, 0);
    const far = still(world, 200, 0);
    step(world, IDLE, DT);
    step(world, IDLE, DT);
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(behind.hp).toBeLessThan(behind.maxHp);
    expect(behind.stunLeft).toBeGreaterThan(0);
    expect(far.hp).toBeLessThan(far.maxHp); // Water Gun beam reaches it
  });

  it('Whirlpool drops a strongly slowing zone on the nearest enemy', () => {
    const world = squirtle();
    world.player.invulnLeft = 99;
    world.moves = [createSlot('whirlpool')];
    refreshStats(world);
    const target = still(world, 160, 0);
    step(world, IDLE, DT);
    expect(world.zones).toHaveLength(1);
    run(world, 0.6);
    expect(target.slow).toBeCloseTo(0.6);
    expect(target.hp).toBeLessThan(target.maxHp);
  });

  it('Flash Cannon pierces two enemies on its own', () => {
    const world = squirtle();
    world.player.invulnLeft = 99;
    world.moves = [createSlot('flashCannon')];
    refreshStats(world);
    const line = [100, 160, 220, 280].map((x) => still(world, x, 0));
    step(world, IDLE, DT);
    world.moves[0]!.cooldownLeft = 999;
    run(world, 0.8);
    expect(line.filter((e) => e.hp < e.maxHp)).toHaveLength(3); // the first + 2 pierced
  });

  it('cards: five Water-themed moves; Hydro Pump and Flash Cannon only as Blastoise', () => {
    const world = squirtle();
    const moveCards = () =>
      buildCardPool(world)
        .filter((c) => c.kind === 'move')
        .map((c) => (c.kind === 'move' ? c.moveId : ''))
        .sort();
    expect(moveCards()).toEqual(['rapidSpin', 'surf', 'waterGun', 'whirlpool', 'withdraw']);
    world.player.stage = 2;
    expect(moveCards()).toEqual(['flashCannon', 'hydroPump', 'rapidSpin', 'surf', 'waterGun', 'whirlpool', 'withdraw']);
  });
});

describe('Bulbasaur line (P4c)', () => {
  function bulbasaur(): World {
    return createWorld({ rng: createSeededRng(5), spawnRadius: 600, spawnEnabled: false, pokemonId: 'bulbasaur' });
  }
  function still(world: World, x: number, y: number, kind: EnemyId = 'raticate') {
    const e = spawnEnemy(world, kind, x, y, 10);
    e.speed = 0;
    return e;
  }

  it('starts as Grass/Poison Bulbasaur with Leech (3% lifesteal on every move) and Vine Whip', () => {
    const world = bulbasaur();
    expect(currentStage(world).types).toEqual(['Grass', 'Poison']);
    expect(world.player.ability).toBe('leech');
    expect(world.moves[0]!.moveId).toBe('vineWhip');
    expect(world.moves[0]!.stats.lifesteal).toBeCloseTo(0.03);
  });

  it('Vine Whip lashes in front only; Power Whip sweeps all around', () => {
    const world = bulbasaur();
    world.player.invulnLeft = 99;
    const front = still(world, 60, 0);
    const behind = still(world, -65, 0);
    step(world, IDLE, DT);
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(behind.hp).toBe(behind.maxHp);

    world.moves = [createSlot('powerWhip')];
    refreshStats(world);
    step(world, IDLE, DT);
    expect(behind.hp).toBeLessThan(behind.maxHp);
  });

  it('Frenzy Plant leaves a slowing root field on its target', () => {
    const world = bulbasaur();
    world.player.invulnLeft = 99;
    world.moves = [createSlot('frenzyPlant')];
    refreshStats(world);
    const target = still(world, 90, 0);
    step(world, IDLE, DT);
    expect(world.zones).toHaveLength(1);
    expect(world.zones[0]!.x).toBe(90);
    expect(world.zones[0]!.slow).toBeCloseTo(0.4);
    run(world, 0.6);
    expect(target.slowLeft).toBeGreaterThan(0);
  });

  it('Leech Seed drains over 4 s and heals the player half the damage', () => {
    const world = bulbasaur();
    world.moves = [];
    world.player.ability = 'blaze'; // isolate the seed's own healing from Leech
    refreshStats(world);
    world.player.hp = 50;
    const target = still(world, 500, 0);
    damageEnemy(world, target, 4, { ...NO_HIT, seedDps: 6 });
    const afterHit = target.hp;
    for (let i = 0; i < Math.round(TUNING.status.seedSeconds / DT) + 30; i++) updateStatuses(world, DT);
    const drained = afterHit - target.hp;
    expect(drained).toBeCloseTo(6 * TUNING.status.seedSeconds, 0);
    expect(world.player.hp).toBeCloseTo(50 + drained * TUNING.status.seedHealFraction, 0);
  });

  it('Poison Powder poisons and Sleep Powder puts enemies to sleep', () => {
    const world = bulbasaur();
    world.player.invulnLeft = 99;
    world.moves = [createSlot('poisonPowder')];
    refreshStats(world);
    const a = still(world, 150, 0);
    step(world, IDLE, DT);
    run(world, 0.6);
    expect(a.poisonLeft).toBeGreaterThan(0);

    const world2 = bulbasaur();
    world2.player.invulnLeft = 99;
    world2.moves = [createSlot('sleepPowder')];
    refreshStats(world2);
    const b = still(world2, 150, 0);
    step(world2, IDLE, DT);
    run(world2, 0.6);
    expect(b.stunLeft).toBeGreaterThan(0);
  });

  it('Solar Beam appears on cards only as Venusaur', () => {
    const world = bulbasaur();
    const hasSolar = () => buildCardPool(world).some((c) => c.kind === 'move' && c.moveId === 'solarBeam');
    expect(hasSolar()).toBe(false);
    world.player.stage = 2;
    expect(hasSolar()).toBe(true);
  });

  it('Grass is not very effective on Pidgey (Normal/Flying), so Razor Leaf hits it for ×0.5', () => {
    const world = bulbasaur();
    const pidgey = still(world, 500, 0, 'pidgey');
    damageEnemy(world, pidgey, 10, makeHitInfo(createSlot('razorLeaf').stats));
    expect(pidgey.lastEffectiveness).toBe(0.5);
  });
});

describe('Pikachu line (P4d)', () => {
  function pikachu(): World {
    return createWorld({ rng: createSeededRng(7), spawnRadius: 600, spawnEnabled: false, pokemonId: 'pikachu' });
  }
  function still(world: World, x: number, y: number, kind: EnemyId = 'raticate') {
    const e = spawnEnemy(world, kind, x, y, 10);
    e.speed = 0;
    return e;
  }

  it('starts as Electric Pikachu with Static and Thunder Shock, and evolves once at Lv 16 with a trait pick', () => {
    const world = pikachu();
    expect(currentStage(world).types).toEqual(['Electric']);
    expect(world.player.ability).toBe('static');
    expect(world.moves[0]!.moveId).toBe('thunderShock');
    world.level = 15;
    expect(dueEvolutionStage(world)).toBeNull();
    world.level = 16;
    expect(dueEvolutionStage(world)).toBe(1);
    expect(POKEMON.pikachu.stages[1]!.abilityChoices).toEqual(['staticPlus', 'lightningRod']);
  });

  it('Thunder Shock jumps to 2 more enemies; Thunderbolt to 3', () => {
    for (const [moveId, jumps] of [
      ['thunderShock', 2],
      ['thunderbolt', 3],
    ] as const) {
      const world = pikachu();
      world.player.invulnLeft = 99;
      // A column 90 px apart: inside chain range, outside Thunderbolt's burst.
      const row = [0, 90, 180, 270, 360].map((y) => still(world, 100, y));
      const slot = createSlot(moveId);
      world.moves = [];
      expect(castProjectile(world, slot, MOVES[moveId] as ProjectileMoveDef)).toBe(true);
      run(world, 0.5);
      expect(row.filter((e) => e.hp < e.maxHp)).toHaveLength(1 + jumps);
      expect(row[jumps + 1]!.hp).toBe(row[jumps + 1]!.maxHp);
      if (moveId === 'thunderShock') expect(row[1]!.hp).toBeCloseTo(row[1]!.maxHp - slot.stats.damage * 0.7);
    }
  });

  it('Thunder is Raichu-only and strikes half a second later, paralysing', () => {
    const world = pikachu();
    const hasThunder = () => buildCardPool(world).some((c) => c.kind === 'move' && c.moveId === 'thunder');
    expect(hasThunder()).toBe(false);
    world.player.stage = 1;
    expect(hasThunder()).toBe(true);

    world.player.invulnLeft = 99;
    world.moves = [createSlot('thunder')];
    refreshStats(world);
    const target = still(world, 150, 0);
    step(world, IDLE, DT);
    expect(world.zones).toHaveLength(1);
    expect(target.hp).toBe(target.maxHp);
    run(world, 0.55);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(target.stunLeft).toBeGreaterThan(0);
  });
});

describe('Lapras (P4d, non-evolver)', () => {
  function lapras(): World {
    return createWorld({ rng: createSeededRng(9), spawnRadius: 600, spawnEnabled: false, pokemonId: 'lapras' });
  }

  it('starts strongest: tougher and harder-hitting than Charmander, Shell Armor, never evolves', () => {
    const world = lapras();
    const charmander = POKEMON.charmander.stages[0]!;
    expect(currentStage(world).types).toEqual(['Water', 'Ice']);
    expect(world.player.maxHp).toBeGreaterThan(charmander.maxHp);
    expect(currentStage(world).damageMult).toBeGreaterThan(charmander.damageMult);
    expect(world.player.ability).toBe('shellArmor');
    expect(world.mods.damageTakenMult).toBeCloseTo(0.85);
    world.level = 40;
    expect(dueEvolutionStage(world)).toBeNull();
  });

  it('the signature tiers up at Lv 10 and Lv 25, keeping its augments, and tells the scene', () => {
    const world = lapras();
    world.moves[0]!.sockets.push({ augmentId: 'powerUp', rank: 2 });
    expect(world.moves[0]!.moveId).toBe('iceShard');
    world.level = 9;
    expect(upgradeSignatureByLevel(world)).toBe(false);
    world.level = 10;
    expect(upgradeSignatureByLevel(world)).toBe(true);
    expect(world.moves[0]!.moveId).toBe('frostBreath');
    expect(world.moves[0]!.sockets).toEqual([{ augmentId: 'powerUp', rank: 2 }]);
    expect(world.signatureTierUp).toEqual({ from: 'iceShard', to: 'frostBreath' });
    world.level = 30; // a big XP jump still lands on the right tier
    upgradeSignatureByLevel(world);
    expect(world.moves[0]!.moveId).toBe('sheerCold');
    for (const tag of MOVES.frostBreath.tags) expect(MOVES.sheerCold.tags).toContain(tag);
  });

  it('tiers up during play as soon as the level is reached', () => {
    const world = lapras();
    gainXp(world, 1000);
    step(world, IDLE, DT);
    expect(world.moves[0]!.moveId).not.toBe('iceShard');
  });

  it("Sheer Cold's freezing field slows; Ice is super effective on Pidgey", () => {
    const world = lapras();
    world.player.invulnLeft = 99;
    world.moves = [createSlot('sheerCold')];
    refreshStats(world);
    const target = spawnEnemy(world, 'raticate', 120, 0, 10);
    target.speed = 0;
    run(world, 0.5);
    expect(world.zones.length).toBeGreaterThan(0);
    expect(world.zones[0]!.slow).toBeCloseTo(0.5);

    const pidgey = spawnEnemy(world, 'pidgey', 500, 500, 10);
    damageEnemy(world, pidgey, 1, makeHitInfo(createSlot('iceShard').stats));
    expect(pidgey.lastEffectiveness).toBe(2);
  });
});

describe('type chart and weight (D14)', () => {
  it('core matchups, dual types multiply, immunities soften to ×0.5', () => {
    expect(effectiveness('Water', ['Fire'])).toBe(2);
    expect(effectiveness('Fire', ['Water'])).toBe(0.5);
    expect(effectiveness('Fire', ['Normal'])).toBe(1);
    expect(effectiveness('Electric', ['Normal', 'Flying'])).toBe(2); // Pidgey
    expect(effectiveness('Grass', ['Normal', 'Flying'])).toBe(0.5);
    expect(effectiveness('Ice', ['Grass', 'Flying'])).toBe(4);
    expect(effectiveness('Poison', ['Steel'])).toBe(0.5); // immune in the games
    expect(effectiveness(null, ['Fire'])).toBe(1);
  });

  it("a move's attack type is its first Pokémon-type tag", () => {
    expect(moveType(MOVES.hydroCannon.tags)).toBe('Water');
    expect(moveType(MOVES.flashCannon.tags)).toBe('Steel');
  });

  it('damage uses the chart, and the hit records its effectiveness for the flash', () => {
    const world = makeWorld();
    const pidgey = spawnEnemy(world, 'pidgey', 500, 0, 10);
    damageEnemy(world, pidgey, 10, { ...NO_HIT, attackType: 'Electric' });
    expect(pidgey.hp).toBeCloseTo(pidgey.maxHp - 20);
    expect(pidgey.lastEffectiveness).toBe(2);
    const before = pidgey.hp;
    damageEnemy(world, pidgey, 10, { ...NO_HIT, attackType: 'Grass' });
    expect(before - pidgey.hp).toBeCloseTo(5);
    expect(pidgey.lastEffectiveness).toBe(0.5);
  });

  it('heavier enemies are pushed less', () => {
    const world = makeWorld();
    const rattata = spawnEnemy(world, 'rattata', 500, 0, 10);
    const raticate = spawnEnemy(world, 'raticate', 500, 300, 10);
    for (const e of [rattata, raticate]) damageEnemy(world, e, 1, { ...NO_HIT, knockback: 20, dirX: 1, dirY: 0 });
    expect(raticate.kbX).toBeLessThan(rattata.kbX);
    expect(knockbackResistance(ENEMIES.pidgey.weightKg)).toBeLessThan(0.1);
    expect(knockbackResistance(460)).toBeGreaterThan(0.9); // Snorlax
  });
});

describe('kit rules (§4.1, D14)', () => {
  for (const def of Object.values(POKEMON)) {
    it(`${def.stages[0]!.name}: mostly own-type moves, and the final stage unlocks moves`, () => {
      const lineTypes = new Set(def.stages.flatMap((s) => s.types));
      const types = def.learnset.map((e) => moveType(MOVES[e.move].tags));
      const ownType = types.filter((t) => t !== null && lineTypes.has(t)).length;
      expect(ownType * 2).toBeGreaterThanOrEqual(types.length);
      expect(types.filter((t) => t === 'Normal').length).toBeLessThanOrEqual(1);
      if (def.stages.length > 1) {
        const last = def.stages.length - 1;
        expect(def.learnset.some((e) => e.fromStage === last)).toBe(true);
      }
    });
  }
});

describe('Blaze', () => {
  it('turns on below 30% HP and adds +50% damage to hits', () => {
    const world = makeWorld();
    world.player.hp = world.player.maxHp * 0.5;
    expect(isAbilityActive(world)).toBe(false);
    expect(abilityDamageMult(world)).toBe(1);

    world.player.hp = world.player.maxHp * 0.29;
    expect(isAbilityActive(world)).toBe(true);
    const enemy = spawnEnemy(world, 'raticate', 500, 0);
    damageEnemy(world, enemy, 10);
    expect(enemy.hp).toBeCloseTo(enemy.maxHp - 15);
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
