import type { ProjectileMoveDef } from '../../data/moves';
import { damageEnemy, findNearestEnemy, queryEnemies } from '../combat';
import type { MoveSlot, World } from '../types';

/** Angle between neighbouring projectiles when a cast fires several. */
const SPREAD_RADIANS = 0.21;

const neighbours: number[] = [];

export function castProjectile(world: World, slot: MoveSlot, def: ProjectileMoveDef): boolean {
  const target = findNearestEnemy(world, def.range);
  if (!target) return false; // stays ready and fires the moment something is in range
  const { player } = world;
  const base = Math.atan2(target.y - player.y, target.x - player.x);
  for (let i = 0; i < def.count; i++) {
    const angle = base + (i - (def.count - 1) / 2) * SPREAD_RADIANS;
    world.projectiles.push({
      id: world.nextId++,
      moveId: def.id,
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * def.projectileSpeed,
      vy: Math.sin(angle) * def.projectileSpeed,
      radius: def.projectileRadius * slot.stats.area,
      damage: slot.stats.damage,
      critChance: slot.stats.critChance,
      lifeLeft: def.projectileLifetime * slot.stats.duration,
      dead: false,
    });
  }
  return true;
}

export function updateProjectiles(world: World, dt: number): void {
  const { enemies } = world;
  for (const proj of world.projectiles) {
    if (proj.dead) continue;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.lifeLeft -= dt;
    if (proj.lifeLeft <= 0) {
      proj.dead = true;
      continue;
    }
    queryEnemies(world, proj.x, proj.y, proj.radius, neighbours);
    for (const j of neighbours) {
      const enemy = enemies[j]!;
      if (enemy.hp <= 0) continue;
      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const reach = enemy.radius + proj.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      damageEnemy(world, enemy, proj.damage, proj.critChance);
      proj.dead = true; // no pierce yet
      break;
    }
  }
}
