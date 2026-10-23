import { describe, expect, it } from 'vitest';
import { ARENA_BOSS_IDS, ARENA_BOSSES, ARENA_TUNING, SNORLAX_KIT, ZAPDOS_KIT, type ArenaBossId } from '../data/arena';
import { ENEMIES, TUNING } from '../data/content';
import { arenaBossChoices, arenaSchedule, chooseArenaReward, chooseCombine, resolveArena, rollRewardCards, skipCombine } from './arena';
import { PLAYER_STATUS } from '../data/playerStatus';
import { playerStatusSlow } from './playerStatus';
import { currentStage } from './stats';
import { statusMult } from './statusResist';
import { NO_HIT, damageEnemy } from './combat';
import { spawnPuddle } from './terrain';
import { MAX_COMBO_MOVES, comboCandidates, comboCooldown, learnsetSlotsUsed } from './combo';
import { buildCardPool } from './progression';
import { createSeededRng } from './rng';
import { createSlot, refreshStats } from './stats';
import type { World } from './types';
import { createWorld, runClock, spawnEnemy, step, waveAt } from './world';

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

/** Walks into the first event's arena; `bossId` picks the boss (the pool is random). */
function enter(world: World, bossId: ArenaBossId = 'snorlax'): void {
  world.arenaBossesUsed = ARENA_BOSS_IDS.filter((id) => id !== bossId);
  openFirstEntrance(world);
  const e = world.entrance!;
  world.player.x = e.x;
  world.player.y = e.y;
  step(world, IDLE, DT);
}

describe('arena events (D28): schedule and entrance', () => {
  it('2 seeded events per run (~6:30 and ~12:30), each open window ending before the run does', () => {
    const times = arenaSchedule(42);
    expect(times).toEqual(arenaSchedule(42));
    expect(times).toHaveLength(2);
    times.forEach((t, i) => {
      expect(Math.abs(t - ARENA_TUNING.eventTimes[i]!)).toBeLessThanOrEqual(ARENA_TUNING.jitter);
      // Fights don't count on the run clock (owner 2026-10-23): only the open window must fit.
      expect(t + ARENA_TUNING.openSeconds).toBeLessThan(TUNING.runSeconds);
    });
  });

  it('the run clock pauses inside an arena: the run still ends at 15:00 of map time', () => {
    const world = makeWorld();
    enter(world);
    const before = runClock(world);
    for (let i = 0; i < 120; i++) step(world, IDLE, DT);
    expect(runClock(world)).toBeCloseTo(before);
    expect(world.time).toBeGreaterThan(before);
    // Back on the map the clock runs again, and 15:00 on it ends the run.
    world.arena!.timeLeft = 0;
    step(world, IDLE, DT);
    expect(world.arena).toBeNull();
    world.time = world.arenaSeconds + TUNING.runSeconds - DT / 2;
    step(world, IDLE, DT);
    expect(world.status).toBe('survived');
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

  it('being knocked out in the arena throws you back to the map at 25% HP instead of ending the run', () => {
    const world = makeWorld();
    enter(world);
    const f = world.arena!;
    const boss = world.enemies.find((e) => e.id === f.bossEnemyId)!;
    world.player.hp = 1;
    world.player.invulnLeft = 0;
    world.player.x = boss.x;
    world.player.y = boss.y; // touching Snorlax
    step(world, IDLE, DT);
    expect(world.status).toBe('running');
    expect(world.arena).toBeNull();
    expect(world.offer).toBeNull();
    expect(world.arenaNotice?.kind).toBe('knockedOut');
    expect(world.player.hp).toBeCloseTo(world.player.maxHp * ARENA_TUNING.knockoutHpPct);
    expect(world.player.invulnLeft).toBeGreaterThan(0);
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

/** Puts every Snorlax move on a long cooldown, so a test can open just the one it checks. */
function quiet(f: NonNullable<World['arena']>): void {
  f.slamCooldown = 99;
  f.yawnCooldown = 99;
  f.beamCooldown = 99;
  for (const id of Object.keys(f.cooldowns) as (keyof typeof f.cooldowns)[]) f.cooldowns[id] = 99;
}

describe('Snorlax phase 1 kit (B1-3)', () => {
  /** Enters the arena and starts the fight with the player standing still near the boss. */
  function fight(): { world: World; boss: ReturnType<typeof spawnEnemy> } {
    const world = makeWorld();
    enter(world);
    const f = world.arena!;
    world.player.x = f.x;
    world.player.y = f.y + 200;
    step(world, IDLE, DT); // engages
    const boss = world.enemies.find((e) => e.id === f.bossEnemyId)!;
    quiet(f);
    return { world, boss };
  }

  it('Body Slam locks a lead-aimed ring (no lead when standing still), holds still, then lands', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    const { bodySlam } = SNORLAX_KIT;
    world.player.invulnLeft = 99; // watch the timing, not the damage
    f.slamCooldown = 0;
    const right = { moveX: 1, moveY: 0 };
    step(world, right, DT);
    const slam = f.slam!;
    expect(slam.phase).toBe('windup');
    // Locked after this step's movement: where you are plus where you're heading.
    const expectedX = world.player.x + world.player.vx * bodySlam.windup * bodySlam.lead;
    expect(slam.x).toBeCloseTo(expectedX, 0);
    expect(boss.speed).toBe(0);
    const at = { x: slam.x, y: slam.y };
    for (let t = 0; t < bodySlam.windup + DT; t += DT) step(world, right, DT);
    expect(boss.x).toBeCloseTo(at.x);
    expect(boss.y).toBeCloseTo(at.y);
    expect(f.slam!.phase).toBe('recover');
    for (let t = 0; t < bodySlam.recover + DT; t += DT) step(world, IDLE, DT);
    expect(f.slam).toBeNull();
    expect(boss.speed).toBeCloseTo(f.bossSpeed);

    // Standing still: the ring lands right on you.
    f.slamCooldown = 0;
    f.moveGap = 0;
    step(world, IDLE, DT);
    expect(f.slam!.x).toBeCloseTo(world.player.x);
    expect(f.slam!.y).toBeCloseTo(world.player.y);
  });

  it('the landing hits for 2× contact inside the ring and nothing outside', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    world.player.invulnLeft = 0;
    f.slamCooldown = 0;
    step(world, IDLE, DT);
    const hp = world.player.hp;
    f.slam!.left = DT / 2;
    step(world, IDLE, DT);
    expect(hp - world.player.hp).toBeCloseTo(boss.contactDamage * SNORLAX_KIT.bodySlam.damageFactor * world.mods.damageTakenMult, 0);

    world.player.invulnLeft = 0;
    f.slam = null;
    f.slamCooldown = 0;
    f.moveGap = 0;
    step(world, IDLE, DT);
    const hp2 = world.player.hp;
    world.player.y = f.slam!.y - f.slam!.radius - 60; // step out of the ring before it lands
    f.slam!.left = DT / 2;
    step(world, IDLE, DT);
    expect(world.player.hp).toBe(hp2);
  });

  it('Gluttony: Snorlax shakes 3 s, the berry pops up at 2 s, then it rushes it (hangry) and eats it for 8%', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    const { gluttony } = SNORLAX_KIT;
    f.slamCooldown = 99;
    f.berryTimer = 0;
    boss.hp = boss.maxHp * 0.8; // above the first Rest threshold (B2)
    world.player.invulnLeft = 99;
    world.moves = []; // no auto-fire chipping the boss during the check
    step(world, IDLE, DT);
    expect(f.shakeLeft).toBeCloseTo(gluttony.shakeSeconds);
    expect(boss.speed).toBe(0);
    const stepsTo = (t: number) => Math.round(t / DT);
    for (let i = 0; i < stepsTo(gluttony.dropAt) - 1; i++) step(world, IDLE, DT);
    expect(world.berries.some((b) => b.kind === 'oran')).toBe(false); // not yet
    step(world, IDLE, DT);
    step(world, IDLE, DT);
    const berry = world.berries.find((b) => b.kind === 'oran')!;
    expect(Math.hypot(berry.x - f.x, berry.y - f.y)).toBeLessThanOrEqual(f.radius);
    expect(f.goal).toBeNull(); // still shaking: the player gets a head start
    for (let i = 0; i < stepsTo(gluttony.shakeSeconds - gluttony.dropAt) + 1; i++) step(world, IDLE, DT);
    expect(f.shakeLeft).toBeLessThanOrEqual(0);
    expect(f.goal).toEqual({ x: berry.x, y: berry.y });
    expect(boss.speed).toBeCloseTo(f.bossSpeed * gluttony.rushMult);
    boss.x = berry.x;
    boss.y = berry.y;
    const hpBefore = boss.hp;
    step(world, IDLE, DT);
    expect(boss.hp).toBeCloseTo(hpBefore + boss.maxHp * gluttony.healPct, 0);
    expect(world.berries.some((b) => b.id === berry.id)).toBe(false);
  });

  it('Body Slam leaves rubble that blocks the player, then crumbles', () => {
    const { world } = fight();
    const f = world.arena!;
    world.player.invulnLeft = 99;
    f.slamCooldown = 0;
    step(world, IDLE, DT);
    f.slam!.left = DT / 2;
    step(world, IDLE, DT);
    expect(f.rubble).toHaveLength(SNORLAX_KIT.bodySlam.rubble.count);
    const rock = f.rubble[0]!;
    world.player.x = rock.x;
    world.player.y = rock.y;
    step(world, IDLE, DT);
    expect(Math.hypot(world.player.x - rock.x, world.player.y - rock.y)).toBeGreaterThanOrEqual(rock.radius + world.player.radius - 0.01);
    for (const r of f.rubble) r.left = DT / 2;
    step(world, IDLE, DT);
    expect(f.rubble).toHaveLength(0);
  });
});

describe('Snorlax B2: Rest, Yawn, Belly Drum, Hyper Beam', () => {
  function fight(): { world: World; boss: ReturnType<typeof spawnEnemy> } {
    const world = makeWorld();
    enter(world);
    const f = world.arena!;
    world.player.x = f.x;
    world.player.y = f.y + 200;
    world.player.invulnLeft = 999;
    world.moves = []; // no auto-fire: the tests deal damage by hand
    step(world, IDLE, DT);
    const boss = world.enemies.find((e) => e.id === f.bossEnemyId)!;
    quiet(f); // each test opens the move it checks
    return { world, boss };
  }

  it('Rest at 66%: asleep, standing still, healing, snoring, then phase 2', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    boss.hp = boss.maxHp * 0.6;
    step(world, IDLE, DT);
    expect(f.rest).not.toBeNull();
    expect(world.arenaNotice?.kind).toBe('rest');
    for (let t = 0; t < 2; t += DT) step(world, IDLE, DT);
    expect(boss.speed).toBe(0);
    expect(boss.hp).toBeGreaterThan(boss.maxHp * 0.6);
    expect(f.snores.length).toBeGreaterThan(0);
    for (let t = 0; t < SNORLAX_KIT.rest.seconds; t += DT) step(world, IDLE, DT);
    expect(f.rest).toBeNull();
    expect(f.phase).toBe(2);
    // As a fraction of max HP: boss HP scales with the event time, so an absolute tolerance doesn't hold.
    expect(boss.hp / boss.maxHp).toBeCloseTo(0.6 + SNORLAX_KIT.rest.healPct, 2);
  });

  it('asleep it takes ×1.5 damage; enough damage wakes it into a quick Body Slam (no more healing)', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    boss.hp = boss.maxHp * 0.6;
    step(world, IDLE, DT);
    const before = boss.hp;
    damageEnemy(world, boss, 100);
    expect(before - boss.hp).toBeCloseTo(150);
    damageEnemy(world, boss, (boss.maxHp * SNORLAX_KIT.rest.wakeAtPct) / 1.5);
    step(world, IDLE, DT);
    expect(f.rest).toBeNull();
    expect(f.phase).toBe(2);
    expect(f.slam?.windup).toBe(SNORLAX_KIT.rest.wakeSlamWindup);
  });

  it('a Snore ring hits you unless you stand in its gap', () => {
    for (const inGap of [true, false]) {
      const { world, boss } = fight();
      const f = world.arena!;
      world.player.invulnLeft = 0;
      const angle = inGap ? 0 : Math.PI;
      f.snores.push({ x: boss.x, y: boss.y, r: 100, gapAngle: 0, hit: false });
      world.player.x = boss.x + Math.cos(angle) * 100;
      world.player.y = boss.y + Math.sin(angle) * 100;
      const hp = world.player.hp;
      step(world, IDLE, DT);
      if (inGap) expect(world.player.hp).toBe(hp);
      else expect(world.player.hp).toBeLessThan(hp);
    }
  });

  it('a rubble rock shelters you from a Snore ring when it is between you and Snorlax', () => {
    for (const rockThere of [true, false]) {
      const { world, boss } = fight();
      const f = world.arena!;
      world.player.invulnLeft = 0;
      const away = Math.PI; // the ring's real gap is on the other side
      f.snores.push({ x: boss.x, y: boss.y, r: 160, gapAngle: 0, hit: false });
      if (rockThere) f.rubble.push({ x: boss.x + Math.cos(away) * 100, y: boss.y, radius: 26, left: 20 });
      world.player.x = boss.x + Math.cos(away) * 160;
      world.player.y = boss.y;
      const hp = world.player.hp;
      step(world, IDLE, DT);
      if (rockThere) expect(world.player.hp).toBe(hp);
      else expect(world.player.hp).toBeLessThan(hp);
    }
  });

  it('now and then Snorlax Body Slams onto the new berry instead of running to it', () => {
    let leaps = 0;
    const runs = 40;
    for (let seed = 1; seed <= runs; seed++) {
      const world = createWorld({ rng: createSeededRng(seed), spawnEnabled: true, mapSeed: seed });
      world.spawnTimer = 1e9;
      enter(world);
      const f = world.arena!;
      world.player.x = f.x;
      world.player.y = f.y + 200;
      world.player.invulnLeft = 999;
      world.moves = [];
      step(world, IDLE, DT);
      f.slamCooldown = 99;
      f.berryTimer = 0;
      for (let t = 0; t < SNORLAX_KIT.gluttony.shakeSeconds + 0.1; t += DT) step(world, IDLE, DT);
      const berry = world.berries.find((b) => b.kind === 'oran');
      if (f.slam && berry) {
        leaps++;
        expect([f.slam.x, f.slam.y]).toEqual([berry.x, berry.y]);
      }
    }
    expect(leaps).toBeGreaterThan(0);
    expect(leaps / runs).toBeLessThan(0.45); // rare
  });

  it('phase 2: Yawn locks a cone, then its cloud slows the player inside; slams come in pairs', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    f.phase = 2;
    f.yawnCooldown = 0;
    step(world, IDLE, DT);
    const cloud = f.yawn!;
    expect(cloud.phase).toBe('windup');
    cloud.left = DT / 2;
    step(world, IDLE, DT);
    expect(f.yawn!.phase).toBe('cloud');
    step(world, IDLE, DT); // the cloud covers the player (it was aimed at them)
    expect(f.playerSlow).toBeCloseTo(SNORLAX_KIT.yawn.slow);
    const x = world.player.x;
    step(world, { moveX: 1, moveY: 0 }, DT);
    expect(world.player.x - x).toBeCloseTo(world.player.speed * (1 - SNORLAX_KIT.yawn.slow) * DT, 1);

    f.yawn = null;
    f.yawnCooldown = 99;
    f.slamCooldown = 0;
    f.moveGap = 0;
    step(world, IDLE, DT);
    expect(f.slamsQueued).toBe(SNORLAX_KIT.bodySlam.chainFromPhase2 - 1);
    f.slam!.left = DT / 2;
    step(world, IDLE, DT);
    f.slam!.left = DT / 2; // recover ends: the second slam starts at once
    step(world, IDLE, DT);
    expect(f.slam?.phase).toBe('windup');
    expect(f.slamsQueued).toBe(0);
    expect(boss.speed).toBe(0);
  });

  it('kiting delays close moves: no Yawn or Body Slam while you stay out of their range', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    f.phase = 2;
    f.yawnCooldown = 0;
    f.slamCooldown = 0;
    world.player.x = boss.x + SNORLAX_KIT.bodySlam.range + 40;
    world.player.y = boss.y;
    boss.speed = 0;
    step(world, IDLE, DT);
    expect(f.yawn).toBeNull();
    expect(f.slam).toBeNull();
    expect(boss.speed).toBeGreaterThan(0); // walks closer instead
    world.player.x = boss.x + SNORLAX_KIT.yawn.range - 20;
    step(world, IDLE, DT);
    expect(f.slam ?? f.yawn).not.toBeNull(); // in range: one of them starts (weighted pick)
  });

  it('phase 3 starts with Belly Drum (half HP, double contact) and adds Hyper Beam with a recharge', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    f.phase = 2;
    boss.hp = boss.maxHp * 0.3;
    step(world, IDLE, DT); // Rest at 33%
    const contact = boss.contactDamage;
    f.rest!.left = DT / 2;
    step(world, IDLE, DT);
    expect(f.phase).toBe(3);
    expect(world.arenaNotice?.kind).toBe('bellyDrum');
    expect(boss.contactDamage).toBeCloseTo(contact * SNORLAX_KIT.bellyDrum.contactMult);
    expect(f.drumLeft).toBeGreaterThan(0); // drumming (immune) first
    for (let t = 0; t < SNORLAX_KIT.bellyDrum.seconds + SNORLAX_KIT.moveGap + DT; t += DT) step(world, IDLE, DT);

    f.beamCooldown = 0;
    world.player.invulnLeft = 0;
    step(world, IDLE, DT);
    expect(f.beam?.phase).toBe('windup');
    const hp = world.player.hp;
    f.beam!.left = DT / 2;
    step(world, IDLE, DT);
    expect(world.player.hp).toBeLessThan(hp); // aimed where the player stood (lead 0)
    expect(f.beam!.phase).toBe('recharge');
    expect(boss.speed).toBe(0);
  });
});

describe('Snorlax variety and immunity (owner 2026-10-22)', () => {
  function fight(phase = 1): { world: World; boss: ReturnType<typeof spawnEnemy> } {
    const world = makeWorld();
    enter(world);
    const f = world.arena!;
    world.player.x = f.x;
    world.player.y = f.y + 200;
    world.player.invulnLeft = 999;
    world.moves = [];
    step(world, IDLE, DT);
    const boss = world.enemies.find((e) => e.id === f.bossEnemyId)!;
    quiet(f);
    f.berryTimer = 99;
    f.phase = phase;
    return { world, boss };
  }
  const run = (world: World, seconds: number, input = IDLE) => {
    for (let t = 0; t < seconds; t += DT) step(world, input, DT);
  };

  it('is immune during the berry shake, Belly Drum and Heavy Slam in the air, but not while resting', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    const hp = boss.hp;
    f.shakeLeft = 1;
    expect(damageEnemy(world, boss, 500)).toBe(0);
    f.shakeLeft = 0;
    f.drumLeft = 1;
    expect(damageEnemy(world, boss, 500)).toBe(0);
    f.drumLeft = 0;
    f.heavySlam = { x: boss.x, y: boss.y, left: 1, phase: 'air' };
    expect(damageEnemy(world, boss, 500)).toBe(0);
    expect(boss.hp).toBe(hp);
    f.heavySlam = null;
    f.rest = { left: 5, wake: 0 };
    expect(damageEnemy(world, boss, 100)).toBeGreaterThan(0);
  });

  it('phase gate: a burst cannot skip a Rest; HP holds at the threshold and Rest starts', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    boss.hp = boss.maxHp * 0.7;
    damageEnemy(world, boss, boss.maxHp);
    expect(boss.hp).toBeCloseTo(boss.maxHp * SNORLAX_KIT.restAt[0]);
    step(world, IDLE, DT);
    expect(f.rest).not.toBeNull();
    // While resting in phase 1 the next gate (33%) holds.
    damageEnemy(world, boss, boss.maxHp);
    expect(boss.hp).toBeCloseTo(boss.maxHp * SNORLAX_KIT.restAt[1]);
    // Phase 3 has no gate: it can die.
    f.rest = null;
    f.phase = 3;
    damageEnemy(world, boss, boss.maxHp);
    expect(boss.hp).toBeLessThanOrEqual(0);
  });

  it('Crunch bites the cone in front when you hug it, and misses behind', () => {
    for (const behind of [false, true]) {
      const { world, boss } = fight();
      const f = world.arena!;
      world.player.invulnLeft = 0;
      world.player.x = boss.x;
      world.player.y = boss.y + boss.radius + 40;
      f.cooldowns.crunch = 0;
      step(world, IDLE, DT);
      expect(f.crunch?.phase).toBe('windup');
      if (behind) world.player.y = boss.y - boss.radius - 40;
      const hp = world.player.hp;
      f.crunch!.left = DT / 2;
      step(world, IDLE, DT);
      if (behind) expect(world.player.hp).toBe(hp);
      else expect(world.player.hp).toBeLessThan(hp);
    }
  });

  it('Rock Slide drops rocks on you and around you; one stays as rubble', () => {
    const { world } = fight();
    const f = world.arena!;
    world.player.invulnLeft = 0;
    f.cooldowns.rockSlide = 0;
    step(world, IDLE, DT);
    expect(f.rocks).toHaveLength(SNORLAX_KIT.rockSlide.rocks);
    expect(f.rocks[0]!.x).toBeCloseTo(world.player.x);
    const hp = world.player.hp;
    run(world, SNORLAX_KIT.rockSlide.cast + SNORLAX_KIT.rockSlide.telegraph + DT);
    expect(world.player.hp).toBeLessThan(hp);
    expect(f.rocks).toHaveLength(0);
    expect(f.rubble.length).toBe(SNORLAX_KIT.rockSlide.keep);
  });

  it('Fling throws the nearest rubble rock (the cover goes) and it bursts into shards at the wall', () => {
    const { world, boss } = fight(2);
    const f = world.arena!;
    f.rubble.push({ x: boss.x + 60, y: boss.y, radius: 26, left: 20 });
    f.cooldowns.fling = 0;
    step(world, IDLE, DT);
    expect(f.fling).not.toBeNull();
    expect(f.rubble).toHaveLength(0);
    world.player.x = f.x - f.radius + 30; // out of the throw's path
    world.player.y = f.y - 300;
    f.fling!.left = DT / 2;
    step(world, IDLE, DT);
    expect(f.shots.some((s) => s.kind === 'rock')).toBe(true);
    run(world, 2.5);
    expect(f.shots.some((s) => s.kind === 'rock')).toBe(false);
  });

  it('Heavy Slam: crouch, leap (untouchable) while the shadow chases you slowly, lock, land on the shadow', () => {
    const { world, boss } = fight(2);
    const f = world.arena!;
    const { heavySlam } = SNORLAX_KIT;
    f.cooldowns.heavySlam = 0;
    world.player.x = boss.x + 250;
    world.player.y = boss.y;
    step(world, IDLE, DT);
    expect(f.heavySlam?.phase).toBe('crouch');
    run(world, heavySlam.crouch + DT);
    expect(f.heavySlam?.phase).toBe('air');
    const start = { x: f.heavySlam!.x, y: f.heavySlam!.y };
    run(world, 0.5);
    const moved = Math.hypot(f.heavySlam!.x - start.x, f.heavySlam!.y - start.y);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(heavySlam.shadowSpeed * (0.5 + 2 * DT)); // slower than any player
    // Standing on it: no contact hit while it's in the air.
    world.player.invulnLeft = 0;
    world.player.x = boss.x;
    world.player.y = boss.y;
    const hp = world.player.hp;
    step(world, IDLE, DT);
    expect(world.player.hp).toBe(hp);
    world.player.invulnLeft = 999;
    run(world, heavySlam.air + heavySlam.lock);
    expect(f.heavySlam?.phase).toBe('recover');
    expect(f.rubble.length).toBe(heavySlam.rubble);
  });

  it('Block: when you kite far, a chain holds you within the leash', () => {
    const { world, boss } = fight(2);
    const f = world.arena!;
    const { block } = SNORLAX_KIT;
    f.cooldowns.block = 0;
    world.player.x = boss.x + block.minDistance + 50;
    world.player.y = boss.y;
    step(world, IDLE, DT);
    expect(f.block?.phase).toBe('windup');
    run(world, block.telegraph + DT);
    expect(f.block?.phase).toBe('hold');
    run(world, 1, { moveX: 1, moveY: 0 });
    expect(Math.hypot(world.player.x - boss.x, world.player.y - boss.y)).toBeLessThanOrEqual(block.leash + 0.01);
  });

  it('Belch comes right after Snorlax eats a berry: a cone of gas puffs', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    world.berries.push({ id: world.nextId++, kind: 'oran', x: boss.x, y: boss.y, collected: false });
    step(world, IDLE, DT); // eats it
    expect(f.belchReady).toBe(true);
    f.moveGap = 0;
    step(world, IDLE, DT);
    expect(f.belch?.phase).toBe('windup');
    f.belch!.left = DT / 2;
    step(world, IDLE, DT);
    expect(f.shots.filter((s) => s.kind === 'gas')).toHaveLength(SNORLAX_KIT.belch.puffs);
  });

  it('Earthquake hits the inner and outer bands, then the middle one', () => {
    const { world, boss } = fight(3);
    const f = world.arena!;
    const { earthquake } = SNORLAX_KIT;
    f.cooldowns.earthquake = 0;
    world.player.x = boss.x + (earthquake.bands[0] + earthquake.bands[1]) / 2; // middle band
    world.player.y = boss.y;
    step(world, IDLE, DT);
    expect(f.quake?.step).toBe(1);
    world.player.invulnLeft = 0;
    const hp = world.player.hp;
    f.quake!.left = DT / 2;
    step(world, IDLE, DT);
    expect(world.player.hp).toBe(hp); // the middle is safe on the first beat
    expect(f.quake?.step).toBe(2);
    f.quake!.left = DT / 2;
    step(world, IDLE, DT);
    expect(world.player.hp).toBeLessThan(hp); // ...and hit on the second
  });

  it('the picker uses at least 10 different moves over a fight', () => {
    const seen = new Set<string>();
    for (const phase of [1, 2, 3]) {
      const { world, boss } = fight(phase);
      const f = world.arena!;
      for (const id of Object.keys(f.cooldowns) as (keyof typeof f.cooldowns)[]) f.cooldowns[id] = 0;
      f.slamCooldown = f.yawnCooldown = f.beamCooldown = 0;
      let last: string | null = null;
      for (let t = 0; t < 90; t += DT) {
        boss.hp = boss.maxHp; // stay in this phase
        if (t % 20 < DT) world.berries.push({ id: world.nextId++, kind: 'oran', x: boss.x, y: boss.y, collected: false });
        // Walk in and out so close and far moves both come up.
        const out = Math.floor(t / 4) % 2 === 0;
        step(world, { moveX: out ? 1 : -1, moveY: 0 }, DT);
        if (f.lastMove && f.lastMove !== last) {
          seen.add(f.lastMove);
          last = f.lastMove;
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });
});

describe('Zapdos (D32)', () => {
  function fight(phase = 1, pokemonId: 'charmander' | 'pikachu' = 'charmander') {
    const world = createWorld({ rng: createSeededRng(1), spawnEnabled: true, mapSeed: 1, pokemonId });
    world.spawnTimer = 1e9;
    enter(world, 'zapdos');
    const f = world.arena!;
    world.player.x = f.x;
    world.player.y = f.y + 200;
    world.player.invulnLeft = 999;
    world.moves = [];
    step(world, IDLE, DT);
    const boss = world.enemies.find((e) => e.id === f.bossEnemyId)!;
    const zap = f.zap!;
    for (const id of Object.keys(zap.cooldowns) as (keyof typeof zap.cooldowns)[]) zap.cooldowns[id] = 99;
    zap.phase = phase;
    return { world, f, boss, zap };
  }
  const run = (world: World, seconds: number, input = IDLE) => {
    for (let t = 0; t < seconds; t += DT) step(world, input, DT);
  };
  const breakPylons = (world: World, zap: NonNullable<World['arena']>['zap'] & object) => {
    for (const p of zap.pylons) {
      const e = world.enemies.find((en) => en.id === p.enemyId);
      if (e) damageEnemy(world, e, 1e9);
    }
    step(world, IDLE, DT);
  };

  it('three generators shield it (×0.25) until broken; a broken one is rebuilt later', () => {
    const { world, boss, zap } = fight();
    expect(zap.pylons.filter((p) => p.enemyId !== null)).toHaveLength(ZAPDOS_KIT.pylons.count);
    expect(world.enemies.filter((e) => e.kind === 'pylon')).toHaveLength(ZAPDOS_KIT.pylons.count);
    expect(damageEnemy(world, boss, 100)).toBeCloseTo(100 * ZAPDOS_KIT.pylons.shieldMult);
    breakPylons(world, zap);
    expect(zap.pylons.every((p) => p.enemyId === null)).toBe(true);
    expect(damageEnemy(world, boss, 100)).toBeCloseTo(100);
    expect(world.gems).toHaveLength(0); // generators pay no XP
    run(world, ZAPDOS_KIT.pylons.recharge + DT);
    expect(zap.pylons.every((p) => p.enemyId !== null)).toBe(true);
  });

  it('phase gate holds HP at 66%; the Charge-up and Rain Dance animations are immune', () => {
    const { world, boss, zap } = fight();
    breakPylons(world, zap);
    boss.hp = boss.maxHp * 0.7;
    damageEnemy(world, boss, boss.maxHp);
    expect(boss.hp).toBeCloseTo(boss.maxHp * ZAPDOS_KIT.phaseAt[0]);
    step(world, IDLE, DT);
    expect(zap.phase).toBe(2);
    expect(world.arenaNotice?.kind).toBe('chargeUp');
    expect(zap.transitionLeft).toBeGreaterThan(0);
    expect(damageEnemy(world, boss, 500)).toBe(0);
    zap.transitionLeft = 0;
    boss.hp = boss.maxHp * 0.3;
    step(world, IDLE, DT);
    expect(zap.phase).toBe(3);
    expect(zap.raining).toBe(true);
    expect(world.arenaNotice?.kind).toBe('rainDance');
  });

  it('Thunder brackets you: one ring where you are, one where you are heading; it hits inside', () => {
    const { world, zap } = fight();
    zap.cooldowns.thunder = 0;
    step(world, { moveX: 1, moveY: 0 }, DT);
    expect(zap.strikes).toHaveLength(2);
    const [now, ahead] = zap.strikes;
    expect(now!.x).toBeCloseTo(world.player.x, 0);
    expect(ahead!.x).toBeGreaterThan(now!.x);
    world.player.invulnLeft = 0;
    const hp = world.player.hp;
    for (const s of zap.strikes) s.left = DT / 2;
    step(world, IDLE, DT);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('Lightning Rod pulls every Thunder onto you, and the hit fills your Charge', () => {
    const { world, zap } = fight();
    world.player.ability = 'lightningRod';
    world.player.charge = 0;
    zap.cooldowns.thunder = 0;
    step(world, { moveX: 1, moveY: 0 }, DT);
    for (const s of zap.strikes) expect(s.x).toBeCloseTo(world.player.x, 0);
    world.player.invulnLeft = 0;
    for (const s of zap.strikes) s.left = DT / 2;
    step(world, IDLE, DT);
    expect(world.player.charge).toBeGreaterThan(0);
  });

  it('in the rain, a Thunder anywhere hits you through a puddle and paralyses (slow, never a stun)', () => {
    const { world, f, zap } = fight(3);
    zap.raining = true;
    zap.puddleTimer = 99;
    spawnPuddle(world, world.player.x, world.player.y, 10);
    world.player.invulnLeft = 0;
    const hp = world.player.hp;
    zap.strikes.push({ x: f.x - f.radius * 0.8, y: f.y, left: DT / 2, total: 1, factor: 1 });
    step(world, IDLE, DT);
    expect(world.player.hp).toBeLessThan(hp);
    expect(world.playerStatus.paraLeft).toBeGreaterThan(0);
    run(world, PLAYER_STATUS.paralysis.stutter + 0.1);
    expect(playerStatusSlow(world)).toBeCloseTo(PLAYER_STATUS.paralysis.slow);
  });

  it('player paralysis follows the starter type: Electric ×0.25, Water ×1.5, Fire ×1', () => {
    for (const [pokemonId, mult] of [['pikachu', 0.25], ['squirtle', 1.5], ['charmander', 1]] as const) {
      const w = createWorld({ rng: createSeededRng(1), pokemonId });
      expect(statusMult(currentStage(w).types, 'paralysis')).toBe(mult);
    }
  });

  it('Drill Peck: a locked line, then a dash along it that hits once', () => {
    const { world, boss, zap } = fight();
    zap.cooldowns.drillPeck = 0;
    world.player.x = boss.x + 200;
    world.player.y = boss.y;
    step(world, IDLE, DT);
    expect(zap.peck?.phase).toBe('windup');
    world.player.invulnLeft = 0;
    const hp = world.player.hp;
    run(world, ZAPDOS_KIT.drillPeck.telegraph + 1);
    expect(world.player.hp).toBeLessThan(hp);
    expect(zap.peck?.phase ?? 'done').not.toBe('dash');
  });

  it('Shock Wave homes, then gives up and flies straight', () => {
    const { world, zap } = fight();
    zap.cooldowns.shockWave = 0;
    step(world, IDLE, DT);
    run(world, ZAPDOS_KIT.shockWave.cast + DT);
    const bolt = zap.shots.find((s) => s.kind === 'shock')!;
    expect(zap.shots.filter((s) => s.kind === 'shock')).toHaveLength(ZAPDOS_KIT.shockWave.bolts);
    world.player.x += 400; // out of reach, so the bolts keep flying
    run(world, ZAPDOS_KIT.shockWave.homing + 0.05);
    const v = { x: bolt.vx, y: bolt.vy };
    run(world, 0.2, { moveX: 0, moveY: 1 });
    expect(bolt.vx).toBeCloseTo(v.x);
    expect(bolt.vy).toBeCloseTo(v.y);
  });

  it('Thunderbolt: a 3-way fan of bolts that weave around their line', () => {
    const { world, zap } = fight();
    zap.cooldowns.thunderbolt = 0;
    step(world, IDLE, DT);
    run(world, ZAPDOS_KIT.thunderbolt.cast + DT);
    expect(zap.shots.filter((s) => s.kind === 'bolt')).toHaveLength(ZAPDOS_KIT.thunderbolt.bolts);
    const tb = zap.shots.find((s) => s.kind === 'bolt')!;
    const start = { x: tb.x, y: tb.y };
    // Sideways from its straight heading, but never more than twice the weave's amplitude (peak to peak).
    let off = 0;
    for (let i = 0; i < 20; i++) {
      step(world, IDLE, DT);
      off = Math.max(off, Math.abs(-(tb.x - start.x) * Math.sin(tb.heading) + (tb.y - start.y) * Math.cos(tb.heading)));
    }
    expect(off).toBeGreaterThan(5);
    expect(off).toBeLessThanOrEqual(2 * ZAPDOS_KIT.thunderbolt.amplitude + 1);
  });

  it('Electric Fence: a telegraph line, then live; Zapdos zips along it and it hurts to stand on', () => {
    const { world, boss, zap } = fight(2);
    zap.cooldowns.fence = 0;
    step(world, IDLE, DT);
    const fence = zap.fences[0]!;
    expect(fence.phase).toBe('windup');
    fence.left = DT / 2;
    step(world, IDLE, DT);
    expect(fence.phase).toBe('live');
    expect(Math.hypot(boss.x - fence.x2, boss.y - fence.y2)).toBeLessThan(boss.radius + 5); // zipped to the far end
    world.player.x = (fence.x1 + fence.x2) / 2;
    world.player.y = (fence.y1 + fence.y2) / 2;
    world.player.invulnLeft = 0;
    const hp = world.player.hp;
    step(world, IDLE, DT);
    expect(world.player.hp).toBeLessThan(hp);
  });

  it('Discharge: enough damage during the channel interrupts it; otherwise only the safe ring is safe', () => {
    for (const mode of ['interrupt', 'safe', 'outside'] as const) {
      const { world, boss, zap } = fight(3);
      breakPylons(world, zap);
      zap.raining = false;
      zap.cooldowns.discharge = 0;
      step(world, IDLE, DT);
      const dis = zap.discharge!;
      expect(dis.phase).toBe('channel');
      if (mode === 'interrupt') damageEnemy(world, boss, boss.maxHp * ZAPDOS_KIT.discharge.interruptPct);
      world.player.x = mode === 'safe' ? dis.safeX : dis.safeX + 200;
      world.player.y = dis.safeY;
      world.player.invulnLeft = 0;
      const hp = world.player.hp;
      dis.left = mode === 'interrupt' ? dis.left : DT / 2;
      step(world, IDLE, DT);
      if (mode === 'outside') expect(world.player.hp).toBeLessThan(hp);
      else expect(world.player.hp).toBe(hp);
      expect(zap.discharge?.phase).toBe('recover');
    }
  });

  it('Roost (once per phase, after losing HP): heals and loses Flying, so Ice is no longer super effective', () => {
    const { world, boss, zap } = fight();
    breakPylons(world, zap);
    boss.hp = boss.maxHp * 0.8;
    step(world, IDLE, DT);
    expect(zap.roost).not.toBeNull();
    const ice = { ...NO_HIT, attackType: 'Ice' as const };
    damageEnemy(world, boss, 10, ice);
    expect(boss.lastEffectiveness).toBe(1);
    run(world, ZAPDOS_KIT.roost.seconds + DT);
    expect(zap.roost).toBeNull();
    expect(boss.hp).toBeGreaterThan(boss.maxHp * 0.8);
    damageEnemy(world, boss, 10, ice);
    expect(boss.lastEffectiveness).toBe(2);
  });

  it('Pressure: your cooldowns run 15% slower during the fight', () => {
    const world = makeWorld();
    enter(world, 'zapdos');
    const f = world.arena!;
    world.player.x = f.x;
    world.player.y = f.y + 200;
    step(world, IDLE, DT); // engages
    const slot = world.moves[0]!;
    slot.cooldownLeft = 1;
    for (let i = 0; i < 60; i++) step(world, IDLE, DT);
    expect(slot.cooldownLeft).toBeCloseTo(1 - 1 / (1 + ZAPDOS_KIT.pressure), 2);
  });

  it('the picker uses at least 10 different moves over a fight', () => {
    const seen = new Set<string>();
    for (const phase of [1, 2, 3]) {
      const { world, boss, zap } = fight(phase);
      for (const id of Object.keys(zap.cooldowns) as (keyof typeof zap.cooldowns)[]) zap.cooldowns[id] = 0;
      let last: string | null = null;
      for (let t = 0; t < 90; t += DT) {
        boss.hp = boss.maxHp; // stay in this phase
        zap.phaseStartHp = boss.maxHp * 2; // Roost is open
        step(world, { moveX: Math.floor(t / 3) % 2 ? 1 : -1, moveY: 0 }, DT);
        if (zap.lastMove && zap.lastMove !== last) {
          seen.add(zap.lastMove);
          last = zap.lastMove;
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });
});

describe('skill combine (D28)', () => {
  const FULL = [
    { augmentId: 'powerUp', rank: 1 },
    { augmentId: 'quickCast', rank: 1 },
    { augmentId: 'enlarge', rank: 1 },
  ] as const;

  function charmanderWith(...moves: ('scratch' | 'fireSpin' | 'dragonRage')[]): World {
    const world = makeWorld();
    for (const m of moves) world.moves.push(createSlot(m));
    for (const slot of world.moves) slot.sockets = FULL.map((s) => ({ ...s }));
    refreshStats(world);
    return world;
  }

  it('only moves with all 3 augment sockets filled can join; at most 4 moves', () => {
    const world = charmanderWith('scratch', 'fireSpin');
    world.moves[2]!.sockets.pop();
    expect(comboCandidates(world)).toEqual([0, 1]);
    world.combo = [0, 1, 3, 4].slice(0, MAX_COMBO_MOVES);
    expect(comboCandidates(world)).toEqual([]);
  });

  it('absorbed learnset moves free their slot, so new moves show up on level cards again', () => {
    const world = charmanderWith('scratch', 'fireSpin', 'dragonRage'); // signature + 3 learnset moves
    const before = learnsetSlotsUsed(world);
    world.combo = [0, 1, 2];
    expect(learnsetSlotsUsed(world)).toBe(before - 2);
    expect(buildCardPool(world).some((c) => c.kind === 'move')).toBe(true);
  });

  it('members fire together with the base on the average of their cooldowns', () => {
    const world = charmanderWith('fireSpin');
    world.combo = [0, 1];
    const target = spawnEnemy(world, 'raticate', 60, 0, 100);
    target.speed = 0;
    const [ember, fireSpin] = [world.moves[0]!, world.moves[1]!];
    step(world, IDLE, DT);
    expect(world.projectiles.length).toBeGreaterThan(0); // Ember fired
    expect(fireSpin.activeLeft).toBeGreaterThan(0); // Fire Spin fired with it
    const avg = (ember.stats.cooldown + fireSpin.stats.cooldown) / 2;
    expect(comboCooldown(world)).toBeCloseTo(avg);
    expect(ember.cooldownLeft).toBeCloseTo(avg, 1);
    // Fire Spin never casts on its own cooldown while it's a member.
    fireSpin.cooldownLeft = 0;
    fireSpin.activeLeft = 0;
    step(world, IDLE, DT);
    expect(fireSpin.activeLeft).toBe(0);
  });

  it('a boss win offers the combine step first (base, then absorb), then the reward; Esc skips to the reward', () => {
    const world = charmanderWith('scratch');
    enter(world);
    world.enemies.find((e) => e.id === world.arena!.bossEnemyId)!.hp = 0;
    step(world, IDLE, DT);
    expect(world.offer).toEqual({ kind: 'combine', slots: [0, 1] });
    chooseCombine(world, 0);
    expect(world.combo).toEqual([0]);
    expect(world.offer?.kind).toBe('arenaReward');

    world.offer = { kind: 'combine', slots: [1] };
    skipCombine(world);
    expect(world.combo).toEqual([0]);
    expect(world.offer?.kind).toBe('arenaReward');
  });

  it('with no qualifying move the win still gives the reward, flagged as a missed combine', () => {
    const world = makeWorld();
    enter(world);
    world.enemies.find((e) => e.id === world.arena!.bossEnemyId)!.hp = 0;
    step(world, IDLE, DT);
    expect(world.offer?.kind).toBe('arenaReward');
    if (world.offer?.kind === 'arenaReward') expect(world.offer.combineMissed).toBe(true);
  });
});
