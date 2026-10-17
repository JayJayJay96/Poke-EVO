import { TUNING } from '../data/content';
import { NO_HIT, damageEnemy, queryEnemies } from './combat';
import type { World } from './types';

// Lingering damage areas (Blast Burn's crater; Bulbasaur's fields in P4).
// Zones only deal damage: they never spawn further effects (no proc-from-proc, §8.6).

const neighbours: number[] = [];

/** Adds a zone unless the zone budget is full. Returns whether it was added. */
export function spawnZone(
  world: World,
  x: number,
  y: number,
  radius: number,
  duration: number,
  tickInterval: number,
  damage: number,
  critChance: number,
): boolean {
  if (world.zones.length >= TUNING.budget.maxZones || duration <= 0) return false;
  world.zones.push({
    id: world.nextId++,
    x,
    y,
    radius,
    lifeLeft: duration,
    duration,
    tickInterval,
    // The impact already hit; the first zone tick lands one interval later.
    tickLeft: tickInterval,
    damage,
    critChance,
  });
  return true;
}

export function updateZones(world: World, dt: number): void {
  const { enemies } = world;
  for (const zone of world.zones) {
    zone.lifeLeft -= dt;
    if (zone.lifeLeft <= 0) continue;
    zone.tickLeft -= dt;
    if (zone.tickLeft > 0) continue;
    zone.tickLeft += zone.tickInterval;
    // Zone ticks only deal damage (and may crit): no other on-hit effects.
    const hit = zone.critChance > 0 ? { ...NO_HIT, critChance: zone.critChance } : NO_HIT;
    queryEnemies(world, zone.x, zone.y, zone.radius, neighbours);
    for (const j of neighbours) {
      const enemy = enemies[j]!;
      if (enemy.hp <= 0) continue;
      const dx = enemy.x - zone.x;
      const dy = enemy.y - zone.y;
      const reach = zone.radius + enemy.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      damageEnemy(world, enemy, zone.damage, hit);
    }
  }
}
