import type { OrbitMoveDef } from '../../data/moves';
import { damageEnemy, makeHitInfo, queryEnemies } from '../combat';
import { hooksOf } from '../hooks';
import { MAP_TUNING } from '../../data/map';
import { reactAt, reacts } from '../mapReactions';
import type { MoveSlot, Player, World } from '../types';

const neighbours: number[] = [];
/** Seconds until each orbit's balls next react with the map (README §8.1). shortcut: per slot, not per ball. */
const reactLeft = new WeakMap<MoveSlot, number>();

export interface OrbitBall {
  x: number;
  y: number;
  r: number;
}

/** Orbits need no target: casting just sends the balls out. */
export function castOrbit(_world: World, slot: MoveSlot, def: OrbitMoveDef): boolean {
  slot.activeLeft = def.duration * slot.stats.duration;
  slot.hitCooldowns.clear();
  return true;
}

/** Where the orbit circles: the player, or an anchor point (Tornado). */
export function orbitCenter(slot: MoveSlot, player: Player): { x: number; y: number } {
  return slot.anchored ? { x: slot.anchorX, y: slot.anchorY } : player;
}

export function orbitBalls(slot: MoveSlot, def: OrbitMoveDef, player: Player): OrbitBall[] {
  const radius = def.orbitRadius * slot.stats.area * slot.stats.orbitRadiusMult;
  const r = def.ballRadius * slot.stats.area;
  const { x, y } = orbitCenter(slot, player);
  const count = def.count + slot.stats.extraCount;
  const balls: OrbitBall[] = [];
  for (let i = 0; i < count; i++) {
    const angle = slot.angle + (i * Math.PI * 2) / count;
    balls.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius, r });
  }
  return balls;
}

export function updateOrbit(world: World, slot: MoveSlot, def: OrbitMoveDef, dt: number): void {
  if (slot.activeLeft <= 0) return;
  slot.activeLeft -= dt;
  if (slot.activeLeft <= 0) hooksOf(slot)?.onExpire?.(world, slot);
  slot.angle += def.angularSpeed * slot.stats.spinMult * dt;
  if (reacts(slot.stats.attackType)) {
    const left = (reactLeft.get(slot) ?? 0) - dt;
    reactLeft.set(slot, left > 0 ? left : MAP_TUNING.trigger.orbitEvery);
    if (left <= 0) for (const ball of orbitBalls(slot, def, world.player)) reactAt(world, ball.x, ball.y, slot.stats.attackType, slot.stats.damage);
  }

  for (const [enemyId, left] of slot.hitCooldowns) {
    if (left - dt <= 0) slot.hitCooldowns.delete(enemyId);
    else slot.hitCooldowns.set(enemyId, left - dt);
  }

  const { enemies } = world;
  const hit = makeHitInfo(slot.stats, slot);
  const center = orbitCenter(slot, world.player);
  for (const ball of orbitBalls(slot, def, world.player)) {
    queryEnemies(world, ball.x, ball.y, ball.r, neighbours);
    for (const j of neighbours) {
      const enemy = enemies[j]!;
      if (enemy.hp <= 0 || slot.hitCooldowns.has(enemy.id)) continue;
      const dx = enemy.x - ball.x;
      const dy = enemy.y - ball.y;
      const reach = enemy.radius + ball.r;
      if (dx * dx + dy * dy > reach * reach) continue;
      // Stagger pushes away from the orbit's centre.
      const ox = enemy.x - center.x;
      const oy = enemy.y - center.y;
      const od = Math.hypot(ox, oy) || 1;
      hit.dirX = ox / od;
      hit.dirY = oy / od;
      damageEnemy(world, enemy, slot.stats.damage, hit);
      // A faster spin (Frenzy Dance) hits each enemy more often.
      slot.hitCooldowns.set(enemy.id, def.hitInterval / slot.stats.spinMult);
    }
  }
}
