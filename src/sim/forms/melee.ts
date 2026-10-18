import type { MeleeMoveDef } from '../../data/moves';
import { MAX_ENEMY_RADIUS, damageEnemy, findNearestEnemy, makeHitInfo, queryEnemies } from '../combat';
import type { MoveSlot, World } from '../types';
import { spawnZone } from '../zones';

/** How long the swipe stays visible. Presentation only. */
export const SWING_SECONDS = 0.15;

const neighbours: number[] = [];

/** Swipes toward the nearest enemy, hitting everything inside the arc at once. */
export function castMelee(world: World, slot: MoveSlot, def: MeleeMoveDef): boolean {
  const { player } = world;
  const reach = def.reach * slot.stats.area * slot.stats.reachMult;
  const target = findNearestEnemy(world, reach + MAX_ENEMY_RADIUS);
  if (!target) return false;
  const arcDegrees = def.arcDegrees * slot.stats.arcMult;

  if (def.sides) {
    // Wing beats: arcs aimed relative to your facing, wherever the target is.
    for (const deg of def.sides) {
      const [dx, dy] = turned(player.faceX, player.faceY, deg);
      swingArc(world, slot, dx, dy, arcDegrees, reach);
    }
    return true;
  }

  const tx = target.x - player.x;
  const ty = target.y - player.y;
  const tdist = Math.hypot(tx, ty);
  swingArc(world, slot, tdist > 0 ? tx / tdist : 1, tdist > 0 ? ty / tdist : 0, arcDegrees, reach);

  // Frenzy Plant: the swing leaves a root field on its target (part of the move, not a proc).
  const field = def.field;
  if (field) {
    const s = slot.stats;
    spawnZone(
      world,
      target.x,
      target.y,
      field.radius * s.area * s.blastRadiusMult,
      field.duration * s.duration * s.zoneDurationMult,
      field.tickInterval,
      s.damage * field.damageFraction * s.zoneDamageMult,
      s.critChance,
      {
        slow: field.onTick?.slow ?? 0,
        stun: field.onTick?.stun ?? 0,
        poisonDps: s.damage * (field.onTick?.poisonPct ?? 0),
        attackType: s.attackType,
      },
      slot.moveId,
    );
  }
  return true;
}

/** (x, y) turned by `deg` degrees; screen y points down, so +90 is to the left of the direction. */
export function turned(x: number, y: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c + y * s, -x * s + y * c];
}

/** One swipe from the player along (dirX, dirY): hits everything inside the arc at once, and is drawn. */
export function swingArc(
  world: World,
  slot: MoveSlot,
  dirX: number,
  dirY: number,
  arcDegrees: number,
  reach: number,
  damage = slot.stats.damage,
): void {
  const { player, enemies } = world;
  const halfArc = Math.min(Math.PI, (arcDegrees * Math.PI) / 360);
  const cosHalf = Math.cos(halfArc);
  const hit = makeHitInfo(slot.stats, slot);

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
    // Knock away from the player.
    hit.dirX = dist > 0 ? dx / dist : dirX;
    hit.dirY = dist > 0 ? dy / dist : dirY;
    damageEnemy(world, enemy, damage, hit);
  }

  world.swings.push({ x: player.x, y: player.y, dirX, dirY, reach, halfArc, lifeLeft: SWING_SECONDS });
}
