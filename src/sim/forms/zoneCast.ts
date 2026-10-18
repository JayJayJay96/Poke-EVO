import type { ZoneMoveDef } from '../../data/moves';
import { damageEnemy, findNearestEnemy, makeHitInfo, queryEnemies } from '../combat';
import type { MoveSlot, World } from '../types';
import { spawnZone } from '../zones';

/** How long Slash's X stays visible. Presentation only. */
export const CUT_SECONDS = 0.2;

const neighbours: number[] = [];

/**
 * Drops a lingering zone on the nearest enemy (Poison Powder, Sleep Powder…), or on yourself
 * (Smokescreen), or makes one instant cut there (Slash).
 * Each tick deals the move's damage plus its innate statuses (P4a).
 */
export function castZone(world: World, slot: MoveSlot, def: ZoneMoveDef): boolean {
  const target = findNearestEnemy(world, def.range);
  if (!target) return false;
  const s = slot.stats;
  const { x, y } = def.target === 'self' ? world.player : target;
  if (def.instant) {
    cutAt(world, slot, x, y, def.radius * s.area);
    return true;
  }
  const zone = spawnZone(
    world,
    x,
    y,
    def.radius * s.area,
    def.duration * s.duration * s.zoneDurationMult,
    def.tickInterval,
    s.damage * s.zoneDamageMult,
    s.critChance,
    {
      slow: s.slow,
      stun: s.stun,
      stunKind: s.stunKind,
      poisonDps: s.damage * s.poisonPct,
      attackType: s.attackType,
      blind: def.onHit?.blind ?? 0,
    },
    def.id,
  );
  return zone !== null;
}

/** One instant cut: a full hit of the move on everything in the circle (Slash). */
export function cutAt(world: World, slot: MoveSlot, x: number, y: number, radius: number, damage = slot.stats.damage): void {
  const hit = makeHitInfo(slot.stats, slot);
  queryEnemies(world, x, y, radius, neighbours);
  for (const j of neighbours) {
    const e = world.enemies[j]!;
    if (e.hp <= 0 || (e.x - x) ** 2 + (e.y - y) ** 2 > (radius + e.radius) ** 2) continue;
    damageEnemy(world, e, damage, hit);
  }
  world.cuts.push({ x, y, radius, lifeLeft: CUT_SECONDS });
}
