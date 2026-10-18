import { TUNING } from '../data/content';
import { NO_HIT, damageEnemy, queryEnemies } from './combat';
import type { MoveId } from '../data/moves';
import type { HitInfo, World, Zone } from './types';

// Lingering damage areas (Blast Burn's crater; zone-cast moves like Poison Powder, P4).
// A zone may carry innate statuses (slow / stun / poison) applied on each tick.
// Zones only deal damage: they never spawn further effects (no proc-from-proc, §8.6).

const neighbours: number[] = [];

/** Statuses a zone applies on each tick. */
export type ZoneEffects = Pick<HitInfo, 'slow' | 'stun' | 'poisonDps' | 'attackType'> & {
  readonly stunKind?: HitInfo['stunKind'];
};

/** Adds a zone unless the zone budget is full. Returns it, or null when the budget is full. */
export function spawnZone(
  world: World,
  x: number,
  y: number,
  radius: number,
  duration: number,
  tickInterval: number,
  damage: number,
  critChance: number,
  effects: ZoneEffects = NO_HIT,
  source: MoveId | null = null,
): Zone | null {
  if (world.zones.length >= TUNING.budget.maxZones || duration <= 0) return null;
  const zone: Zone = {
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
    stunKind: effects.stunKind ?? null,
    poisonDps: effects.poisonDps,
    attackType: effects.attackType,
    source,
  };
  world.zones.push(zone);
  return zone;
}

/** Keeps a one-tick zone alive a few steps past its tick, so float drift can never skip it. Engine constant. */
const STRIKE_LINGER = 0.05;

/**
 * A delayed strike (Thunder, a meteor, a hailstone): the circle shows as a telegraph and deals
 * its damage once, `delay` seconds later.
 */
export function strikeZone(
  world: World,
  x: number,
  y: number,
  radius: number,
  delay: number,
  damage: number,
  critChance: number,
  effects: ZoneEffects = NO_HIT,
): Zone | null {
  return spawnZone(world, x, y, radius, delay + STRIKE_LINGER, delay, damage, critChance, effects);
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
    const hit = {
      ...NO_HIT,
      critChance: zone.critChance,
      slow: zone.slow,
      stun: zone.stun,
      stunKind: zone.stunKind,
      poisonDps: zone.poisonDps,
      attackType: zone.attackType,
    };
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
