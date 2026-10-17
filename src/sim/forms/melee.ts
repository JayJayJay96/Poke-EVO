import type { MeleeMoveDef } from '../../data/moves';
import { MAX_ENEMY_RADIUS, damageEnemy, findNearestEnemy, queryEnemies } from '../combat';
import type { MoveSlot, World } from '../types';

/** How long the swipe stays visible. Presentation only. */
export const SWING_SECONDS = 0.15;

const neighbours: number[] = [];

/** Swipes toward the nearest enemy, hitting everything inside the arc at once. */
export function castMelee(world: World, slot: MoveSlot, def: MeleeMoveDef): boolean {
  const { player, enemies } = world;
  const reach = def.reach * slot.stats.area;
  const target = findNearestEnemy(world, reach + MAX_ENEMY_RADIUS);
  if (!target) return false;

  const tx = target.x - player.x;
  const ty = target.y - player.y;
  const tdist = Math.hypot(tx, ty);
  const dirX = tdist > 0 ? tx / tdist : 1;
  const dirY = tdist > 0 ? ty / tdist : 0;
  const halfArc = (def.arcDegrees * Math.PI) / 360;
  const cosHalf = Math.cos(halfArc);

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
    damageEnemy(world, enemy, slot.stats.damage, slot.stats.critChance);
  }

  world.swings.push({ x: player.x, y: player.y, dirX, dirY, reach, halfArc, lifeLeft: SWING_SECONDS });
  return true;
}
