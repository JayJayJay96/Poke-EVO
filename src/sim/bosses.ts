import { SNORLAX_KIT, type ArenaBossId } from '../data/arena';
import { BLAST_SECONDS } from './forms/projectile';
import type { ArenaFight, Enemy, World } from './types';
import { hitPlayer } from './world';

// Arena boss behaviour (D28; BOSSES.md §3: telegraph → act → recover). One function per boss, run each
// step once the fight has started. Boss attacks never proc anything; every aimed attack locks its target
// when its telegraph appears (BOSSES.md §2 fairness rules).

type BossAi = (world: World, fight: ArenaFight, boss: Enemy, dt: number) => void;

const DEG = Math.PI / 180;

/** The landing point for a lead-aimed strike, kept inside the arena (BOSSES.md §2). */
export function leadAim(world: World, fight: ArenaFight, windup: number, lead: number, margin: number) {
  const { player } = world;
  let x = player.x + player.vx * windup * lead;
  let y = player.y + player.vy * windup * lead;
  const dx = x - fight.x;
  const dy = y - fight.y;
  const d = Math.hypot(dx, dy);
  const max = fight.radius - margin;
  if (d > max) {
    x = fight.x + (dx / d) * max;
    y = fight.y + (dy / d) * max;
  }
  return { x, y };
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
    const { rubble } = bodySlam;
    for (let i = 0; i < rubble.count; i++) {
      const a = world.rng.next() * Math.PI * 2;
      fight.rubble.push({ x: slam.x + Math.cos(a) * slam.radius, y: slam.y + Math.sin(a) * slam.radius, radius: rubble.radius, left: rubble.seconds });
    }
    if (fight.rubble.length > rubble.max) fight.rubble.splice(0, fight.rubble.length - rubble.max);
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
  const { player } = world;
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
    const d = Math.hypot(player.x - cloud.x, player.y - cloud.y);
    const inside = d <= yawn.range && angleGap(Math.atan2(player.y - cloud.y, player.x - cloud.x), cloud.angle) <= (yawn.arcDeg * DEG) / 2;
    if (inside) fight.playerSlow = yawn.slow;
  }
}

/**
 * Snorlax (BOSSES.md §4). Phase 1: Body Slam (rubble) + Gluttony. Rest at 66% and 33% (interrupt bar, Snore).
 * Phase 2 adds Yawn and double slams; phase 3 starts with Belly Drum and adds Hyper Beam.
 */
function snorlax(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { bodySlam, gluttony, restAt, rest, yawn, hyperBeam } = SNORLAX_KIT;
  const { player } = world;
  fight.slamCooldown -= dt;
  fight.berryTimer -= dt;
  fight.yawnCooldown -= dt;
  fight.beamCooldown -= dt;
  fight.playerSlow = 0;
  for (const rock of fight.rubble) rock.left -= dt;
  fight.rubble = fight.rubble.filter((rock) => rock.left > 0);
  updateSnores(world, fight, boss, dt);
  if (fight.yawn) updateYawn(world, fight, dt);

  const berries = world.berries.filter((b) => b.kind === 'oran' && !b.collected);

  fight.goal = null;
  if (fight.rest) updateRest(world, fight, boss, dt);
  else if (fight.slam) updateSlam(world, fight, boss, dt);
  else if (fight.beam) updateBeam(world, fight, boss, dt);
  else if (fight.shakeLeft > 0) {
    // Gluttony (owner 2026-10-21): Snorlax shakes the ground; the berry pops up partway through, so the
    // player sees it before Snorlax moves.
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
  }
  else if (fight.phase <= restAt.length && boss.hp <= boss.maxHp * restAt[fight.phase - 1]!) {
    // Rest at each HP threshold; a Yawn in progress is dropped.
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
    }
    const toPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
    const distance = Math.hypot(player.x - boss.x, player.y - boss.y);
    if (nearest) {
      // Hangry: while a berry is down it only goes for the berry.
    } else if (fight.berryTimer <= 0 && berries.length < gluttony.maxBerries) {
      fight.shakeLeft = gluttony.shakeSeconds;
      fight.berryDropped = false;
    } else if (fight.phase >= 3 && fight.beamCooldown <= 0) {
      fight.beam = { x: boss.x, y: boss.y, angle: toPlayer, left: hyperBeam.telegraph, phase: 'windup' };
    } else if (fight.slamCooldown <= 0 && distance <= bodySlam.range) {
      if (fight.phase >= 2) fight.slamsQueued = bodySlam.chainFromPhase2 - 1;
      startSlam(world, fight, boss, bodySlam.windup);
    } else if (fight.phase >= 2 && !fight.yawn && fight.yawnCooldown <= 0 && distance <= yawn.range) {
      // Only within the cloud's reach, so it isn't wasted on a player kiting far away (owner 2026-10-21).
      fight.yawn = { x: boss.x, y: boss.y, angle: toPlayer, left: yawn.telegraph, phase: 'windup' };
    }
  }

  // Snorlax stands still while asleep, slamming, beaming or shaking; it rushes a berry (hangry), else walks.
  const busy = fight.rest || fight.slam || fight.beam || fight.shakeLeft > 0;
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
