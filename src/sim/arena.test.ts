import { describe, expect, it } from 'vitest';
import { ARENA_BOSSES, ARENA_TUNING } from '../data/arena';
import { ENEMIES, TUNING } from '../data/content';
import { arenaBossChoices, arenaSchedule, chooseArenaReward, resolveArena, rollRewardCards } from './arena';
import { createSeededRng } from './rng';
import type { World } from './types';
import { createWorld, spawnEnemy, step, waveAt } from './world';

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };

/** Spawns on (arena events need the director) but no horde arrives during a test. */
function makeWorld(seed = 1): World {
  const world = createWorld({ rng: createSeededRng(seed), spawnEnabled: true, mapSeed: seed });
  world.spawnTimer = 1e9;
  return world;
}

function openFirstEntrance(world: World): void {
  world.time = world.arenaSchedule[0]!;
  step(world, IDLE, DT);
}

function enter(world: World): void {
  openFirstEntrance(world);
  const e = world.entrance!;
  world.player.x = e.x;
  world.player.y = e.y;
  step(world, IDLE, DT);
}

describe('arena events (D28): schedule and entrance', () => {
  it('4 seeded events per run, each ending (open + fight) before the run does', () => {
    const times = arenaSchedule(42);
    expect(times).toEqual(arenaSchedule(42));
    expect(times).toHaveLength(4);
    times.forEach((t, i) => {
      expect(Math.abs(t - ARENA_TUNING.eventTimes[i]!)).toBeLessThanOrEqual(ARENA_TUNING.jitter);
      const latestEnd = t + ARENA_TUNING.openSeconds + ARENA_TUNING.engageAfter + ARENA_BOSSES.snorlax.timeLimit;
      expect(latestEnd).toBeLessThan(TUNING.runSeconds);
    });
  });

  it('opens an entrance near the player at the event time, with a notice; none with spawns off', () => {
    const world = makeWorld();
    openFirstEntrance(world);
    const e = world.entrance!;
    const d = Math.hypot(e.x - world.player.x, e.y - world.player.y);
    expect(d).toBeGreaterThanOrEqual(ARENA_TUNING.entranceDistance.min - 1);
    expect(d).toBeLessThanOrEqual(ARENA_TUNING.entranceDistance.max + 1);
    expect(world.arenaNotice).toEqual({ kind: 'opened', bossId: e.bossId });

    const quiet = createWorld({ rng: createSeededRng(1), spawnEnabled: false });
    quiet.time = quiet.arenaSchedule[0]!;
    step(quiet, IDLE, DT);
    expect(quiet.entrance).toBeNull();
  });

  it('closes after its open time if nobody enters (missed), and the next event comes later', () => {
    const world = makeWorld();
    openFirstEntrance(world);
    world.time = world.entrance!.closesAt;
    step(world, IDLE, DT);
    expect(world.entrance).toBeNull();
    expect(world.arenaNotice?.kind).toBe('missed');
    expect(world.arenaEventsDone).toBe(1);
  });

  it('the first event never draws a boss that resists the starter (pool: every boss fair for every line)', () => {
    for (const pokemonId of ['charmander', 'squirtle', 'bulbasaur', 'pikachu', 'lapras'] as const) {
      const world = createWorld({ rng: createSeededRng(1), pokemonId });
      expect(arenaBossChoices(world).length).toBeGreaterThan(0);
    }
  });
});

describe('arena events (D28): the fight', () => {
  it('entering stores the main map and puts a waiting, wave-scaled boss in the middle', () => {
    const world = makeWorld();
    const mob = spawnEnemy(world, 'rattata', 300, 0);
    enter(world);
    const fight = world.arena!;
    expect(world.enemies.some((e) => e.id === mob.id)).toBe(false);
    const boss = world.enemies.find((e) => e.id === fight.bossEnemyId)!;
    const wave = waveAt(world.time);
    expect(boss.maxHp).toBeCloseTo(ENEMIES.snorlax.maxHp * wave.hpScale);
    expect(boss.contactDamage).toBeCloseTo(ENEMIES.snorlax.contactDamage * wave.damageScale);
    expect(boss.speed).toBe(0);
    expect(fight.engaged).toBe(false);
  });

  it('the boss engages when you walk in; the timer only runs from then; you cannot leave the arena', () => {
    const world = makeWorld();
    enter(world);
    const fight = world.arena!;
    step(world, IDLE, DT);
    expect(fight.timeLeft).toBe(ARENA_BOSSES.snorlax.timeLimit);
    world.player.x = fight.x;
    world.player.y = fight.y + ARENA_TUNING.engageDistance - 10;
    step(world, IDLE, DT);
    expect(fight.engaged).toBe(true);
    step(world, IDLE, DT);
    expect(fight.timeLeft).toBeLessThan(ARENA_BOSSES.snorlax.timeLimit);
    world.player.x = fight.x + 5000;
    step(world, IDLE, DT);
    expect(Math.hypot(world.player.x - fight.x, world.player.y - fight.y)).toBeLessThanOrEqual(fight.radius);
  });

  it('beating the boss restores the map and opens a mixed reward pick that applies', () => {
    const world = makeWorld();
    const mob = spawnEnemy(world, 'rattata', 300, 0);
    enter(world);
    const stored = world.arena!.stored;
    world.enemies.find((e) => e.id === world.arena!.bossEnemyId)!.hp = 0;
    step(world, IDLE, DT);
    expect(world.arena).toBeNull();
    expect(world.enemies.some((e) => e.id === mob.id)).toBe(true);
    expect([world.player.x, world.player.y]).toEqual([stored.x, stored.y]);
    expect(world.arenaNotice?.kind).toBe('won');
    expect(world.offer?.kind).toBe('arenaReward');
    if (world.offer?.kind !== 'arenaReward') return;
    expect(world.offer.cards.length).toBeLessThanOrEqual(ARENA_TUNING.rewardCards);
    const pools = new Set(world.offer.cards.map((c) => c.pool));
    expect(pools.has('level') && pools.has('augment') && pools.has('site')).toBe(true);
    const boosts = Object.values(world.boosts).reduce((a, b) => a + b, 0);
    const level = world.offer.cards.findIndex((c) => c.pool === 'level' && c.card.kind === 'boost');
    if (level >= 0) {
      chooseArenaReward(world, level);
      expect(Object.values(world.boosts).reduce((a, b) => a + b, 0)).toBe(boosts + 1);
    }
  });

  it('running out of time sends you back with no reward', () => {
    const world = makeWorld();
    enter(world);
    world.arena!.timeLeft = 0;
    resolveArena(world);
    expect(world.arena).toBeNull();
    expect(world.offer).toBeNull();
    expect(world.arenaNotice?.kind).toBe('lost');
  });

  it('reward cards never ask to replace a full socket', () => {
    const world = makeWorld();
    world.moves[0]!.sockets = [
      { augmentId: 'powerUp', rank: 3 },
      { augmentId: 'quickCast', rank: 3 },
      { augmentId: 'enlarge', rank: 3 },
    ];
    for (let i = 0; i < 20; i++) {
      for (const c of rollRewardCards(world)) if (c.pool === 'augment') expect(c.card.rank).toBeGreaterThan(1);
    }
  });
});
