import { ENEMIES, TUNING } from '../data/content';
import { CRIT_MULTIPLIER } from '../data/upgrades';
import type { Enemy, Gem, World } from './types';

export const MAX_ENEMY_RADIUS = Math.max(...Object.values(ENEMIES).map((e) => e.radius));
/** Enemies move after the hash is built, so queries look a little wider than needed. */
const HASH_MARGIN = 8;

/** Candidate enemy indices whose bodies may touch a circle at (x, y) of `radius`. */
export function queryEnemies(world: World, x: number, y: number, radius: number, out: number[]): number[] {
  return world.hash.query(x, y, radius + MAX_ENEMY_RADIUS + HASH_MARGIN, out);
}

/** Nearest living enemy within `range` of the player, or undefined. */
export function findNearestEnemy(world: World, range: number): Enemy | undefined {
  const { x, y } = world.player;
  let best: Enemy | undefined;
  let bestDist2 = range * range;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= bestDist2) {
      best = enemy;
      bestDist2 = dist2;
    }
  }
  return best;
}

/** Applies a hit, rolling for a crit. A killing hit counts the KO and drops the gem. */
export function damageEnemy(world: World, enemy: Enemy, damage: number, critChance = 0): void {
  if (enemy.hp <= 0) return;
  // Only consume RNG when a crit is possible, so crit-free runs stay reproducible.
  const crit = critChance > 0 && world.rng.next() < critChance;
  enemy.hp -= crit ? damage * CRIT_MULTIPLIER : damage;
  enemy.hitFlashLeft = TUNING.enemy.hitFlashSeconds;
  if (enemy.hp <= 0) {
    world.kills++;
    dropGem(world, enemy.x, enemy.y, ENEMIES[enemy.kind].xp);
  }
}

export function dropGem(world: World, x: number, y: number, value: number): void {
  if (world.gems.length >= TUNING.xp.maxGems) {
    // Budget reached: fold the XP into the oldest gem instead of adding an entity.
    world.gems[0]!.value += value;
    return;
  }
  const gem: Gem = { id: world.nextId++, x, y, value, magnetized: false, collected: false };
  world.gems.push(gem);
}
