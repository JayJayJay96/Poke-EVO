import type { ZoneMoveDef } from '../../data/moves';
import { damageEnemy, findTarget, makeHitInfo, queryEnemies } from '../combat';
import { reactArea } from '../mapReactions';
import type { Enemy, MoveSlot, World } from '../types';
import { spawnZone, strikeZone } from '../zones';

/** How long Slash's X stays visible. Presentation only. */
export const CUT_SECONDS = 0.2;

const neighbours: number[] = [];

/**
 * Drops a lingering zone on the nearest enemy (Poison Powder, Sleep Powder…), or on yourself
 * (Smokescreen), or makes one instant cut there (Slash).
 * Each tick deals the move's damage plus its innate statuses (P4a).
 */
export function castZone(world: World, slot: MoveSlot, def: ZoneMoveDef): boolean {
  const target = findTarget(world, slot, def.range);
  if (!target) return false;
  const s = slot.stats;
  const { x, y } = def.target === 'self' ? world.player : target;
  if (def.barrier) {
    raiseBarrier(world, slot, def);
    return true;
  }
  // Map reactions (README §8.1): a zone reacts once, when cast, at its centre and the cells it covers.
  reactArea(world, x, y, def.radius * s.area, s.attackType, s.damage);
  if (def.delay !== undefined) {
    // Future Sight (D56): a telegraphed circle that bursts after the delay.
    strikeZone(world, x, y, def.radius * s.area, def.delay, s.damage, s.critChance, {
      slow: s.slow,
      stun: s.stun,
      poisonDps: 0,
      attackType: s.attackType,
    });
    return true;
  }
  if (def.instant) {
    cutAt(world, slot, x, y, def.radius * s.area, s.damage, def.splashFraction ?? 1, def.splashFraction ? target : null);
    if (def.ring) ringAt(world, slot, x, y, def.radius * s.area, def.ring.radius * s.area, s.damage * def.ring.damageFraction);
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

/** Reflect (D56): a barrier on the player for the move's duration. */
export function raiseBarrier(world: World, slot: MoveSlot, def: ZoneMoveDef): void {
  const p = world.player;
  p.barrierLeft = def.duration * slot.stats.duration * slot.stats.zoneDurationMult;
  p.barrierCut = def.barrier!.contactCut;
  p.barrierRangedCut = 0;
  p.barrierThorns = 0;
  p.barrierRadius = def.radius * slot.stats.area;
}

/** Expanding Force (D56): the ring between the burst and `outer` takes a move hit for `damage`. */
export function ringAt(world: World, slot: MoveSlot, x: number, y: number, inner: number, outer: number, damage: number): void {
  const hit = makeHitInfo(slot.stats, slot);
  queryEnemies(world, x, y, outer, neighbours);
  for (const j of neighbours) {
    const e = world.enemies[j]!;
    const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (e.hp <= 0 || d2 > (outer + e.radius) ** 2 || d2 <= (inner + e.radius) ** 2) continue;
    damageEnemy(world, e, damage, hit);
  }
  world.blasts.push({ x, y, radius: outer, lifeLeft: CUT_SECONDS, type: 'Psychic' });
}

/** One instant cut: a full hit of the move on everything in the circle (Slash). */
export function cutAt(
  world: World,
  slot: MoveSlot,
  x: number,
  y: number,
  radius: number,
  damage = slot.stats.damage,
  splash = 1,
  center: Enemy | null = null,
): void {
  const hit = makeHitInfo(slot.stats, slot);
  queryEnemies(world, x, y, radius, neighbours);
  for (const j of neighbours) {
    const e = world.enemies[j]!;
    if (e.hp <= 0 || (e.x - x) ** 2 + (e.y - y) ** 2 > (radius + e.radius) ** 2) continue;
    // D57: a splash move hits its target in full and the rest for `splash`.
    damageEnemy(world, e, center === null || e === center ? damage : damage * splash, hit);
  }
  world.cuts.push({ x, y, radius, lifeLeft: CUT_SECONDS });
}
