import { POKEMON } from '../../data/content';
import type { MoveId } from '../../data/moves';
import type { MutationId } from '../../data/mutations';
import type { ProjectileMoveDef } from '../../data/moves';
import { queryEnemies } from '../combat';
import { castProjectile } from '../forms/projectile';
import type { Enemy, MoveSlot, MutationEntity, Projectile, World } from '../types';

// Small helpers shared by Mutation behaviours. No tuning numbers here.

const neighbours: number[] = [];

/** The line's signature chain: Ember → Flame Burst → Blast Burn, Ice Shard → Sheer Cold… */
function signatureChain(world: World): MoveId[] {
  const line = POKEMON[world.player.pokemonId];
  const chain = line.stages.map((s) => s.signatureMove);
  for (const tier of line.signatureTiers ?? []) chain.push(tier.move);
  return chain;
}

/** Which tier the signature is at (0 = first form), so signature Mutations add their tier1 / tier2 parts. */
export function signatureTier(world: World, slot: MoveSlot): number {
  return Math.max(0, signatureChain(world).indexOf(slot.moveId));
}

/** Fires the move with temporarily scaled damage / size; returns the projectiles it launched. */
export function fireScaled(
  world: World,
  slot: MoveSlot,
  def: ProjectileMoveDef,
  damageMult: number,
  areaMult: number,
): Projectile[] | null {
  const s = slot.stats;
  const before = world.projectiles.length;
  s.damage *= damageMult;
  s.area *= areaMult;
  const cast = castProjectile(world, slot, def);
  s.damage /= damageMult;
  s.area /= areaMult;
  return cast ? world.projectiles.slice(before) : null;
}

export function spawnEntity(world: World, owner: MutationId, x: number, y: number, lifeLeft: number): MutationEntity {
  const e: MutationEntity = {
    id: world.nextId++,
    owner,
    x,
    y,
    vx: 0,
    vy: 0,
    x2: x,
    y2: y,
    radius: 0,
    lifeLeft,
    timer: 0,
    damage: 0,
    hitIds: [],
  };
  world.entities.push(e);
  return e;
}

/** Living entities of one owner, oldest first. */
export function entitiesOf(world: World, owner: MutationId): MutationEntity[] {
  return world.entities.filter((e) => e.owner === owner && e.lifeLeft > 0);
}

/** Keeps at most `max` of an owner's entities alive by expiring the oldest. */
export function capEntities(world: World, owner: MutationId, max: number): void {
  const mine = entitiesOf(world, owner);
  for (let i = 0; i < mine.length - max; i++) mine[i]!.lifeLeft = 0;
}

/** Calls `fn` for every living enemy whose body touches the circle (x, y, r). */
export function forEachEnemyIn(world: World, x: number, y: number, r: number, fn: (enemy: Enemy) => void): void {
  queryEnemies(world, x, y, r, neighbours);
  for (const j of neighbours) {
    const enemy = world.enemies[j]!;
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const reach = r + enemy.radius;
    if (dx * dx + dy * dy <= reach * reach) fn(enemy);
  }
}

/** Calls `fn` for every living enemy whose body touches the segment, within `width` / 2. */
export function forEachEnemyOnSegment(
  world: World,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  fn: (enemy: Enemy) => void,
): void {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const half = Math.hypot(x2 - x1, y2 - y1) / 2;
  queryEnemies(world, mx, my, half + width, neighbours);
  for (const j of neighbours) {
    const enemy = world.enemies[j]!;
    if (enemy.hp <= 0) continue;
    const reach = width / 2 + enemy.radius;
    if (distToSegment2(enemy.x, enemy.y, x1, y1, x2, y2) <= reach * reach) fn(enemy);
  }
}

export function distToSegment2(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  const cx = x1 + dx * t - px;
  const cy = y1 + dy * t - py;
  return cx * cx + cy * cy;
}

/** Unit vector from (x1, y1) toward (x2, y2); (1, 0) when they coincide. */
export function dirTo(x1: number, y1: number, x2: number, y2: number): [number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  return d > 0 ? [dx / d, dy / d] : [1, 0];
}

/** The `count` nearest living enemies within `range` of (x, y), nearest first. */
export function nearestEnemies(world: World, x: number, y: number, range: number, count: number): Enemy[] {
  const found: { e: Enemy; d2: number }[] = [];
  const r2 = range * range;
  for (const e of world.enemies) {
    if (e.hp <= 0) continue;
    const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d2 <= r2) found.push({ e, d2 });
  }
  found.sort((a, b) => a.d2 - b.d2);
  return found.slice(0, count).map((f) => f.e);
}
