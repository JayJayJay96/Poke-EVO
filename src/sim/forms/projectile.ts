import { TUNING } from '../../data/content';
import type { ProjectileMoveDef } from '../../data/moves';
import { NO_HIT, damageEnemy, findNearestEnemy, queryEnemies } from '../combat';
import { chainBias, emit, hooksOf } from '../hooks';
import type { Enemy, MoveSlot, Projectile, World } from '../types';
import { spawnZone } from '../zones';

/** How long an explosion stays visible. Presentation only. */
export const BLAST_SECONDS = 0.18;
/** How long a chain-lightning arc stays visible. Presentation only. */
export const ARC_SECONDS = 0.15;
/** Angle between neighbouring projectiles when a cast fires several. */
const SPREAD_RADIANS = 0.21;
/** Hits remembered per leg so pierce/return never re-hit the same enemy; oldest forgotten past this. */
const MAX_HIT_MEMORY = 16;

const neighbours: number[] = [];
const blastNeighbours: number[] = [];

/** A blank projectile; every field is reassigned when it is fired. */
export function createProjectile(): Projectile {
  return {
    id: 0,
    moveId: 'ember',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 0,
    damage: 0,
    explodeRadius: 0,
    explodeFraction: 0,
    craterRadius: 0,
    craterDuration: 0,
    craterTick: 0,
    craterDamage: 0,
    craterSlow: 0,
    craterSpawned: false,
    chainJumps: 0,
    chainFraction: 0,
    hit: { ...NO_HIT },
    pierceLeft: 0,
    homing: false,
    homingTarget: null,
    returns: false,
    returning: false,
    turnAt: 0,
    speed: 0,
    hitIds: [],
    tag: 0,
    lifeLeft: 0,
    dead: true,
  };
}

export function castProjectile(world: World, slot: MoveSlot, def: ProjectileMoveDef): boolean {
  const target = findNearestEnemy(world, def.range);
  if (!target) return false; // stays ready and fires the moment something is in range
  const { player } = world;
  const s = slot.stats;
  const wanted = def.count + s.extraCount;
  // Budget: never exceed the projectile cap. A clipped cast fires fewer, heavier
  // projectiles so its total damage is unchanged; a full budget spends the cast.
  const room = TUNING.budget.maxProjectiles - world.projectiles.length;
  if (room <= 0) return true;
  const count = Math.min(wanted, room);
  const damage = s.damage * (wanted / count);
  const speed = def.projectileSpeed * s.speedMult;
  const lifetime = def.projectileLifetime * s.duration;
  const { explosion, crater } = def;
  const base = Math.atan2(target.y - player.y, target.x - player.x);
  for (let i = 0; i < count; i++) {
    const angle = base + (i - (count - 1) / 2) * SPREAD_RADIANS;
    const p = world.projectilePool.pop() ?? createProjectile();
    p.id = world.nextId++;
    p.moveId = def.id;
    p.x = player.x;
    p.y = player.y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.speed = speed;
    p.radius = def.projectileRadius * s.area;
    p.damage = damage;
    p.explodeRadius = explosion ? explosion.radius * s.area * s.blastRadiusMult : 0;
    p.explodeFraction = explosion?.damageFraction ?? 0;
    p.craterRadius = crater ? crater.radius * s.area * s.blastRadiusMult : 0;
    p.craterDuration = crater ? crater.duration * s.duration * s.zoneDurationMult : 0;
    p.craterTick = crater?.tickInterval ?? 0;
    p.craterDamage = crater ? damage * crater.damageFraction * s.zoneDamageMult : 0;
    p.craterSlow = crater?.slow ?? 0;
    p.craterSpawned = false;
    p.chainJumps = def.chain?.jumps ?? 0;
    p.chainFraction = def.chain?.damageFraction ?? 0;
    p.hit.slow = s.slow;
    p.hit.stun = s.stun;
    p.hit.stunKind = s.stunKind;
    p.hit.poisonDps = damage * s.poisonPct;
    p.hit.attackType = s.attackType;
    p.hit.seedDps = damage * s.seedPct;
    p.hit.critChance = s.critChance;
    p.hit.missingHpBonus = s.missingHpBonus;
    p.hit.lifesteal = s.lifesteal;
    p.hit.burnDps = damage * s.burnPct;
    p.hit.knockback = s.knockback;
    p.hit.slot = slot;
    p.hit.fromProc = false;
    p.pierceLeft = s.pierce + (def.pierce ?? 0);
    p.homing = s.homing;
    p.homingTarget = null;
    p.returns = s.returns;
    p.returning = false;
    // Return: fly out for half the lifetime, then come back.
    p.turnAt = s.returns ? lifetime / 2 : 0;
    p.hitIds.length = 0;
    p.tag = 0;
    p.lifeLeft = lifetime;
    p.dead = false;
    world.projectiles.push(p);
  }
  return true;
}

export function updateProjectiles(world: World, dt: number): void {
  const { enemies, player } = world;
  const maxTurn = TUNING.homing.turnRate * dt;
  for (const proj of world.projectiles) {
    if (proj.dead) continue;

    if (proj.returning) {
      steer(proj, player.x, player.y, Math.PI); // straight back
    } else if (proj.homing) {
      const target = homingTarget(world, proj);
      if (target) steer(proj, target.x, target.y, maxTurn);
    }

    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.lifeLeft -= dt;

    if (proj.returning) {
      const dx = player.x - proj.x;
      const dy = player.y - proj.y;
      const reach = player.radius + proj.radius;
      if (dx * dx + dy * dy <= reach * reach) {
        proj.dead = true;
        continue;
      }
    } else if (proj.returns && proj.lifeLeft <= proj.turnAt) {
      proj.returning = true;
      proj.hitIds.length = 0; // the way back may hit the same enemies again
      proj.lifeLeft = proj.turnAt * 2 + 1; // safety cap for the trip home
    }
    if (proj.lifeLeft <= 0) {
      proj.dead = true;
      const owner = proj.hit.slot;
      if (owner && !proj.returning) hooksOf(owner)?.onProjectileExpire?.(world, owner, proj);
      continue;
    }

    queryEnemies(world, proj.x, proj.y, proj.radius, neighbours);
    for (const j of neighbours) {
      const enemy = enemies[j]!;
      if (enemy.hp <= 0 || proj.hitIds.includes(enemy.id)) continue;
      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const reach = enemy.radius + proj.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      proj.hit.dirX = proj.vx / proj.speed;
      proj.hit.dirY = proj.vy / proj.speed;
      damageEnemy(world, enemy, proj.damage, proj.hit);
      detonate(world, proj, enemy);
      remember(proj, enemy.id);
      chain(world, proj, enemy);
      const owner = proj.hit.slot;
      if (owner) hooksOf(owner)?.onProjectileHit?.(world, owner, proj, enemy);
      if (proj.returns) continue; // a boomerang passes through everything, both ways
      if (proj.pierceLeft > 0) {
        proj.pierceLeft--;
        continue;
      }
      proj.dead = true;
      break;
    }
  }
}

/** Keeps or finds the nearest living enemy around the projectile. */
function homingTarget(world: World, proj: Projectile): Enemy | null {
  const current = proj.homingTarget;
  if (current && current.hp > 0 && !proj.hitIds.includes(current.id)) return current;
  const found = findNearestEnemy(world, TUNING.homing.range, proj.x, proj.y);
  proj.homingTarget = found && !proj.hitIds.includes(found.id) ? found : null;
  return proj.homingTarget;
}

/** Turns the velocity toward (tx, ty) by at most maxTurn radians, keeping speed. */
function steer(proj: Projectile, tx: number, ty: number, maxTurn: number): void {
  const current = Math.atan2(proj.vy, proj.vx);
  const desired = Math.atan2(ty - proj.y, tx - proj.x);
  let diff = desired - current;
  if (diff > Math.PI) diff -= Math.PI * 2;
  else if (diff < -Math.PI) diff += Math.PI * 2;
  const angle = current + Math.max(-maxTurn, Math.min(maxTurn, diff));
  proj.vx = Math.cos(angle) * proj.speed;
  proj.vy = Math.sin(angle) * proj.speed;
}

/**
 * Innate chain (Pikachu, D13): jumps from the enemy just hit to the nearest enemy not yet
 * hit by this projectile, up to its jump count (≤ 3). Part of the move's hit, not a proc,
 * so it never chains again and never spawns craters.
 */
function chain(world: World, proj: Projectile, from: Enemy): void {
  let current = from;
  const slot = proj.hit.slot;
  const hooks = slot ? hooksOf(slot) : undefined;
  for (let jump = 0; jump < proj.chainJumps; jump++) {
    // Nearest unhit enemy in range; Mutations (Conductor) can mark preferred targets with a longer reach.
    let next: Enemy | undefined;
    let nextPreferred = false;
    let nextDamageMult = 1;
    let bestDist2 = Infinity;
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0 || enemy === current || proj.hitIds.includes(enemy.id)) continue;
      const dx = enemy.x - current.x;
      const dy = enemy.y - current.y;
      const dist2 = dx * dx + dy * dy;
      const bias = chainBias(world, current, enemy);
      const range = TUNING.chain.range * bias.rangeMult;
      if (dist2 > range * range) continue;
      const preferred = bias.preferred;
      if ((preferred && !nextPreferred) || (preferred === nextPreferred && dist2 < bestDist2)) {
        next = enemy;
        nextPreferred = preferred;
        nextDamageMult = bias.damageMult;
        bestDist2 = dist2;
      }
    }
    if (!next) break;
    world.arcs.push({ x1: current.x, y1: current.y, x2: next.x, y2: next.y, lifeLeft: ARC_SECONDS });
    damageEnemy(world, next, proj.damage * proj.chainFraction * nextDamageMult, proj.hit);
    emit(world, 'chainJump', 1);
    if (hooks?.onChainJump) hooks.onChainJump(world, slot!, current, next);
    remember(proj, next.id);
    current = next;
  }
  if (proj.chainJumps > 0 && hooks?.onChainEnd) hooks.onChainEnd(world, slot!, current);
}

function remember(proj: Projectile, enemyId: number): void {
  if (proj.hitIds.length >= MAX_HIT_MEMORY) proj.hitIds.shift();
  proj.hitIds.push(enemyId);
}

/** Splash everyone else in the radius and leave the crater, if the projectile carries them. */
function detonate(world: World, proj: Projectile, primary: Enemy): void {
  if (proj.explodeRadius > 0) {
    const { enemies } = world;
    queryEnemies(world, proj.x, proj.y, proj.explodeRadius, blastNeighbours);
    for (const j of blastNeighbours) {
      const enemy = enemies[j]!;
      if (enemy === primary || enemy.hp <= 0) continue;
      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const reach = proj.explodeRadius + enemy.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      damageEnemy(world, enemy, proj.damage * proj.explodeFraction, proj.hit);
    }
    world.blasts.push({ x: proj.x, y: proj.y, radius: proj.explodeRadius, lifeLeft: BLAST_SECONDS, type: null });
  }
  // One crater per projectile, on its first hit, so Pierce can't chain craters (D11).
  if (proj.craterRadius > 0 && !proj.craterSpawned) {
    proj.craterSpawned = true;
    spawnZone(
      world,
      proj.x,
      proj.y,
      proj.craterRadius,
      proj.craterDuration,
      proj.craterTick,
      proj.craterDamage,
      proj.hit.critChance,
      { ...NO_HIT, slow: proj.craterSlow, attackType: proj.hit.attackType },
    );
  }
}
