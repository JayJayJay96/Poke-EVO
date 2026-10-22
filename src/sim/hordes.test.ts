import { describe, expect, it } from 'vitest';
import { ENEMIES, TUNING } from '../data/content';
import { ABILITY_TUNING, ELITE, HORDE, HORDE_FOLLOWERS, PACING } from '../data/hordes';
import { MAX_ENEMY_RADIUS, NO_HIT, applyBlind, damageEnemy, enemyStatusMult, pushEnemy } from './combat';
import { eliteContactMult, makeElite, nextSpawnAngle, spawnRateMult } from './hordes';
import { createSeededRng } from './rng';
import type { World } from './types';
import { spawnPuddle } from './terrain';
import { createWorld, spawnEnemy, step, waveAt } from './world';

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };

/** Spawns on (hordes ride the spawner), but no normal spawns and no auto-fire during a test. */
function makeWorld(seed = 1): World {
  const world = createWorld({ rng: createSeededRng(seed), spawnEnabled: true, mapSeed: seed });
  world.spawnTimer = 1e9;
  world.moves = [];
  world.player.invulnLeft = 1e9;
  return world;
}

describe('spawn pacing (D34)', () => {
  it('pressure cycle: build-up ×1, surge ×2, a 10 s lull at ×0.35; a horde-leader lull caps it', () => {
    const world = makeWorld();
    const at = (t: number) => {
      world.time = t;
      return spawnRateMult(world);
    };
    expect(at(10)).toBe(1);
    expect(at(PACING.surgeAt + 1)).toBe(PACING.surgeRate);
    expect(at(PACING.lullAt + 1)).toBe(PACING.lullRate);
    expect(PACING.cycle - PACING.lullAt).toBe(10); // the owner's 10 s lull
    world.lullLeft = 5;
    expect(at(PACING.surgeAt + 1)).toBe(PACING.lullRate);
  });

  it('outside a surge enemies come in packs from one side; in a surge from anywhere', () => {
    const world = makeWorld();
    world.time = 5;
    const first = nextSpawnAngle(world);
    const center = world.packAngle;
    const size = world.packLeft + 1;
    expect(size).toBeGreaterThanOrEqual(PACING.pack.min);
    expect(size).toBeLessThanOrEqual(PACING.pack.max);
    const half = (PACING.pack.arcDeg * Math.PI) / 360;
    expect(Math.abs(first - center)).toBeLessThanOrEqual(half);
    for (let i = 1; i < size; i++) expect(Math.abs(nextSpawnAngle(world) - center)).toBeLessThanOrEqual(half);
    world.time = PACING.surgeAt + 1;
    const left = world.packLeft;
    nextSpawnAngle(world);
    expect(world.packLeft).toBe(left); // surges don't use packs
  });
});

describe('horde events (D34)', () => {
  function sendHorde(world: World) {
    world.time = HORDE.firstAt;
    step(world, IDLE, DT);
    const warning = world.hordeWarning!;
    expect(warning).not.toBeNull();
    for (let t = 0; t < HORDE.warning + DT; t += DT) step(world, IDLE, DT);
    const horde = world.hordes[0]!;
    const leader = world.enemies.find((e) => e.id === horde.leaderId)!;
    const followers = world.enemies.filter((e) => e.hordeId === horde.id && e.id !== leader.id);
    return { warning, leader, followers };
  }

  it('a warning, then an Elite leading its own species line at the slowest member speed', () => {
    const world = makeWorld();
    const { warning, leader, followers } = sendHorde(world);
    expect(leader.kind).toBe(warning.leader);
    expect(leader.elite).toBe(true);
    // ×6 on top of the wave's HP scale when it spawned (after the warning).
    expect(leader.maxHp / (ENEMIES[leader.kind].maxHp * ELITE.hpMult)).toBeCloseTo(waveAt(world.time).hpScale, 2);
    expect(followers.length).toBe(HORDE.followers.base + Math.floor((HORDE.firstAt / 60) * HORDE.followers.perMinute));
    for (const f of followers) {
      expect(HORDE_FOLLOWERS[leader.kind]).toContain(f.kind);
      expect(f.elite).toBe(false);
      expect(f.speed).toBeCloseTo(leader.speed);
    }
    expect(world.hordeWarning).toBeNull();
    expect(world.nextHordeAt).toBe(HORDE.firstAt + HORDE.every);
  });

  it('when the leader falls the pack flees until far enough, then fights again; a lull follows', () => {
    const world = makeWorld();
    const { leader, followers } = sendHorde(world);
    // The fight is close: a follower is next to you when the leader falls.
    const f = followers[0]!;
    f.x = world.player.x + 100;
    f.y = world.player.y;
    const dist = () => Math.hypot(f.x - world.player.x, f.y - world.player.y);
    damageEnemy(world, leader, 1e9);
    step(world, IDLE, DT);
    expect(world.lullLeft).toBeGreaterThan(0);
    expect(spawnRateMult(world)).toBeLessThanOrEqual(PACING.lullRate);
    expect(f.fleeTo).toBe(HORDE.fleeDistance);
    expect(dist()).toBeGreaterThan(100); // running away
    for (let t = 0; t < 20 && f.fleeTo > 0; t += DT) step(world, IDLE, DT);
    expect(f.fleeTo).toBe(0);
    expect(dist()).toBeGreaterThanOrEqual(HORDE.fleeDistance - 5);
    const d0 = dist();
    step(world, IDLE, DT);
    expect(dist()).toBeLessThan(d0); // back on the attack
  });
});

describe('Elites (D34)', () => {
  function elite(kind: Parameters<typeof spawnEnemy>[1]) {
    const world = makeWorld();
    const e = spawnEnemy(world, kind, world.player.x + 300, world.player.y);
    makeElite(e);
    return { world, e };
  }

  it('pay ×6 XP, take half stagger, and fit the hit-query radius', () => {
    const { world, e } = elite('raticate');
    const normal = spawnEnemy(world, 'raticate', 0, 0);
    pushEnemy(normal, 1, 0, 30);
    pushEnemy(e, 1, 0, 30);
    expect(e.kbX).toBeCloseTo(normal.kbX * ELITE.staggerMult);
    damageEnemy(world, e, 1e9);
    expect(world.gems.at(-1)!.value).toBe(ENEMIES.raticate.xp * ELITE.xpMult);
    expect(MAX_ENEMY_RADIUS).toBeGreaterThanOrEqual(ENEMIES.tauros.radius * ELITE.radiusMult);
  });

  it('Run Away: once below 30% it sprints off for a while, then turns back', () => {
    const { world, e } = elite('rattata');
    damageEnemy(world, e, e.maxHp * 0.75);
    expect(e.fleeLeft).toBe(ABILITY_TUNING.runAway.seconds);
    const d0 = Math.hypot(e.x - world.player.x, e.y - world.player.y);
    step(world, IDLE, DT);
    expect(Math.hypot(e.x - world.player.x, e.y - world.player.y)).toBeGreaterThan(d0);
    damageEnemy(world, e, 1);
    expect(e.abilityUsed).toBe(true); // only once
  });

  it('Tangled Feet: takes ×0.7 while slowed', () => {
    const { world, e } = elite('pidgey');
    const plain = damageEnemy(world, e, 10);
    e.slow = 0.3;
    e.slowLeft = 1;
    expect(damageEnemy(world, e, 10)).toBeCloseTo(plain * ABILITY_TUNING.tangledFeet.damageTakenMult);
  });

  it('Sniper, Guts and Anger Point raise its contact damage when their trigger holds', () => {
    const sniper = elite('spearow');
    expect(eliteContactMult(sniper.world, sniper.e)).toBe(1);
    sniper.world.player.hp = sniper.world.player.maxHp * 0.4;
    expect(eliteContactMult(sniper.world, sniper.e)).toBe(ABILITY_TUNING.sniper.contactMult);

    const guts = elite('raticate');
    expect(eliteContactMult(guts.world, guts.e)).toBe(1);
    guts.e.burnLeft = 2;
    expect(eliteContactMult(guts.world, guts.e)).toBe(ABILITY_TUNING.guts.contactMult);

    const anger = elite('tauros');
    damageEnemy(anger.world, anger.e, 10, { ...NO_HIT, critChance: 1 });
    expect(anger.e.rageLeft).toBe(ABILITY_TUNING.angerPoint.seconds);
    expect(eliteContactMult(anger.world, anger.e)).toBe(ABILITY_TUNING.angerPoint.contactMult);
  });

  it('Keen Eye: Blinded lasts a quarter as long', () => {
    const { world, e } = elite('fearow');
    applyBlind(world, e, 4);
    expect(e.blindLeft).toBeCloseTo(4 * ABILITY_TUNING.keenEye.blindMult);
  });

  it('normal enemies have no abilities', () => {
    const world = makeWorld();
    const e = spawnEnemy(world, 'raticate', 0, 0);
    e.burnLeft = 2;
    expect(eliteContactMult(world, e)).toBe(1);
  });
});

describe('batch-2 Elite abilities (D37, ROSTER)', () => {
  function elite(kind: Parameters<typeof spawnEnemy>[1], dx = 300, pokemonId: 'charmander' | 'squirtle' = 'charmander') {
    const world = createWorld({ rng: createSeededRng(1), spawnEnabled: false, pokemonId });
    world.moves = [];
    const e = spawnEnemy(world, kind, world.player.x + dx, world.player.y);
    makeElite(e);
    e.atkCooldown = 99;
    return { world, e };
  }

  it('Shield Dust: statuses riding on a hit land at ×0.25', () => {
    const { world, e } = elite('caterpie');
    damageEnemy(world, e, 1, { ...NO_HIT, burnDps: 8 });
    // Shield Dust ×0.25 on top of its type: Bug takes burn ×1.5 (D27).
    expect(e.burnDps).toBeCloseTo(8 * ABILITY_TUNING.shieldDust.statusMult * enemyStatusMult(e, 'burn'));
  });

  it('Sturdy: the first KO leaves it at 1 HP; the next one is real', () => {
    const { world, e } = elite('geodude');
    damageEnemy(world, e, 1e9);
    expect(e.hp).toBe(1);
    damageEnemy(world, e, 1e9);
    expect(e.hp).toBeLessThanOrEqual(0);
  });

  it('Infiltrator: its hits slip past a ready Shell', () => {
    const { world } = elite('zubat', 5, 'squirtle');
    world.player.blockReadyLeft = 0;
    const hp = world.player.hp;
    step(world, IDLE, DT);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('Swift Swim: faster while standing in a puddle', () => {
    const moved = (puddle: boolean) => {
      const { world, e } = elite('psyduck', 600);
      if (puddle) spawnPuddle(world, e.x, e.y, 10);
      const x = e.x;
      step(world, IDLE, DT);
      return x - e.x;
    };
    expect(moved(true)).toBeCloseTo(moved(false) * ABILITY_TUNING.swiftSwim.speedMult, 1);
  });

  it('Synchronize: poisoning it poisons you too', () => {
    const { world, e } = elite('abra');
    damageEnemy(world, e, 1, { ...NO_HIT, poisonDps: 5 });
    expect(world.playerStatus.poisonLeft).toBeGreaterThan(0);
  });

  it('Aftermath: killed, it still explodes after a short ring', () => {
    const { world, e } = elite('voltorb', 30);
    world.player.invulnLeft = 0;
    damageEnemy(world, e, 1e9);
    expect(world.delayedBlasts).toHaveLength(1);
    world.gems = []; // its ×6 XP would open a level-up window and pause the sim
    const hp = world.player.hp;
    for (let t = 0; t < ABILITY_TUNING.aftermath.delay + DT; t += DT) step(world, IDLE, DT);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('Healer: its heal also clears its allies statuses; healers never lead a horde', () => {
    const { world, e } = elite('chansey', 250);
    e.atkCooldown = 0;
    const ally = spawnEnemy(world, 'rattata', e.x + 40, e.y);
    ally.speed = 0;
    ally.burnLeft = 3;
    ally.burnDps = 5;
    for (let t = 0; t < 1; t += DT) step(world, IDLE, DT);
    expect(ally.burnLeft).toBe(0);
    expect(HORDE_FOLLOWERS.chansey).toBeUndefined();
  });
});
