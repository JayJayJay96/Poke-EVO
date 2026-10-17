import type { BeamMoveDef } from '../../data/moves';
import { damageEnemy, findNearestEnemy, queryEnemies } from '../combat';
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
  return def.length * slot.stats.area;
}

export function updateBeam(world: World, slot: MoveSlot, def: BeamMoveDef, dt: number): void {
  if (slot.activeLeft <= 0) return;
  slot.activeLeft -= dt;
  slot.tickLeft -= dt;
  if (slot.tickLeft > 0) return;
  slot.tickLeft += def.tickInterval;

  const { player, enemies } = world;
  const length = beamLength(slot, def);
  const halfWidth = (def.width * slot.stats.area) / 2;
  const midX = player.x + (slot.dirX * length) / 2;
  const midY = player.y + (slot.dirY * length) / 2;
  queryEnemies(world, midX, midY, length / 2 + halfWidth, neighbours);
  for (const j of neighbours) {
    const enemy = enemies[j]!;
    if (enemy.hp <= 0) continue;
    // Distance from the enemy centre to the beam segment.
    const ex = enemy.x - player.x;
    const ey = enemy.y - player.y;
    const along = Math.min(length, Math.max(0, ex * slot.dirX + ey * slot.dirY));
    const cx = ex - slot.dirX * along;
    const cy = ey - slot.dirY * along;
    const reach = halfWidth + enemy.radius;
    if (cx * cx + cy * cy > reach * reach) continue;
    damageEnemy(world, enemy, slot.stats.damage, slot.stats.critChance);
  }
}
