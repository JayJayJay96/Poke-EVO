import { SNORLAX_KIT, type ArenaBossId } from '../data/arena';
import { BLAST_SECONDS } from './forms/projectile';
import type { ArenaFight, Enemy, World } from './types';
import { hitPlayer } from './world';

// Arena boss behaviour (D28; BOSSES.md §3: telegraph → act → recover). One function per boss, run each
// step once the fight has started. Boss attacks never proc anything.

type BossAi = (world: World, fight: ArenaFight, boss: Enemy, dt: number) => void;

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

/** Snorlax phase 1: Body Slam on a lead-aimed ring, and Gluttony berries it races you for. */
function snorlax(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const { bodySlam, gluttony } = SNORLAX_KIT;
  const { player } = world;
  fight.slamCooldown -= dt;
  fight.berryTimer -= dt;

  // Gluttony: an Oran Berry drops somewhere in the arena every so often.
  const berries = world.berries.filter((b) => b.kind === 'oran' && !b.collected);
  if (fight.berryTimer <= 0) {
    fight.berryTimer = gluttony.interval;
    if (berries.length < gluttony.maxBerries) {
      const angle = world.rng.next() * Math.PI * 2;
      const dist = Math.sqrt(world.rng.next()) * fight.radius * 0.8;
      const berry = {
        id: world.nextId++,
        kind: 'oran' as const,
        x: fight.x + Math.cos(angle) * dist,
        y: fight.y + Math.sin(angle) * dist,
        collected: false,
      };
      world.berries.push(berry);
      berries.push(berry);
    }
  }

  const slam = fight.slam;
  if (slam) {
    fight.goal = null;
    slam.left -= dt;
    if (slam.phase === 'windup' && slam.left <= 0) {
      // Land: everything inside the ring is hit.
      boss.x = slam.x;
      boss.y = slam.y;
      world.blasts.push({ x: slam.x, y: slam.y, radius: slam.radius, lifeLeft: BLAST_SECONDS, type: 'Normal' });
      const reach = slam.radius + player.radius;
      if (player.invulnLeft <= 0 && Math.hypot(player.x - slam.x, player.y - slam.y) <= reach) {
        hitPlayer(world, boss.contactDamage * bodySlam.damageFactor, boss);
      }
      slam.phase = 'recover';
      slam.left = bodySlam.recover;
    } else if (slam.phase === 'recover' && slam.left <= 0) {
      fight.slam = null;
      fight.slamCooldown = bodySlam.cooldown;
      boss.speed = fight.bossSpeed;
    }
    return;
  }

  // Walk to the nearest berry and eat it; otherwise chase the player.
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

  if (fight.slamCooldown <= 0 && Math.hypot(player.x - boss.x, player.y - boss.y) <= bodySlam.range) {
    const target = leadAim(world, fight, bodySlam.windup, bodySlam.lead, boss.radius);
    fight.slam = { ...target, radius: bodySlam.radius, windup: bodySlam.windup, left: bodySlam.windup, phase: 'windup' };
    boss.speed = 0; // braces for the leap
  }
}

const BOSS_AI: Readonly<Record<ArenaBossId, BossAi>> = { snorlax };

/** Runs the boss's behaviour for this step (only once the fight has started). */
export function updateBoss(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  BOSS_AI[fight.bossId](world, fight, boss, dt);
}
