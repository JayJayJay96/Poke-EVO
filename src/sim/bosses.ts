import { SNORLAX_KIT, type ArenaBossId } from '../data/arena';
import { BLAST_SECONDS } from './forms/projectile';
import type { ArenaFight, Enemy, SnorlaxMove, World } from './types';
import { hitPlayer } from './world';

// Arena boss behaviour (D28; BOSSES.md §3: telegraph → act → recover). One function per boss, run each
// step once the fight has started. Boss attacks never proc anything; every aimed attack locks its target
// when its telegraph appears (BOSSES.md §2 fairness rules).

type BossAi = (world: World, fight: ArenaFight, boss: Enemy, dt: number) => void;

const DEG = Math.PI / 180;

/** A point pulled back inside the arena, `margin` px from its wall. */
function insideArena(fight: ArenaFight, x: number, y: number, margin: number) {
  const dx = x - fight.x;
  const dy = y - fight.y;
  const d = Math.hypot(dx, dy);
  const max = fight.radius - margin;
  return d > max ? { x: fight.x + (dx / d) * max, y: fight.y + (dy / d) * max } : { x, y };
}

/** The landing point for a lead-aimed strike, kept inside the arena (BOSSES.md §2). */
export function leadAim(world: World, fight: ArenaFight, windup: number, lead: number, margin: number) {
  const { player } = world;
  return insideArena(fight, player.x + player.vx * windup * lead, player.y + player.vy * windup * lead, margin);
}

/** Smallest absolute difference between two angles, in radians. */
export function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

/** A boss attack lands on the player unless they're still invulnerable from the last hit. */
function strike(world: World, boss: Enemy, factor: number): void {
  if (world.player.invulnLeft <= 0) hitPlayer(world, boss.contactDamage * factor, boss);
}

/** Whether the player stands in a cone from (x, y). */
function inCone(world: World, x: number, y: number, angle: number, reach: number, arcDeg: number): boolean {
  const { player } = world;
  const d = Math.hypot(player.x - x, player.y - y);
  return d <= reach + player.radius && angleGap(Math.atan2(player.y - y, player.x - x), angle) <= (arcDeg * DEG) / 2;
}

/** Rocks become rubble that blocks the player; the oldest crumble past the cap. */
function addRubble(fight: ArenaFight, x: number, y: number): void {
  const { rubble } = SNORLAX_KIT.bodySlam;
  fight.rubble.push({ x, y, radius: rubble.radius, left: rubble.seconds });
  if (fight.rubble.length > rubble.max) fight.rubble.splice(0, fight.rubble.length - rubble.max);
}

function startSlam(world: World, fight: ArenaFight, boss: Enemy, windup: number): void {
  const { bodySlam } = SNORLAX_KIT;
  const target = leadAim(world, fight, windup, bodySlam.lead, boss.radius);
  fight.slam = { ...target, radius: bodySlam.radius, windup, left: windup, phase: 'windup' };
}

/** Body Slam: wind-up on the locked ring, land (hit + rubble), recover; from phase 2 it chains. */
function updateSlam(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { bodySlam } = SNORLAX_KIT;
  const slam = fight.slam!;
  const { player } = world;
  slam.left -= dt;
  if (slam.phase === 'windup' && slam.left <= 0) {
    boss.x = slam.x;
    boss.y = slam.y;
    world.blasts.push({ x: slam.x, y: slam.y, radius: slam.radius, lifeLeft: BLAST_SECONDS, type: 'Normal' });
    if (Math.hypot(player.x - slam.x, player.y - slam.y) <= slam.radius + player.radius) strike(world, boss, bodySlam.damageFactor);
    for (let i = 0; i < bodySlam.rubble.count; i++) {
      const a = world.rng.next() * Math.PI * 2;
      addRubble(fight, slam.x + Math.cos(a) * slam.radius, slam.y + Math.sin(a) * slam.radius);
    }
    slam.phase = 'recover';
    slam.left = bodySlam.recover;
  } else if (slam.phase === 'recover' && slam.left <= 0) {
    fight.slam = null;
    if (fight.slamsQueued > 0) {
      fight.slamsQueued--;
      startSlam(world, fight, boss, bodySlam.windup);
    } else {
      fight.slamCooldown = bodySlam.cooldown;
    }
  }
}

/** Hyper Beam: a line from Snorlax toward where you stood, then a long recharge. */
function updateBeam(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { hyperBeam } = SNORLAX_KIT;
  const beam = fight.beam!;
  const { player } = world;
  beam.left -= dt;
  if (beam.phase === 'windup' && beam.left <= 0) {
    // Distance from the player to the beam's segment.
    const ux = Math.cos(beam.angle);
    const uy = Math.sin(beam.angle);
    const along = Math.max(0, Math.min(hyperBeam.length, (player.x - beam.x) * ux + (player.y - beam.y) * uy));
    const off = Math.hypot(player.x - (beam.x + ux * along), player.y - (beam.y + uy * along));
    if (off <= hyperBeam.width / 2 + player.radius) strike(world, boss, hyperBeam.damageFactor);
    beam.phase = 'recharge';
    beam.left = hyperBeam.recharge;
  } else if (beam.phase === 'recharge' && beam.left <= 0) {
    fight.beam = null;
    fight.beamCooldown = hyperBeam.cooldown;
  }
}

/** Rest: asleep, healing and snoring; the wake meter can cut it short. Ends by moving to the next phase. */
function updateRest(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { rest, snore, bellyDrum } = SNORLAX_KIT;
  const sleep = fight.rest!;
  const woke = sleep.wake >= boss.maxHp * rest.wakeAtPct;
  if (!woke) {
    sleep.left -= dt;
    boss.hp = Math.min(boss.maxHp, boss.hp + ((boss.maxHp * rest.healPct) / rest.seconds) * dt);
    fight.snoreTimer -= dt;
    if (fight.snoreTimer <= 0) {
      fight.snoreTimer = snore.interval;
      fight.snores.push({ x: boss.x, y: boss.y, r: boss.radius, gapAngle: fight.nextSnoreGap, hit: false });
      fight.nextSnoreGap += snore.gapTurnDeg * DEG;
    }
  }
  if (!woke && sleep.left > 0) return;
  fight.rest = null;
  fight.phase++;
  if (woke) {
    world.arenaNotice = { kind: 'woke', bossId: fight.bossId };
    startSlam(world, fight, boss, rest.wakeSlamWindup);
  }
  if (fight.phase === 3) {
    boss.hp *= bellyDrum.hpMult;
    boss.contactDamage *= bellyDrum.contactMult;
    // It drums its belly before anything else, immune (owner 2026-10-22); a wake slam waits for it.
    fight.drumLeft = bellyDrum.seconds;
    world.arenaNotice = { kind: 'bellyDrum', bossId: fight.bossId };
  }
}

/** Snore rings fly outward; one with you on its edge hits unless you're inside its gap. */
function updateSnores(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { snore } = SNORLAX_KIT;
  const { player } = world;
  for (const ring of fight.snores) {
    ring.r += snore.speed * dt;
    if (ring.hit) continue;
    const d = Math.hypot(player.x - ring.x, player.y - ring.y);
    if (Math.abs(d - ring.r) > snore.thickness / 2 + player.radius) continue;
    const a = Math.atan2(player.y - ring.y, player.x - ring.x);
    if (snoreOpenings(fight, ring).some((o) => angleGap(a, o.angle) <= o.half)) continue;
    ring.hit = true;
    strike(world, boss, snore.damageFactor);
  }
  fight.snores = fight.snores.filter((ring) => ring.r <= snore.maxRadius);
}

/**
 * Where a Snore ring is open: its gap, plus the shadow of every rock it has already passed, seen from where
 * Snorlax sleeps (owner 2026-10-21). Shared by the hit test and the drawing, so what looks safe is safe.
 */
export function snoreOpenings(fight: ArenaFight, ring: ArenaFight['snores'][number]): { angle: number; half: number }[] {
  const open = [{ angle: ring.gapAngle, half: (SNORLAX_KIT.snore.gapDeg * DEG) / 2 }];
  for (const rock of fight.rubble) {
    const d = Math.hypot(rock.x - ring.x, rock.y - ring.y);
    if (d >= ring.r || d <= rock.radius) continue;
    open.push({ angle: Math.atan2(rock.y - ring.y, rock.x - ring.x), half: Math.asin(rock.radius / d) });
  }
  return open;
}

/** Yawn: cone telegraph, then a drowsy cloud that slows the player standing in it. */
function updateYawn(world: World, fight: ArenaFight, dt: number): void {
  const { yawn } = SNORLAX_KIT;
  const cloud = fight.yawn!;
  cloud.left -= dt;
  if (cloud.phase === 'windup' && cloud.left <= 0) {
    cloud.phase = 'cloud';
    cloud.left = yawn.cloudSeconds;
  } else if (cloud.phase === 'cloud') {
    if (cloud.left <= 0) {
      fight.yawn = null;
      fight.yawnCooldown = yawn.cooldown;
      return;
    }
    if (inCone(world, cloud.x, cloud.y, cloud.angle, yawn.range, yawn.arcDeg)) fight.playerSlow = yawn.slow;
  }
}

/** Crunch: a short bite cone, then a short recover. */
function updateCrunch(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { crunch } = SNORLAX_KIT;
  const bite = fight.crunch!;
  bite.left -= dt;
  if (bite.phase === 'windup' && bite.left <= 0) {
    if (inCone(world, boss.x, boss.y, bite.angle, crunch.reach, crunch.arcDeg)) strike(world, boss, crunch.damageFactor);
    bite.phase = 'recover';
    bite.left = crunch.recover;
  } else if (bite.phase === 'recover' && bite.left <= 0) {
    fight.crunch = null;
    fight.cooldowns.crunch = crunch.cooldown;
  }
}

/** Rock Slide: rocks on ring telegraphs where you are, where you're heading and scattered around you. */
function startRockSlide(world: World, fight: ArenaFight): void {
  const { rockSlide } = SNORLAX_KIT;
  const { player } = world;
  const fall = rockSlide.cast + rockSlide.telegraph;
  const spots = [insideArena(fight, player.x, player.y, rockSlide.radius), leadAim(world, fight, fall, 1, rockSlide.radius)];
  while (spots.length < rockSlide.rocks) {
    const a = world.rng.next() * Math.PI * 2;
    const d = Math.sqrt(world.rng.next()) * rockSlide.scatter;
    spots.push(insideArena(fight, player.x + Math.cos(a) * d, player.y + Math.sin(a) * d, rockSlide.radius));
  }
  // The scattered ones (never the rock on you) stay as rubble.
  spots.forEach((s, i) => fight.rocks.push({ ...s, left: fall, keep: i >= 2 && i < 2 + rockSlide.keep }));
  fight.rockSlideLeft = rockSlide.cast;
}

/** Falling rocks land on their own, after Snorlax's roar. */
function updateRocks(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { rockSlide } = SNORLAX_KIT;
  const { player } = world;
  for (const rock of fight.rocks) {
    rock.left -= dt;
    if (rock.left > 0) continue;
    world.blasts.push({ x: rock.x, y: rock.y, radius: rockSlide.radius, lifeLeft: BLAST_SECONDS, type: 'Normal' });
    if (Math.hypot(player.x - rock.x, player.y - rock.y) <= rockSlide.radius + player.radius) strike(world, boss, rockSlide.damageFactor);
    if (rock.keep) addRubble(fight, rock.x, rock.y);
  }
  fight.rocks = fight.rocks.filter((rock) => rock.left > 0);
  if (fight.rockSlideLeft > 0) {
    fight.rockSlideLeft -= dt;
    if (fight.rockSlideLeft <= 0) fight.cooldowns.rockSlide = rockSlide.cooldown;
  }
}

/** Fling: picks up the rubble rock nearest to it (the cover is gone) and aims it at your lead-aimed spot. */
function startFling(world: World, fight: ArenaFight, boss: Enemy): void {
  const { fling } = SNORLAX_KIT;
  let best = 0;
  for (let i = 1; i < fight.rubble.length; i++) {
    const r = fight.rubble[i]!;
    const b = fight.rubble[best]!;
    if (Math.hypot(r.x - boss.x, r.y - boss.y) < Math.hypot(b.x - boss.x, b.y - boss.y)) best = i;
  }
  const [rock] = fight.rubble.splice(best, 1);
  const target = leadAim(world, fight, fling.telegraph, fling.lead, 0);
  fight.fling = { x: rock!.x, y: rock!.y, tx: target.x, ty: target.y, left: fling.telegraph };
}

function updateFling(fight: ArenaFight, dt: number): void {
  const { fling } = SNORLAX_KIT;
  const throwing = fight.fling!;
  throwing.left -= dt;
  if (throwing.left > 0) return;
  const a = Math.atan2(throwing.ty - throwing.y, throwing.tx - throwing.x);
  const vx = Math.cos(a) * fling.speed;
  const vy = Math.sin(a) * fling.speed;
  fight.shots.push({ x: throwing.x, y: throwing.y, vx, vy, radius: fling.radius, left: 4, factor: fling.damageFactor, kind: 'rock' });
  fight.fling = null;
  fight.cooldowns.fling = fling.cooldown;
}

/** Boss projectiles: they hit once; a flung rock bursts into shards flying back in from the wall. */
function updateShots(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { fling } = SNORLAX_KIT;
  const { player } = world;
  const shards: ArenaFight['shots'] = [];
  for (const shot of fight.shots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.left -= dt;
    if (Math.hypot(player.x - shot.x, player.y - shot.y) <= shot.radius + player.radius) {
      strike(world, boss, shot.factor);
      shot.left = 0;
      continue;
    }
    if (Math.hypot(shot.x - fight.x, shot.y - fight.y) < fight.radius - shot.radius) continue;
    if (shot.kind === 'rock') {
      const inward = Math.atan2(fight.y - shot.y, fight.x - shot.x);
      for (let i = 0; i < fling.shards; i++) {
        const a = inward + (i - (fling.shards - 1) / 2) * fling.shardSpreadDeg * DEG;
        const sx = Math.cos(a) * fling.shardSpeed;
        const sy = Math.sin(a) * fling.shardSpeed;
        shards.push({ x: shot.x, y: shot.y, vx: sx, vy: sy, radius: fling.shardRadius, left: 2, factor: fling.shardFactor, kind: 'shard' });
      }
      shot.left = 0;
    } else if (shot.kind === 'shard') {
      // Shards fly in from the wall: they only die once they're heading out again.
      if ((shot.x - fight.x) * shot.vx + (shot.y - fight.y) * shot.vy > 0) shot.left = 0;
    } else {
      shot.left = 0;
    }
  }
  fight.shots = fight.shots.filter((shot) => shot.left > 0).concat(shards);
}

/** Heavy Slam: crouch, airborne (immune) with the shadow chasing you, lock, land, recover. */
function updateHeavySlam(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { heavySlam } = SNORLAX_KIT;
  const hs = fight.heavySlam!;
  const { player } = world;
  hs.left -= dt;
  if (hs.phase === 'air') {
    const dx = player.x - hs.x;
    const dy = player.y - hs.y;
    const d = Math.hypot(dx, dy);
    const stepLen = Math.min(d, heavySlam.shadowSpeed * dt);
    if (d > 0) {
      hs.x += (dx / d) * stepLen;
      hs.y += (dy / d) * stepLen;
    }
  }
  if (hs.left > 0) return;
  if (hs.phase === 'crouch') {
    hs.phase = 'air';
    hs.left = heavySlam.air;
  } else if (hs.phase === 'air') {
    hs.phase = 'lock';
    hs.left = heavySlam.lock;
  } else if (hs.phase === 'lock') {
    const land = insideArena(fight, hs.x, hs.y, boss.radius);
    boss.x = land.x;
    boss.y = land.y;
    world.blasts.push({ x: land.x, y: land.y, radius: heavySlam.radius, lifeLeft: BLAST_SECONDS, type: 'Normal' });
    if (Math.hypot(player.x - land.x, player.y - land.y) <= heavySlam.radius + player.radius) strike(world, boss, heavySlam.damageFactor);
    for (let i = 0; i < heavySlam.rubble; i++) {
      const a = world.rng.next() * Math.PI * 2;
      addRubble(fight, land.x + Math.cos(a) * heavySlam.radius, land.y + Math.sin(a) * heavySlam.radius);
    }
    hs.phase = 'recover';
    hs.left = heavySlam.recover;
  } else {
    fight.heavySlam = null;
    fight.cooldowns.heavySlam = heavySlam.cooldown;
  }
}

/** Block: a short chain telegraph, then the leash holds; Snorlax keeps acting meanwhile. */
function updateBlock(fight: ArenaFight, dt: number): void {
  const { block } = SNORLAX_KIT;
  const chain = fight.block!;
  chain.left -= dt;
  if (chain.left > 0) return;
  if (chain.phase === 'windup') {
    chain.phase = 'hold';
    chain.left = block.seconds;
  } else {
    fight.block = null;
    fight.cooldowns.block = block.cooldown;
  }
}

/** Keeps the player within Block's leash of Snorlax (run after movement, like the arena wall). */
export function holdByBlock(world: World, fight: ArenaFight, boss: Enemy): void {
  if (fight.block?.phase !== 'hold') return;
  const { player } = world;
  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const d = Math.hypot(dx, dy);
  const leash = SNORLAX_KIT.block.leash;
  if (d <= leash) return;
  player.x = boss.x + (dx / d) * leash;
  player.y = boss.y + (dy / d) * leash;
}

/** Belch: a cone telegraph, then gas puffs at mixed speeds across the cone. */
function updateBelch(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { belch } = SNORLAX_KIT;
  const burp = fight.belch!;
  burp.left -= dt;
  if (burp.left > 0) return;
  if (burp.phase === 'recover') {
    fight.belch = null;
    return;
  }
  const arc = belch.arcDeg * DEG;
  for (let i = 0; i < belch.puffs; i++) {
    const a = burp.angle - arc / 2 + (arc * i) / (belch.puffs - 1);
    const speed = belch.speedMin + world.rng.next() * (belch.speedMax - belch.speedMin);
    const x = boss.x + Math.cos(a) * boss.radius;
    const y = boss.y + Math.sin(a) * boss.radius;
    fight.shots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, radius: belch.radius, left: belch.life, factor: belch.damageFactor, kind: 'gas' });
  }
  burp.phase = 'recover';
  burp.left = belch.recover;
}

/** Which Earthquake band the player is in: 0 inner, 1 middle, 2 outer. */
export function quakeBand(world: World, quake: NonNullable<ArenaFight['quake']>): number {
  const [inner, outer] = SNORLAX_KIT.earthquake.bands;
  const d = Math.hypot(world.player.x - quake.x, world.player.y - quake.y);
  return d < inner ? 0 : d < outer ? 1 : 2;
}

/** Earthquake: the inner and outer bands hit, then the middle one; move between them in rhythm. */
function updateQuake(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { earthquake } = SNORLAX_KIT;
  const quake = fight.quake!;
  quake.left -= dt;
  if (quake.left > 0) return;
  if (quake.phase === 'recover') {
    fight.quake = null;
    fight.cooldowns.earthquake = earthquake.cooldown;
    return;
  }
  const band = quakeBand(world, quake);
  const hitHere = quake.step === 1 ? band !== 1 : band === 1;
  world.blasts.push({ x: quake.x, y: quake.y, radius: earthquake.bands[1], lifeLeft: BLAST_SECONDS, type: 'Normal' });
  if (hitHere) strike(world, boss, earthquake.damageFactor);
  if (quake.step === 1) {
    quake.step = 2;
    quake.left = earthquake.telegraph;
  } else {
    quake.phase = 'recover';
    quake.left = earthquake.recover;
  }
}

/**
 * Picks the next move by weight among those ready, in range and unlocked for the phase; never the same move twice
 * in a row (BOSSES.md §3). Belch always comes first after a berry is eaten.
 */
function pickMove(world: World, fight: ArenaFight, boss: Enemy): void {
  const kit = SNORLAX_KIT;
  const { player } = world;
  const toPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
  const distance = Math.hypot(player.x - boss.x, player.y - boss.y);
  const cd = fight.cooldowns;
  const start = (id: SnorlaxMove, begin: () => void): void => {
    begin();
    fight.lastMove = id;
    fight.moveGap = kit.moveGap;
  };
  if (fight.belchReady) {
    fight.belchReady = false;
    start('belch', () => (fight.belch = { angle: toPlayer, left: kit.belch.telegraph, phase: 'windup' }));
    return;
  }
  const ready: { id: Exclude<SnorlaxMove, 'belch'>; begin: () => void }[] = [];
  const add = (id: Exclude<SnorlaxMove, 'belch'>, ok: boolean, begin: () => void): void => {
    if (ok) ready.push({ id, begin });
  };
  add('bodySlam', fight.slamCooldown <= 0 && distance <= kit.bodySlam.range, () => {
    if (fight.phase >= 2) fight.slamsQueued = kit.bodySlam.chainFromPhase2 - 1;
    startSlam(world, fight, boss, kit.bodySlam.windup);
  });
  add('crunch', cd.crunch <= 0 && distance - boss.radius - player.radius <= kit.crunch.range, () => {
    fight.crunch = { angle: toPlayer, left: kit.crunch.telegraph, phase: 'windup' };
  });
  add('rockSlide', cd.rockSlide <= 0, () => startRockSlide(world, fight));
  // Yawn only within the cloud's reach, so it isn't wasted on a player kiting far away (owner 2026-10-21).
  add('yawn', fight.phase >= 2 && !fight.yawn && fight.yawnCooldown <= 0 && distance <= kit.yawn.range, () => {
    fight.yawn = { x: boss.x, y: boss.y, angle: toPlayer, left: kit.yawn.telegraph, phase: 'windup' };
  });
  add('fling', fight.phase >= 2 && cd.fling <= 0 && fight.rubble.length > 0, () => startFling(world, fight, boss));
  add('heavySlam', fight.phase >= 2 && cd.heavySlam <= 0, () => {
    fight.heavySlam = { x: boss.x, y: boss.y, left: kit.heavySlam.crouch, phase: 'crouch' };
  });
  add('block', fight.phase >= 2 && !fight.block && cd.block <= 0 && distance >= kit.block.minDistance, () => {
    fight.block = { left: kit.block.telegraph, phase: 'windup' };
  });
  add('hyperBeam', fight.phase >= 3 && fight.beamCooldown <= 0, () => {
    fight.beam = { x: boss.x, y: boss.y, angle: toPlayer, left: kit.hyperBeam.telegraph, phase: 'windup' };
  });
  add('earthquake', fight.phase >= 3 && cd.earthquake <= 0, () => {
    fight.quake = { x: boss.x, y: boss.y, left: kit.earthquake.telegraph, step: 1, phase: 'windup' };
  });
  const pool = ready.length > 1 ? ready.filter((m) => m.id !== fight.lastMove) : ready;
  if (pool.length === 0) return;
  let roll = pool.length === 1 ? 0 : world.rng.next() * pool.reduce((sum, m) => sum + kit.weights[m.id], 0);
  const pick = pool.find((m) => (roll -= kit.weights[m.id]) < 0) ?? pool[pool.length - 1]!;
  start(pick.id, pick.begin);
}

/**
 * Snorlax (BOSSES.md §4). Phase 1: Body Slam, Crunch, Rock Slide, Gluttony (+ Belch after eating). Rest at 66% and
 * 33% (interrupt bar, Snore). Phase 2 adds Yawn, Fling, Heavy Slam, Block and paired slams; phase 3 starts with
 * Belly Drum and adds Hyper Beam and Earthquake. Immune during the berry shake, Belly Drum and Heavy Slam's leap.
 */
function snorlax(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { gluttony, restAt, rest, moveGap } = SNORLAX_KIT;
  fight.slamCooldown -= dt;
  fight.berryTimer -= dt;
  fight.yawnCooldown -= dt;
  fight.beamCooldown -= dt;
  fight.moveGap -= dt;
  for (const id of Object.keys(fight.cooldowns) as (keyof ArenaFight['cooldowns'])[]) fight.cooldowns[id] -= dt;
  fight.playerSlow = 0;
  for (const rock of fight.rubble) rock.left -= dt;
  fight.rubble = fight.rubble.filter((rock) => rock.left > 0);
  updateSnores(world, fight, boss, dt);
  updateRocks(world, fight, boss, dt);
  updateShots(world, fight, boss, dt);
  if (fight.yawn) updateYawn(world, fight, dt);
  if (fight.block) updateBlock(fight, dt);

  const berries = world.berries.filter((b) => b.kind === 'oran' && !b.collected);

  fight.goal = null;
  if (fight.rest) updateRest(world, fight, boss, dt);
  else if (fight.drumLeft > 0) fight.drumLeft -= dt;
  else if (fight.slam) updateSlam(world, fight, boss, dt);
  else if (fight.beam) updateBeam(world, fight, boss, dt);
  else if (fight.heavySlam) updateHeavySlam(world, fight, boss, dt);
  else if (fight.crunch) updateCrunch(world, fight, boss, dt);
  else if (fight.fling) updateFling(fight, dt);
  else if (fight.belch) updateBelch(world, fight, boss, dt);
  else if (fight.quake) updateQuake(world, fight, boss, dt);
  else if (fight.rockSlideLeft > 0) {
    // Roaring while the rocks start to fall (handled in updateRocks).
  } else if (fight.shakeLeft > 0) {
    // Gluttony (owner 2026-10-21): Snorlax shakes the ground; the berry pops up partway through, so the
    // player sees it before Snorlax moves. Immune meanwhile (owner 2026-10-22).
    fight.shakeLeft -= dt;
    if (!fight.berryDropped && gluttony.shakeSeconds - fight.shakeLeft >= gluttony.dropAt) {
      fight.berryDropped = true;
      const angle = world.rng.next() * Math.PI * 2;
      const dist = Math.sqrt(world.rng.next()) * fight.radius * 0.8;
      world.berries.push({
        id: world.nextId++,
        kind: 'oran',
        x: fight.x + Math.cos(angle) * dist,
        y: fight.y + Math.sin(angle) * dist,
        collected: false,
      });
    }
    if (fight.shakeLeft <= 0) {
      fight.berryTimer = gluttony.interval;
      // Rare surprise (owner 2026-10-21): Body Slam straight onto the new berry instead of running to it.
      let berry = null;
      for (let i = world.berries.length - 1; i >= 0 && !berry; i--) {
        const b = world.berries[i]!;
        if (b.kind === 'oran' && !b.collected) berry = b;
      }
      if (berry && world.rng.next() < gluttony.leapChance) {
        const { radius, windup } = SNORLAX_KIT.bodySlam;
        fight.slam = { x: berry.x, y: berry.y, radius, windup, left: windup, phase: 'windup' };
      }
    }
  } else if (fight.phase <= restAt.length && boss.hp <= boss.maxHp * restAt[fight.phase - 1]!) {
    // Rest at each HP threshold (the phase gate holds HP here until it starts); a Yawn in progress is dropped.
    fight.rest = { left: rest.seconds, wake: 0 };
    fight.snoreTimer = 0;
    fight.yawn = null;
    world.arenaNotice = { kind: 'rest', bossId: fight.bossId };
  } else {
    // Free: go for the nearest berry (and eat it), else the player; then pick a move.
    let nearest: (typeof berries)[number] | null = null;
    for (const b of berries) {
      if (!nearest || Math.hypot(b.x - boss.x, b.y - boss.y) < Math.hypot(nearest.x - boss.x, nearest.y - boss.y)) {
        nearest = b;
      }
    }
    fight.goal = nearest ? { x: nearest.x, y: nearest.y } : null;
    if (nearest && Math.hypot(nearest.x - boss.x, nearest.y - boss.y) <= boss.radius + 8) {
      nearest.collected = true;
      boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * gluttony.healPct);
      fight.belchReady = true;
    }
    if (nearest || fight.moveGap > 0) {
      // Hangry: while a berry is down it only goes for the berry. Otherwise a short pause between moves.
    } else if (fight.berryTimer <= 0 && berries.length < gluttony.maxBerries) {
      fight.shakeLeft = gluttony.shakeSeconds;
      fight.berryDropped = false;
    } else {
      pickMove(world, fight, boss);
    }
  }

  // Snorlax stands still during its moves (not Yawn or Block); it rushes a berry (hangry), else walks.
  const busy =
    fight.rest ||
    fight.drumLeft > 0 ||
    fight.slam ||
    fight.beam ||
    fight.heavySlam ||
    fight.crunch ||
    fight.fling ||
    fight.belch ||
    fight.quake ||
    fight.rockSlideLeft > 0 ||
    fight.shakeLeft > 0;
  if (busy) fight.moveGap = Math.max(fight.moveGap, moveGap);
  boss.speed = busy ? 0 : fight.bossSpeed * (fight.goal ? gluttony.rushMult : 1);
}

const BOSS_AI: Readonly<Record<ArenaBossId, BossAi>> = { snorlax };

/** Runs the boss's behaviour for this step (only once the fight has started). */
export function updateBoss(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  BOSS_AI[fight.bossId](world, fight, boss, dt);
}

/** Pushes the player out of any rubble (B2): rocks block you, not Snorlax. */
export function blockByRubble(world: World, fight: ArenaFight): void {
  const { player } = world;
  for (const rock of fight.rubble) {
    const dx = player.x - rock.x;
    const dy = player.y - rock.y;
    const d = Math.hypot(dx, dy);
    const min = rock.radius + player.radius;
    if (d >= min) continue;
    const ux = d > 0 ? dx / d : 1;
    const uy = d > 0 ? dy / d : 0;
    player.x = rock.x + ux * min;
    player.y = rock.y + uy * min;
  }
}
