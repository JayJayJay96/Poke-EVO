import type { ZoneMoveDef } from '../../data/moves';
import { findNearestEnemy } from '../combat';
import type { MoveSlot, World } from '../types';
import { spawnZone } from '../zones';

/**
 * Drops a lingering zone on the nearest enemy (Poison Powder, Sleep Powder…).
 * Each tick deals the move's damage plus its innate statuses (P4a).
 */
export function castZone(world: World, slot: MoveSlot, def: ZoneMoveDef): boolean {
  const target = findNearestEnemy(world, def.range);
  if (!target) return false;
  const s = slot.stats;
  const zone = spawnZone(
    world,
    target.x,
    target.y,
    def.radius * s.area,
    def.duration * s.duration * s.zoneDurationMult,
    def.tickInterval,
    s.damage * s.zoneDamageMult,
    s.critChance,
    { slow: s.slow, stun: s.stun, poisonDps: s.damage * s.poisonPct, attackType: s.attackType },
  );
  return zone !== null;
}
