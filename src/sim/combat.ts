import { ABILITIES, ENEMIES, TUNING } from '../data/content';
import { CRIT_MULTIPLIER } from '../data/upgrades';
import type { Enemy, Gem, HitInfo, MoveStats, World } from './types';

export const MAX_ENEMY_RADIUS = Math.max(...Object.values(ENEMIES).map((e) => e.radius));
/** Enemies move after the hash is built, so queries look a little wider than needed. */
const HASH_MARGIN = 8;

/** A plain hit: no crit, no on-hit effects. Used by zone and burn ticks (no proc-from-proc). */
export const NO_HIT: Readonly<HitInfo> = {
  critChance: 0,
  missingHpBonus: 0,
  lifesteal: 0,
  burnDps: 0,
  knockback: 0,
  dirX: 0,
  dirY: 0,
};

/** On-hit effects for a move with these stats. Callers set dirX/dirY per hit for knockback. */
export function makeHitInfo(stats: MoveStats): HitInfo {
  return {
    critChance: stats.critChance,
    missingHpBonus: stats.missingHpBonus,
    lifesteal: stats.lifesteal,
    burnDps: stats.damage * stats.burnPct,
    knockback: stats.knockback,
    dirX: 0,
    dirY: 0,
  };
}

/** Candidate enemy indices whose bodies may touch a circle at (x, y) of `radius`. */
export function queryEnemies(world: World, x: number, y: number, radius: number, out: number[]): number[] {
  return world.hash.query(x, y, radius + MAX_ENEMY_RADIUS + HASH_MARGIN, out);
}

/** Nearest living enemy within `range` of a point (default: the player), or undefined. */
export function findNearestEnemy(
  world: World,
  range: number,
  x = world.player.x,
  y = world.player.y,
): Enemy | undefined {
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

/** True while the player's trait is in its low-HP state (Blaze, Blaze+). */
export function isAbilityActive(world: World): boolean {
  const { lowHpThreshold } = ABILITIES[world.player.ability];
  if (lowHpThreshold === undefined) return false;
  return world.player.hp > 0 && world.player.hp < world.player.maxHp * lowHpThreshold;
}

/** Live damage multiplier from the low-HP trait; applied when a hit lands, so it tracks current HP. */
export function abilityDamageMult(world: World): number {
  if (!isAbilityActive(world)) return 1;
  return 1 + (ABILITIES[world.player.ability].lowHpDamageBonus ?? 0);
}

/**
 * Applies a hit and its on-hit effects (§8.8 onHit): crit roll, live multipliers
 * (ability, Blaze Core's missing-HP bonus), lifesteal, burn, knockback.
 * A killing hit counts the KO and drops the gem. Returns the damage actually dealt.
 */
export function damageEnemy(world: World, enemy: Enemy, damage: number, hit: Readonly<HitInfo> = NO_HIT): number {
  if (enemy.hp <= 0) return 0;
  // Only consume RNG when a crit is possible, so crit-free runs stay reproducible.
  const crit = hit.critChance > 0 && world.rng.next() < hit.critChance;
  const player = world.player;
  const missing = hit.missingHpBonus > 0 ? hit.missingHpBonus * Math.max(0, 1 - player.hp / player.maxHp) : 0;
  const amount = (crit ? damage * CRIT_MULTIPLIER : damage) * abilityDamageMult(world) * (1 + missing);
  const dealt = Math.min(enemy.hp, amount);
  enemy.hp -= amount;
  enemy.hitFlashLeft = TUNING.enemy.hitFlashSeconds;

  if (hit.lifesteal > 0) player.hp = Math.min(player.maxHp, player.hp + dealt * hit.lifesteal);

  if (enemy.hp <= 0) {
    world.kills++;
    const def = ENEMIES[enemy.kind];
    dropGem(world, enemy.x, enemy.y, def.xp);
    maybeDropBerry(world, enemy.x, enemy.y, def.berryChance);
    return dealt;
  }
  if (hit.burnDps > 0) applyBurn(enemy, hit.burnDps);
  if (hit.knockback > 0) {
    // Exponential decay makes the total push ≈ the knockback distance.
    const v = hit.knockback * TUNING.status.knockbackDecay;
    enemy.kbX += hit.dirX * v;
    enemy.kbY += hit.dirY * v;
  }
  return dealt;
}

/** Starts or refreshes a burn; a stronger burn replaces a weaker one. */
export function applyBurn(enemy: Enemy, dps: number): void {
  const burning = enemy.burnLeft > 0;
  enemy.burnDps = burning ? Math.max(enemy.burnDps, dps) : dps;
  if (!burning) enemy.burnTickLeft = TUNING.status.burnTick;
  enemy.burnLeft = TUNING.status.burnSeconds;
}

/** Absorbs float drift so a burn's last tick lands on the same step it expires. */
const TICK_EPSILON = 1e-6;

/** Knockback movement and burn ticks. Burn ticks are plain hits (no proc-from-proc). */
export function updateStatuses(world: World, dt: number): void {
  const decay = Math.exp(-TUNING.status.knockbackDecay * dt);
  const tick = TUNING.status.burnTick;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.kbX !== 0 || enemy.kbY !== 0) {
      enemy.x += enemy.kbX * dt;
      enemy.y += enemy.kbY * dt;
      enemy.kbX *= decay;
      enemy.kbY *= decay;
      if (Math.abs(enemy.kbX) + Math.abs(enemy.kbY) < 1) {
        enemy.kbX = 0;
        enemy.kbY = 0;
      }
    }
    if (enemy.burnLeft > 0) {
      enemy.burnLeft -= dt;
      enemy.burnTickLeft -= dt;
      while (enemy.burnTickLeft <= TICK_EPSILON && enemy.hp > 0) {
        damageEnemy(world, enemy, enemy.burnDps * tick);
        enemy.burnTickLeft += tick;
      }
      if (enemy.burnLeft <= 0) enemy.burnDps = 0;
    }
  }
}

/** Rolls for an Oran Berry drop (D12); skipped when the berry budget is full. */
export function maybeDropBerry(world: World, x: number, y: number, chance: number): void {
  if (chance <= 0 || world.berries.length >= TUNING.heal.maxBerries) return;
  if (world.rng.next() >= chance) return;
  world.berries.push({ id: world.nextId++, x, y, collected: false });
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
