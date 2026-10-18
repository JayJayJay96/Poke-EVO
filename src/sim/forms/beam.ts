import type { BeamMoveDef } from '../../data/moves';
import { damageEnemy, findNearestEnemy, makeHitInfo, queryEnemies } from '../combat';
import { hooksOf } from '../hooks';
import type { MoveSlot, World } from '../types';

const neighbours: number[] = [];

/** Locks a direction toward the nearest enemy; the beam then follows the player for its duration. */
export function castBeam(world: World, slot: MoveSlot, def: BeamMoveDef): boolean {
  const target = findNearestEnemy(world, def.range);
  if (!target) return false;
  const dx = target.x - world.player.x;
  const dy = target.y - world.player.y;
  const dist = Math.hypot(dx, dy);
  slot.dirX = dist > 0 ? dx / dist : 1;
  slot.dirY = dist > 0 ? dy / dist : 0;
  slot.activeLeft = def.duration * slot.stats.duration;
  slot.tickLeft = 0; // first tick lands immediately
  return true;
}

export function beamLength(slot: MoveSlot, def: BeamMoveDef): number {
  return def.length * slot.stats.area * slot.stats.reachMult;
}

export function updateBeam(world: World, slot: MoveSlot, def: BeamMoveDef, dt: number): void {
  if (slot.activeLeft <= 0) return;
  slot.activeLeft -= dt;
  if (slot.activeLeft <= 0) hooksOf(slot)?.onExpire?.(world, slot);
  slot.tickLeft -= dt;
  if (slot.tickLeft > 0) return;
  slot.tickLeft += def.tickInterval;

  const dirs = hooksOf(slot)?.beamDirs?.(world, slot);
  if (!dirs) {
    beamTick(world, slot, def, slot.dirX, slot.dirY);
    return;
  }
  for (const [dx, dy] of dirs) beamTick(world, slot, def, dx, dy);
}

/** One damage tick along one beam direction. */
function beamTick(world: World, slot: MoveSlot, def: BeamMoveDef, dirX: number, dirY: number): void {
  const { player, enemies } = world;
  const length = beamLength(slot, def);
  const halfWidth = (def.width * slot.stats.area * slot.stats.widthMult) / 2;
  const midX = player.x + (dirX * length) / 2;
  const midY = player.y + (dirY * length) / 2;
  const hit = makeHitInfo(slot.stats, slot);
  hit.dirX = dirX;
  hit.dirY = dirY;
  queryEnemies(world, midX, midY, length / 2 + halfWidth, neighbours);
  for (const j of neighbours) {
    const enemy = enemies[j]!;
    if (enemy.hp <= 0) continue;
    // Distance from the enemy centre to the beam segment.
    const ex = enemy.x - player.x;
    const ey = enemy.y - player.y;
    const along = Math.min(length, Math.max(0, ex * dirX + ey * dirY));
    const cx = ex - dirX * along;
    const cy = ey - dirY * along;
    const reach = halfWidth + enemy.radius;
    if (cx * cx + cy * cy > reach * reach) continue;
    damageEnemy(world, enemy, slot.stats.damage, hit);
  }
}
