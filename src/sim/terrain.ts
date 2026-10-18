import { TUNING } from '../data/content';
import { MUTATION_TUNING } from '../data/mutations';
import { applyBurn, applyNewStun, canTrap, queryEnemies, soak } from './combat';
import type { Terrain, World } from './types';

// Shared terrain (docs/moveset/README.md): Water puddles that Soak, Fire Scorch that Burns.
// Each kind has its own cap; when full, the oldest patch dries first. Terrain applies its
// effects on the status-tick cadence and never spawns anything (no proc-from-proc).

const neighbours: number[] = [];

function addPatch(list: Terrain[], max: number, patch: Terrain): Terrain {
  if (list.length >= max) list.shift();
  list.push(patch);
  return patch;
}

/** A puddle; `slipChancePerSec` > 0 makes light enemies slip in it (Slick). */
export function spawnPuddle(
  world: World,
  x: number,
  y: number,
  seconds: number = MUTATION_TUNING.puddle.seconds,
  slipChancePerSec = 0,
  slipStun = 0,
): Terrain {
  const { radius, maxAlive } = MUTATION_TUNING.puddle;
  return addPatch(world.puddles, maxAlive, {
    id: world.nextId++,
    x,
    y,
    radius,
    lifeLeft: seconds,
    duration: seconds,
    slipChancePerSec,
    slipStun,
    burnDps: 0,
  });
}

/** A Scorch patch that Burns for `scorch.burnFraction` of the hit that made it, per second. */
export function spawnScorch(world: World, x: number, y: number, hitDamage: number): Terrain {
  const { radius, seconds, maxAlive, burnFraction } = MUTATION_TUNING.scorch;
  return addPatch(world.scorches, maxAlive, {
    id: world.nextId++,
    x,
    y,
    radius,
    lifeLeft: seconds,
    duration: seconds,
    slipChancePerSec: 0,
    slipStun: 0,
    burnDps: hitDamage * burnFraction,
  });
}

export function updateTerrain(world: World, dt: number): void {
  for (const patch of world.puddles) patch.lifeLeft -= dt;
  for (const patch of world.scorches) patch.lifeLeft -= dt;
  world.terrainTickLeft -= dt;
  if (world.terrainTickLeft > 0) return;
  const tick = TUNING.status.burnTick;
  world.terrainTickLeft += tick;
  for (const patch of world.puddles) {
    if (patch.lifeLeft <= 0) continue;
    // Chance per tick for a per-second rate.
    const slipChance = patch.slipChancePerSec > 0 ? 1 - Math.pow(1 - patch.slipChancePerSec, tick) : 0;
    queryEnemies(world, patch.x, patch.y, patch.radius, neighbours);
    for (const j of neighbours) {
      const enemy = world.enemies[j]!;
      if (!inside(patch, enemy)) continue;
      soak(enemy);
      if (slipChance > 0 && canTrap(enemy) && world.rng.next() < slipChance) applyNewStun(enemy, patch.slipStun);
    }
  }
  for (const patch of world.scorches) {
    if (patch.lifeLeft <= 0) continue;
    queryEnemies(world, patch.x, patch.y, patch.radius, neighbours);
    for (const j of neighbours) {
      const enemy = world.enemies[j]!;
      if (inside(patch, enemy)) applyBurn(enemy, patch.burnDps);
    }
  }
}

function inside(patch: Terrain, enemy: { x: number; y: number; radius: number; hp: number }): boolean {
  if (enemy.hp <= 0) return false;
  const dx = enemy.x - patch.x;
  const dy = enemy.y - patch.y;
  const reach = patch.radius + enemy.radius;
  return dx * dx + dy * dy <= reach * reach;
}
