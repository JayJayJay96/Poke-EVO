import type { MeleeMoveDef } from '../../data/moves';
import { MAX_ENEMY_RADIUS, damageEnemy, findNearestEnemy, makeHitInfo, queryEnemies } from '../combat';
import type { MoveSlot, World } from '../types';
import { spawnZone } from '../zones';

/** How long the swipe stays visible. Presentation only. */
export const SWING_SECONDS = 0.15;

const neighbours: number[] = [];

/** Swipes toward the nearest enemy, hitting everything inside the arc at once. */
export function castMelee(world: World, slot: MoveSlot, def: MeleeMoveDef): boolean {
  const { player, enemies } = world;
  const reach = def.reach * slot.stats.area * slot.stats.reachMult;
  const target = findNearestEnemy(world, reach + MAX_ENEMY_RADIUS);
  if (!target) return false;

  const tx = target.x - player.x;
  const ty = target.y - player.y;
  const tdist = Math.hypot(tx, ty);
  const dirX = tdist > 0 ? tx / tdist : 1;
  const dirY = tdist > 0 ? ty / tdist : 0;
  const halfArc = Math.min(Math.PI, (def.arcDegrees * slot.stats.arcMult * Math.PI) / 360);
  const cosHalf = Math.cos(halfArc);
  const hit = makeHitInfo(slot.stats, slot);

  queryEnemies(world, player.x, player.y, reach, neighbours);
  for (const j of neighbours) {
    const enemy = enemies[j]!;
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist - enemy.radius > reach) continue;
    // Enemies overlapping the player's centre are always inside the swipe.
    const inArc = dist <= enemy.radius || (dx * dirX + dy * dirY) / dist >= cosHalf;
    if (!inArc) continue;
    // Knock away from the player.
    hit.dirX = dist > 0 ? dx / dist : dirX;
    hit.dirY = dist > 0 ? dy / dist : dirY;
    damageEnemy(world, enemy, slot.stats.damage, hit);
  }

  world.swings.push({ x: player.x, y: player.y, dirX, dirY, reach, halfArc, lifeLeft: SWING_SECONDS });

  // Frenzy Plant: the swing leaves a root field on its target (part of the move, not a proc).
  const field = def.field;
  if (field) {
    const s = slot.stats;
    spawnZone(
      world,
      target.x,
      target.y,
      field.radius * s.area * s.blastRadiusMult,
      field.duration * s.duration * s.zoneDurationMult,
      field.tickInterval,
      s.damage * field.damageFraction * s.zoneDamageMult,
      s.critChance,
      {
        slow: field.onTick?.slow ?? 0,
        stun: field.onTick?.stun ?? 0,
        poisonDps: s.damage * (field.onTick?.poisonPct ?? 0),
        attackType: s.attackType,
      },
      slot.moveId,
    );
  }
  return true;
}
