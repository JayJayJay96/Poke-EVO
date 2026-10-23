import { describe, expect, it } from 'vitest';
import { ARENA_BOSS_IDS, ARENA_BOSSES, ARENA_TUNING, MACHAMP_KIT, SNORLAX_KIT, ZAPDOS_KIT, type ArenaBossId } from '../data/arena';
import { ENEMIES, TUNING } from '../data/content';
import { arenaBossChoices, arenaSchedule, chooseArenaReward, chooseCombine, resolveArena, rollRewardCards, skipCombine } from './arena';
import { PLAYER_STATUS } from '../data/playerStatus';
import { playerStatusSlow } from './playerStatus';
import { currentStage } from './stats';
import { statusMult } from './statusResist';
import { NO_HIT, damageEnemy } from './combat';
import { spawnPuddle } from './terrain';
import { createProjectile, updateProjectiles } from './forms/projectile';
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

/** Walks into the arena of the event that draws `bossId`'s tier (event N = tier N, owner 2026-10-23). */
function enter(world: World, bossId: ArenaBossId = 'snorlax'): void {
  world.arenaBossesUsed = ARENA_BOSS_IDS.filter((id) => id !== bossId);
  const event = ARENA_BOSSES[bossId].tier - 1;
  world.arenaEventsDone = event;
  world.time = world.arenaSchedule[event]!;
  step(world, IDLE, DT);
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

  it('rubble stops your projectiles: a shot that reaches a rock ends there', () => {
    const { world } = fight();
    const f = world.arena!;
    f.rubble.push({ x: f.x, y: f.y - 150, radius: 26, left: 99 });
    const shot = createProjectile();
    Object.assign(shot, { x: f.x - 100, y: f.y - 150, vx: 300, vy: 0, speed: 300, radius: 6, lifeLeft: 5, dead: false });
    world.projectiles.push(shot);
    for (let i = 0; i < 60 && !shot.dead; i++) updateProjectiles(world, DT);
    expect(shot.dead).toBe(true);
    expect(shot.x).toBeLessThan(f.x);
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
    world.player.x = boss.x;
    world.player.y = boss.y + SNORLAX_KIT.yawn.trigger; // its trigger edge: standing still there is inside the cloud
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

  it('Crunch starts only when its bite reaches you: standing still at its trigger range gets hit', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    world.player.invulnLeft = 0;
    world.player.x = boss.x;
    world.player.y = boss.y + boss.radius + world.player.radius + SNORLAX_KIT.crunch.range - 1;
    // The drawn cone covers your whole body, not just the front of it.
    expect(world.player.y - boss.y + world.player.radius).toBeLessThanOrEqual(SNORLAX_KIT.crunch.reach);
    f.cooldowns.crunch = 0;
    step(world, IDLE, DT);
    expect(f.crunch?.phase).toBe('windup');
    const hp = world.player.hp;
    f.crunch!.left = DT / 2;
    step(world, IDLE, DT);
    expect(world.player.hp).toBeLessThan(hp);
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
  /** Shield down without the Overload window, for tests of the moves themselves. */
  const dropShield = (world: World, zap: NonNullable<World['arena']>['zap'] & object) => {
    breakPylons(world, zap);
    zap.overloadLeft = 0;
    zap.moveGap = 0; // the Overload step held it busy
    world.arenaNotice = null;
  };

  const breakOne = (world: World, zap: NonNullable<World['arena']>['zap'] & object, i: number) => {
    damageEnemy(world, world.enemies.find((en) => en.id === zap.pylons[i]!.enemyId)!, 1e9);
    step(world, IDLE, DT);
  };

  it('three generators shield it (×0.25) while any stands; a lone broken one is rebuilt on its own', () => {
    const { world, boss, zap } = fight();
    expect(zap.pylons.filter((p) => p.enemyId !== null)).toHaveLength(ZAPDOS_KIT.pylons.count);
    expect(world.enemies.filter((e) => e.kind === 'pylon')).toHaveLength(ZAPDOS_KIT.pylons.count);
    expect(damageEnemy(world, boss, 100)).toBeCloseTo(100 * ZAPDOS_KIT.pylons.shieldMult);
    breakOne(world, zap, 0);
    expect(zap.pylons[0]!.enemyId).toBeNull();
    expect(damageEnemy(world, boss, 100)).toBeCloseTo(100 * ZAPDOS_KIT.pylons.shieldMult);
    expect(zap.overloadLeft).toBe(0);
    expect(world.gems).toHaveLength(0); // generators pay no XP
    run(world, ZAPDOS_KIT.pylons.recharge + DT);
    expect(zap.pylons[0]!.enemyId).not.toBeNull();
  });

  it('all generators down at once Overloads it: no moves, ×1.5 damage, then Weakened (slower)', () => {
    const { world, f, boss, zap } = fight();
    const { overload } = ZAPDOS_KIT;
    breakPylons(world, zap);
    expect(world.arenaNotice?.kind).toBe('overloaded');
    expect(zap.overloadLeft).toBeGreaterThan(0);
    expect(damageEnemy(world, boss, 100)).toBeCloseTo(100 * overload.damageTakenMult);
    zap.cooldowns.thunder = 0;
    run(world, 1);
    expect(zap.strikes).toHaveLength(0);
    expect(boss.speed).toBe(0);
    run(world, overload.seconds);
    expect(zap.overloadLeft).toBeLessThanOrEqual(0);
    expect(zap.weakLeft).toBeGreaterThan(0);
    expect(damageEnemy(world, boss, 100)).toBeCloseTo(100);
    zap.cooldowns.thunder = 99;
    zap.strikes = [];
    step(world, IDLE, DT);
    expect(boss.speed).toBeCloseTo(f.bossSpeed * overload.weakSpeedMult);
  });

  it('the phase change waits out an Overload', () => {
    const { world, boss, zap } = fight();
    breakPylons(world, zap);
    boss.hp = boss.maxHp * 0.6;
    run(world, 1);
    expect(zap.phase).toBe(1);
    run(world, ZAPDOS_KIT.overload.seconds);
    expect(zap.phase).toBe(2);
  });

  it('Weakened stretches its moves: a Drill Peck wind-up lasts ×1.5', () => {
    const { world, zap } = fight();
    const { telegraph } = ZAPDOS_KIT.drillPeck;
    zap.weakLeft = 99;
    zap.moveGap = 0;
    zap.cooldowns.drillPeck = 0;
    step(world, IDLE, DT);
    expect(zap.peck?.phase).toBe('windup');
    run(world, telegraph * 1.2);
    expect(zap.peck?.phase).toBe('windup');
    run(world, telegraph * 0.4);
    expect(zap.peck?.phase).not.toBe('windup');
  });

  it('after an Overload all generators rebuild together, so one rebuilt pylon cannot re-trigger it', () => {
    const { world, zap } = fight();
    const { recharge } = ZAPDOS_KIT.pylons;
    breakOne(world, zap, 0);
    run(world, 20);
    breakOne(world, zap, 1);
    breakOne(world, zap, 2);
    expect(zap.overloadLeft).toBeGreaterThan(0);
    for (const p of zap.pylons) expect(p.recharge).toBeCloseTo(recharge - DT, 1);
    run(world, recharge - 1);
    expect(zap.pylons.every((p) => p.enemyId === null)).toBe(true);
    run(world, 2);
    expect(zap.pylons.every((p) => p.enemyId !== null)).toBe(true);
    breakOne(world, zap, 0);
    expect(zap.overloadLeft).toBeLessThanOrEqual(0);
  });

  it('phase gate holds HP at 66%; the Charge-up and Rain Dance animations are immune', () => {
    const { world, boss, zap } = fight();
    dropShield(world, zap);
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
      dropShield(world, zap);
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
    dropShield(world, zap);
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

describe('Machamp (D42)', () => {
  const kit = MACHAMP_KIT;
  function fight() {
    const world = makeWorld();
    enter(world, 'machamp');
    const f = world.arena!;
    world.player.x = f.x;
    world.player.y = f.y + 200;
    world.player.invulnLeft = 999;
    world.moves = []; // no auto-fire: the tests deal damage by hand
    step(world, IDLE, DT); // engages
    const boss = world.enemies.find((e) => e.id === f.bossEnemyId)!;
    const champ = f.champ!;
    for (const id of Object.keys(champ.cooldowns) as (keyof typeof champ.cooldowns)[]) champ.cooldowns[id] = 99;
    champ.poseAfter = 99; // each test opens the move it checks
    return { world, f, boss, champ };
  }
  const run = (world: World, seconds: number) => {
    for (let t = 0; t < seconds; t += DT) step(world, IDLE, DT);
  };
  /** Opens the rock move next to a loose rock and returns once it holds it, with the follow-up forced. */
  const holdRock = (follow: 'throw' | 'strength' | 'iron') => {
    const s = fight();
    s.f.rubble.push({ x: s.boss.x + 60, y: s.boss.y, radius: 26, left: 99 });
    s.champ.cooldowns.rock = 0;
    s.champ.moveGap = 0;
    run(s.world, kit.rock.grab + 2 * DT);
    s.champ.rock!.follow = follow;
    return s;
  };

  it('is a tier 1 boss that resists no starter: the first event can draw it', () => {
    expect(ARENA_BOSSES.machamp.tier).toBe(1);
    const world = makeWorld();
    world.arenaBossesUsed = ['snorlax'];
    expect(arenaBossChoices(world)).toContain('machamp');
  });

  it('is Fighting: Flying hits it ×2', () => {
    const { world, boss } = fight();
    damageEnemy(world, boss, 10, { ...NO_HIT, attackType: 'Flying' });
    expect(boss.lastEffectiveness).toBe(2);
  });

  it('poses after 2–3 attacks: left alone it gains a Bulk Up stack, hit hard enough it is thrown off', () => {
    for (const interrupt of [false, true]) {
      const { world, boss, champ } = fight();
      champ.attacks = 2;
      champ.poseAfter = 2;
      champ.moveGap = 0;
      step(world, IDLE, DT);
      expect(champ.pose?.iron).toBe(false);
      if (interrupt) expect(damageEnemy(world, boss, boss.maxHp * kit.pose.interruptPct * 1.2)).toBeGreaterThan(0); // not immune
      run(world, kit.pose.seconds + DT);
      expect(champ.pose).toBeNull();
      expect(champ.bulk).toBe(interrupt ? 0 : 1);
    }
  });

  it('Karate Chop: re-aimed cone chops; a standing player at its trigger range is hit, harder with Bulk Up', () => {
    const lost: number[] = [];
    for (const bulk of [0, 2]) {
      const { world, boss, champ } = fight();
      champ.bulk = bulk;
      world.player.invulnLeft = 0;
      world.player.x = boss.x;
      world.player.y = boss.y + kit.karateChop.trigger - 1;
      champ.cooldowns.karateChop = 0;
      champ.moveGap = 0;
      step(world, IDLE, DT);
      expect(champ.chops?.close).toBe(false);
      const hp = world.player.hp;
      run(world, kit.karateChop.gaps[0] + DT);
      lost.push(hp - world.player.hp);
    }
    expect(lost[0]).toBeGreaterThan(0);
    expect(lost[1]).toBeCloseTo(lost[0]! * (1 + 2 * kit.pose.stackDamage), 0);
  });

  it('Cross Chop lands an X: on an arm you are hit, between the arms you are safe', () => {
    for (const between of [false, true]) {
      const { world, champ } = fight();
      champ.cooldowns.crossChop = 0;
      champ.moveGap = 0;
      step(world, IDLE, DT);
      const cc = champ.crossChop!;
      const a = between ? cc.angle : cc.angle + Math.PI / 4;
      world.player.x = cc.x + Math.cos(a) * 60;
      world.player.y = cc.y + Math.sin(a) * 60;
      world.player.invulnLeft = 0;
      const hp = world.player.hp;
      run(world, kit.crossChop.crouch + kit.crossChop.telegraph + DT);
      if (between) expect(world.player.hp).toBe(hp);
      else expect(world.player.hp).toBeLessThan(hp);
    }
  });

  it('Seismic Toss throws you away from it (a push, not a stun) for a fixed share of your max HP', () => {
    const { world, boss, champ } = fight();
    world.player.x = boss.x;
    world.player.y = boss.y + boss.radius + world.player.radius + 20;
    world.player.invulnLeft = 0;
    champ.cooldowns.seismicToss = 0;
    champ.moveGap = 0;
    step(world, IDLE, DT);
    expect(champ.toss?.phase).toBe('windup');
    const y = world.player.y;
    const hp = world.player.hp;
    run(world, kit.seismicToss.telegraph + DT);
    expect(world.player.y - y).toBeCloseTo(kit.seismicToss.throwDistance, 0);
    expect(hp - world.player.hp).toBeCloseTo(world.player.maxHp * kit.seismicToss.hpPct, 0);
  });

  it('the rock in hand: it grabs a loose rock as a shield your shots wear down; breaking it staggers it', () => {
    const { world, f, boss, champ } = fight();
    f.rubble.push({ x: boss.x + 60, y: boss.y, radius: 26, left: 99 });
    champ.cooldowns.rock = 0;
    champ.moveGap = 0;
    step(world, IDLE, DT);
    expect(champ.rock?.phase).toBe('grab');
    expect(f.rubble).toHaveLength(0);
    run(world, kit.rock.grab + DT);
    const stone = champ.rock!.stone!;
    expect(stone.hp).toBeCloseTo(boss.maxHp * kit.rock.shieldHpPct);
    const shot = createProjectile();
    Object.assign(shot, { x: stone.x, y: stone.y + 60, vx: 0, vy: -300, speed: 300, radius: 6, damage: stone.hp! + 1, lifeLeft: 5, dead: false });
    world.projectiles.push(shot);
    for (let i = 0; i < 30 && !shot.dead; i++) updateProjectiles(world, DT);
    expect(stone.hp).toBeLessThanOrEqual(0);
    expect(boss.hp).toBe(boss.maxHp); // the shield took it
    step(world, IDLE, DT);
    expect(champ.rock).toBeNull();
    expect(champ.staggerLeft).toBeGreaterThan(0);
    expect(f.rubble).not.toContain(stone);
  });

  it('with no rock in reach it rips one from the ground, which takes longer', () => {
    const { world, champ } = fight();
    champ.cooldowns.rock = 0;
    champ.moveGap = 0;
    step(world, IDLE, DT);
    expect(champ.rock?.phase).toBe('rip');
    expect(kit.rock.rip).toBeGreaterThan(kit.rock.grab);
  });

  it('Rock Throw: a lob onto a lead-aimed ring that cracks into rocks around the spot', () => {
    const { world, f, champ } = holdRock('throw');
    world.player.invulnLeft = 0;
    const hp = world.player.hp;
    run(world, kit.rock.tell + DT);
    const lob = champ.lob!;
    expect(lob).not.toBeNull();
    expect(lob.tx).toBeCloseTo(world.player.x, 0); // standing still: no lead
    run(world, kit.rockThrow.telegraph + DT);
    expect(world.player.hp).toBeLessThan(hp);
    expect(f.rubble.filter((r) => r.hp === undefined)).toHaveLength(kit.rockThrow.cracks);
  });

  it('Strength: it charges behind its rock, plants, and shoves boulders along a locked line; they stay at the wall', () => {
    const { world, f, champ } = holdRock('strength');
    world.player.y = f.y + 400; // beyond where it plants, so it has to charge
    run(world, kit.rock.tell + DT);
    expect(champ.rock?.phase).toBe('charge');
    for (let t = 0; t < 5 && champ.rock?.phase === 'charge'; t += DT) step(world, IDLE, DT);
    expect(champ.rock?.phase).toBe('plant');
    run(world, kit.strength.telegraph + DT);
    expect(champ.boulders).toHaveLength(kit.strength.boulders);
    run(world, 3);
    expect(champ.boulders).toHaveLength(0);
    const atWall = f.rubble.filter((r) => Math.hypot(r.x - f.x, r.y - f.y) >= f.radius - 2 * kit.strength.radius);
    expect(atWall.length).toBeGreaterThanOrEqual(kit.strength.boulders);
  });

  it('Iron Pose (rare): it poses behind its planted rock; completed, it gains two stacks and the rock stays', () => {
    const { world, f, champ } = holdRock('iron');
    run(world, kit.rock.tell + DT);
    expect(champ.pose?.iron).toBe(true);
    run(world, kit.pose.seconds + DT);
    expect(champ.bulk).toBe(kit.ironPose.stacks);
    expect(champ.rock).toBeNull();
    expect(f.rubble.some((r) => r.hp === undefined && r.left <= kit.rockThrow.stay)).toBe(true);
  });

  it('phase gate holds HP at 66%; Focus Energy is an immune animation', () => {
    const { world, boss, champ } = fight();
    damageEnemy(world, boss, boss.maxHp);
    expect(boss.hp).toBeCloseTo(boss.maxHp * kit.phaseAt[0]);
    champ.moveGap = 0;
    step(world, IDLE, DT);
    expect(champ.phase).toBe(2);
    expect(world.arenaNotice?.kind).toBe('focusEnergy');
    expect(damageEnemy(world, boss, 100)).toBe(0);
  });

  it('Focus Blast: an orb your shots can kill; left alone it bursts on you', () => {
    for (const shoot of [true, false]) {
      const { world, f, boss, champ } = fight();
      world.player.y = f.y + 400;
      champ.phase = 2;
      champ.cooldowns.focusBlast = 0;
      champ.moveGap = 0;
      step(world, IDLE, DT);
      run(world, kit.focusBlast.cast + DT);
      expect(champ.orbs).toHaveLength(1);
      const orb = world.enemies.find((e) => e.kind === 'focusOrb')!;
      expect(orb.maxHp).toBeCloseTo(boss.maxHp * kit.focusBlast.hpPct);
      if (shoot) {
        damageEnemy(world, orb, orb.maxHp);
        step(world, IDLE, DT);
        expect(champ.orbs).toHaveLength(0);
      } else {
        world.player.invulnLeft = 0;
        const hp = world.player.hp;
        for (let t = 0; t < 5 && champ.orbs.length > 0; t += DT) step(world, IDLE, DT);
        expect(world.player.hp).toBeLessThan(hp);
      }
    }
  });

  it('Focus Punch: enough damage during the focus staggers it; otherwise a locked line across the arena', () => {
    for (const interrupt of [true, false]) {
      const { world, boss, champ } = fight();
      champ.phase = 3;
      champ.cooldowns.focusPunch = 0;
      champ.moveGap = 0;
      step(world, IDLE, DT);
      expect(champ.focus?.phase).toBe('channel');
      if (interrupt) {
        damageEnemy(world, boss, boss.maxHp * kit.focusPunch.interruptPct * 1.2);
        step(world, IDLE, DT);
        expect(champ.focus).toBeNull();
        expect(champ.staggerLeft).toBeGreaterThan(0);
      } else {
        world.player.invulnLeft = 0;
        const hp = world.player.hp;
        run(world, kit.focusPunch.channel + kit.focusPunch.telegraph + DT);
        expect(world.player.hp).toBeLessThan(hp);
      }
    }
  });

  it('a long fight with auto-fire and a circling player: no NaN, and most of the kit gets used', () => {
    const world = makeWorld();
    enter(world, 'machamp');
    const f = world.arena!;
    const used = new Set<string>();
    let posed = false;
    for (let t = 0; t < 120 && world.arena; t += DT) {
      world.player.hp = world.player.maxHp; // stay alive: this checks the boss, not the player
      const a = t * 0.8;
      step(world, { moveX: Math.cos(a), moveY: Math.sin(a) }, DT);
      const champ = f.champ!;
      if (champ.lastMove) used.add(champ.lastMove);
      if (champ.pose) posed = true;
      const boss = world.enemies.find((e) => e.id === f.bossEnemyId);
      if (boss) expect(Number.isFinite(boss.x) && Number.isFinite(boss.y)).toBe(true);
    }
    expect(posed).toBe(true);
    expect(used.size).toBeGreaterThanOrEqual(5);
  });

  it('Close Combat: a flurry, then its defences drop (it takes more for a moment)', () => {
    const { world, boss, champ } = fight();
    champ.phase = 3;
    world.player.x = boss.x;
    world.player.y = boss.y + kit.closeCombat.trigger - 1;
    champ.cooldowns.closeCombat = 0;
    champ.moveGap = 0;
    step(world, IDLE, DT);
    expect(champ.chops?.close).toBe(true);
    run(world, kit.closeCombat.gap * kit.closeCombat.hits + 0.2);
    expect(champ.openLeft).toBeGreaterThan(0);
    expect(damageEnemy(world, boss, 100)).toBeCloseTo(100 * kit.closeCombat.weakMult);
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
