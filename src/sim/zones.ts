import { TUNING } from '../data/content';
import { NO_HIT, damageEnemy, queryEnemies } from './combat';
import type { HitInfo, World } from './types';

// Lingering damage areas (Blast Burn's crater; zone-cast moves like Poison Powder, P4).
// A zone may carry innate statuses (slow / stun / poison) applied on each tick.
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
  effects: Pick<HitInfo, 'slow' | 'stun' | 'poisonDps'> = NO_HIT,
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
    slow: effects.slow,
    stun: effects.stun,
    poisonDps: effects.poisonDps,
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
    // Zone ticks deal damage (may crit) plus the zone's own innate statuses; no other on-hit effects.
    const hit = { ...NO_HIT, critChance: zone.critChance, slow: zone.slow, stun: zone.stun, poisonDps: zone.poisonDps };
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
