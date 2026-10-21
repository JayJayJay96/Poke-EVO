import { describe, expect, it } from 'vitest';
import { ARENA_BOSSES, ARENA_TUNING, SNORLAX_KIT } from '../data/arena';
import { ENEMIES, TUNING } from '../data/content';
import { arenaBossChoices, arenaSchedule, chooseArenaReward, chooseCombine, resolveArena, rollRewardCards, skipCombine } from './arena';
import { damageEnemy } from './combat';
import { MAX_COMBO_MOVES, comboCandidates, comboCooldown, learnsetSlotsUsed } from './combo';
import { buildCardPool } from './progression';
import { createSeededRng } from './rng';
import { createSlot, refreshStats } from './stats';
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
    step(world, IDLE, DT);
    const hp2 = world.player.hp;
    world.player.y = f.slam!.y - f.slam!.radius - 60; // step out of the ring before it lands
    f.slam!.left = DT / 2;
    step(world, IDLE, DT);
    expect(world.player.hp).toBe(hp2);
  });

  it('Gluttony: a berry drops in the arena, Snorlax walks to it and eats it to heal 8%', () => {
    const { world, boss } = fight();
    const f = world.arena!;
    f.slamCooldown = 99;
    f.berryTimer = 0;
    boss.hp = boss.maxHp * 0.8; // above the first Rest threshold (B2)
    world.player.invulnLeft = 99;
    step(world, IDLE, DT);
    const berry = world.berries.find((b) => b.kind === 'oran')!;
    expect(Math.hypot(berry.x - f.x, berry.y - f.y)).toBeLessThanOrEqual(f.radius);
    expect(f.goal).toEqual({ x: berry.x, y: berry.y });
    boss.x = berry.x;
    boss.y = berry.y;
    step(world, IDLE, DT);
    expect(boss.hp).toBeCloseTo(boss.maxHp * (0.8 + SNORLAX_KIT.gluttony.healPct), 0);
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
    f.slamCooldown = 99; // keep slams out of the way
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
    expect(boss.hp).toBeCloseTo(boss.maxHp * (0.6 + SNORLAX_KIT.rest.healPct), -1);
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
