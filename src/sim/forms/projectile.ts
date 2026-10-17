import { TUNING } from '../../data/content';
import type { ProjectileMoveDef } from '../../data/moves';
import { damageEnemy, findNearestEnemy, queryEnemies } from '../combat';
import type { Enemy, MoveSlot, Projectile, World } from '../types';
import { spawnZone } from '../zones';

/** How long an explosion stays visible. Presentation only. */
export const BLAST_SECONDS = 0.18;

/** Angle between neighbouring projectiles when a cast fires several. */
const SPREAD_RADIANS = 0.21;

const neighbours: number[] = [];
const blastNeighbours: number[] = [];

export function castProjectile(world: World, slot: MoveSlot, def: ProjectileMoveDef): boolean {
  const target = findNearestEnemy(world, def.range);
  if (!target) return false; // stays ready and fires the moment something is in range
  const { player } = world;
  const wanted = def.count + slot.stats.extraCount;
  // Budget: never exceed the projectile cap. A clipped cast fires fewer, heavier
  // projectiles so its total damage is unchanged; a full budget spends the cast.
  const room = TUNING.budget.maxProjectiles - world.projectiles.length;
  if (room <= 0) return true;
  const count = Math.min(wanted, room);
  const damage = slot.stats.damage * (wanted / count);
  const speed = def.projectileSpeed * slot.stats.speedMult;
  const s = slot.stats;
  const { explosion, crater } = def;
  const base = Math.atan2(target.y - player.y, target.x - player.x);
  for (let i = 0; i < count; i++) {
    const angle = base + (i - (count - 1) / 2) * SPREAD_RADIANS;
    const p = acquireProjectile(world);
    p.id = world.nextId++;
    p.moveId = def.id;
    p.x = player.x;
    p.y = player.y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.radius = def.projectileRadius * slot.stats.area;
    p.damage = damage;
    p.critChance = s.critChance;
    p.missingHpBonus = s.missingHpBonus;
    p.explodeRadius = explosion ? explosion.radius * s.area * s.blastRadiusMult : 0;
    p.explodeFraction = explosion?.damageFraction ?? 0;
    p.craterRadius = crater ? crater.radius * s.area * s.blastRadiusMult : 0;
    p.craterDuration = crater ? crater.duration * s.duration * s.zoneDurationMult : 0;
    p.craterTick = crater?.tickInterval ?? 0;
    p.craterDamage = crater ? damage * crater.damageFraction * s.zoneDamageMult : 0;
    p.lifeLeft = def.projectileLifetime * s.duration;
    p.dead = false;
    world.projectiles.push(p);
  }
  return true;
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
      damageEnemy(world, enemy, proj.damage * proj.explodeFraction, proj.critChance, proj.missingHpBonus);
    }
    world.blasts.push({ x: proj.x, y: proj.y, radius: proj.explodeRadius, lifeLeft: BLAST_SECONDS });
  }
  if (proj.craterRadius > 0) {
    spawnZone(world, proj.x, proj.y, proj.craterRadius, proj.craterDuration, proj.craterTick, proj.craterDamage, proj.critChance);
  }
}

/** Reuses a dead projectile when one is available. */
function acquireProjectile(world: World): Projectile {
  return (
    world.projectilePool.pop() ?? {
      id: 0,
      moveId: 'ember',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 0,
      damage: 0,
      critChance: 0,
      missingHpBonus: 0,
      explodeRadius: 0,
      explodeFraction: 0,
      craterRadius: 0,
      craterDuration: 0,
      craterTick: 0,
      craterDamage: 0,
      lifeLeft: 0,
      dead: true,
    }
  );
}

export function updateProjectiles(world: World, dt: number): void {
  const { enemies } = world;
  for (const proj of world.projectiles) {
    if (proj.dead) continue;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.lifeLeft -= dt;
    if (proj.lifeLeft <= 0) {
      proj.dead = true;
      continue;
    }
    queryEnemies(world, proj.x, proj.y, proj.radius, neighbours);
    for (const j of neighbours) {
      const enemy = enemies[j]!;
      if (enemy.hp <= 0) continue;
      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const reach = enemy.radius + proj.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      damageEnemy(world, enemy, proj.damage, proj.critChance, proj.missingHpBonus);
      detonate(world, proj, enemy);
      proj.dead = true; // no pierce yet
      break;
    }
  }
}
