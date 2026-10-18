import { ABILITIES, ENEMIES, TUNING } from '../data/content';
import { MUTATION_TUNING } from '../data/mutations';
import { effectiveness } from '../data/typeChart';
import { CRIT_MULTIPLIER } from '../data/upgrades';
import { emit, healPlayer, hooksOf } from './hooks';
import type { Enemy, Gem, HitInfo, MoveSlot, MoveStats, World } from './types';

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
  slow: 0,
  stun: 0,
  poisonDps: 0,
  seedDps: 0,
  attackType: null,
  slot: null,
  fromProc: false,
};

/** A hit spawned by a Mutation or ability effect: plain damage plus the caller's own statuses, nothing else. */
export function procHit(attackType: HitInfo['attackType']): HitInfo {
  return { ...NO_HIT, attackType, fromProc: true };
}

/** On-hit effects for a move with these stats. Callers set dirX/dirY per hit for knockback. */
export function makeHitInfo(stats: MoveStats, slot: MoveSlot | null = null): HitInfo {
  return {
    critChance: stats.critChance,
    missingHpBonus: stats.missingHpBonus,
    lifesteal: stats.lifesteal,
    burnDps: stats.damage * stats.burnPct,
    knockback: stats.knockback,
    dirX: 0,
    dirY: 0,
    slow: stats.slow,
    stun: stats.stun,
    poisonDps: stats.damage * stats.poisonPct,
    attackType: stats.attackType,
    seedDps: stats.damage * stats.seedPct,
    slot,
    fromProc: false,
  };
}

/** Knockback resistance from real weight (D14): weight ÷ (weight + K). */
export function knockbackResistance(weightKg: number): number {
  return weightKg / (weightKg + TUNING.knockbackWeightK);
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
  const def = ENEMIES[enemy.kind];
  // Type chart (D14): multiplied for dual-type enemies; typeless hits stay ×1.
  const typeMult = effectiveness(hit.attackType, def.types);
  enemy.lastEffectiveness = typeMult;
  // Mutation hooks see only the move's own hits, never proc hits (no proc-from-proc).
  const slot = hit.fromProc ? null : hit.slot;
  const hooks = slot ? hooksOf(slot) : undefined;
  const mutationMult = hooks?.damageMult ? hooks.damageMult(world, slot!, enemy) : 1;
  const amount =
    (crit ? damage * CRIT_MULTIPLIER : damage) * abilityDamageMult(world) * (1 + missing) * typeMult * mutationMult;
  const dealt = Math.min(enemy.hp, amount);
  enemy.hp -= amount;
  enemy.hitFlashLeft = TUNING.enemy.hitFlashSeconds;

  if (hit.lifesteal > 0) healPlayer(world, dealt * hit.lifesteal);
  hooks?.onHit?.(world, slot!, enemy, dealt, hit);

  if (enemy.hp <= 0) {
    world.kills++;
    dropGem(world, enemy.x, enemy.y, def.xp);
    maybeDropBerry(world, enemy.x, enemy.y, def.berryChance);
    if (!hit.fromProc) {
      hooks?.onKill?.(world, slot!, enemy);
      emit(world, 'kill', 1);
    }
    return dealt;
  }
  if (hit.burnDps > 0) applyBurn(enemy, hit.burnDps);
  applyStatuses(enemy, hit);
  if (hit.seedDps > 0) {
    // Leech Seed: refreshes; a stronger seed replaces a weaker one.
    const seeded = enemy.seedLeft > 0;
    enemy.seedDps = seeded ? Math.max(enemy.seedDps, hit.seedDps) : hit.seedDps;
    if (!seeded) enemy.seedTickLeft = TUNING.status.burnTick;
    enemy.seedLeft = TUNING.status.seedSeconds;
  }
  if (hit.knockback > 0) pushEnemy(enemy, hit.dirX, hit.dirY, hit.knockback);
  return dealt;
}

/**
 * Pushes an enemy about `px` along (dirX, dirY); a negative `px` pulls. Exponential decay makes the
 * total push about the distance; heavy enemies resist, Soaked enemies stagger further, bosses half as far.
 */
export function pushEnemy(enemy: Enemy, dirX: number, dirY: number, px: number): void {
  const def = ENEMIES[enemy.kind];
  const soaked = enemy.soakLeft > 0 ? MUTATION_TUNING.soaked.staggerTakenMult : 1;
  const boss = def.boss ? MUTATION_TUNING.bossStaggerMult : 1;
  const v = px * TUNING.status.knockbackDecay * (1 - knockbackResistance(def.weightKg)) * soaked * boss;
  enemy.kbX += dirX * v;
  enemy.kbY += dirY * v;
}

/** Starts or refreshes a burn; a stronger burn replaces a weaker one. */
export function applyBurn(enemy: Enemy, dps: number): void {
  const burning = enemy.burnLeft > 0;
  enemy.burnDps = burning ? Math.max(enemy.burnDps, dps) : dps;
  if (!burning) enemy.burnTickLeft = TUNING.status.burnTick;
  enemy.burnLeft = TUNING.status.burnSeconds;
}

/**
 * A stun from a new effect (Mutations, evolved abilities): bosses are immune, and stun fatigue
 * (D21) blocks it for a while after the last one ended. Base moves keep using applyStatuses.
 * Returns whether it stunned.
 */
export function applyNewStun(enemy: Enemy, seconds: number): boolean {
  if (seconds <= 0 || enemy.stunFatigueLeft > 0 || ENEMIES[enemy.kind].boss) return false;
  enemy.stunLeft = Math.max(enemy.stunLeft, seconds);
  enemy.fatigueOnEnd = true;
  return true;
}

/** Traps, slips and drags only work on light, non-boss enemies. */
export function canTrap(enemy: Enemy): boolean {
  const def = ENEMIES[enemy.kind];
  return !def.boss && def.weightKg < MUTATION_TUNING.trapMaxWeightKg;
}

/** A slow with its own duration (ability bursts); a stronger slow wins. */
export function applySlow(enemy: Enemy, slow: number, seconds: number): void {
  enemy.slow = enemy.slowLeft > 0 ? Math.max(enemy.slow, slow) : slow;
  enemy.slowLeft = Math.max(enemy.slowLeft, seconds);
}

/** Leech Seed from a Mutation (Sap Lash): a stronger seed replaces a weaker one; the time refreshes. */
export function applySeed(enemy: Enemy, dps: number, seconds: number): void {
  const seeded = enemy.seedLeft > 0;
  enemy.seedDps = seeded ? Math.max(enemy.seedDps, dps) : dps;
  if (!seeded) enemy.seedTickLeft = TUNING.status.burnTick;
  enemy.seedLeft = Math.max(enemy.seedLeft, seconds);
}

/** Soaked (shared Water terrain): refreshes. */
export function soak(enemy: Enemy, seconds: number = MUTATION_TUNING.soaked.seconds): void {
  enemy.soakLeft = Math.max(enemy.soakLeft, seconds);
}

/** Movement factor from slows and Soaked; the total slowdown is capped (guard rail). */
export function enemySpeedFactor(enemy: Enemy): number {
  const slow = enemy.slowLeft > 0 ? enemy.slow : 0;
  const soaked = enemy.soakLeft > 0 ? MUTATION_TUNING.soaked.speedMult : 1;
  return Math.max(1 - MUTATION_TUNING.slowCap, (1 - slow) * soaked);
}

/** Slow, stun and poison from a hit or a zone tick. Stronger effects win; durations refresh. */
export function applyStatuses(enemy: Enemy, effects: Pick<HitInfo, 'slow' | 'stun' | 'poisonDps'>): void {
  if (effects.slow > 0) {
    enemy.slow = enemy.slowLeft > 0 ? Math.max(enemy.slow, effects.slow) : effects.slow;
    enemy.slowLeft = TUNING.status.slowSeconds;
  }
  if (effects.stun > 0) enemy.stunLeft = Math.max(enemy.stunLeft, effects.stun);
  if (effects.poisonDps > 0) {
    const poisoned = enemy.poisonLeft > 0;
    enemy.poisonDps = poisoned ? Math.max(enemy.poisonDps, effects.poisonDps) : effects.poisonDps;
    if (!poisoned) enemy.poisonTickLeft = TUNING.status.burnTick;
    enemy.poisonLeft = TUNING.status.poisonSeconds;
  }
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
    if (enemy.poisonLeft > 0 && enemy.hp > 0) {
      enemy.poisonLeft -= dt;
      enemy.poisonTickLeft -= dt;
      while (enemy.poisonTickLeft <= TICK_EPSILON && enemy.hp > 0) {
        damageEnemy(world, enemy, enemy.poisonDps * tick);
        enemy.poisonTickLeft += tick;
      }
      if (enemy.poisonLeft <= 0) enemy.poisonDps = 0;
    }
    if (enemy.seedLeft > 0 && enemy.hp > 0) {
      enemy.seedLeft -= dt;
      enemy.seedTickLeft -= dt;
      while (enemy.seedTickLeft <= TICK_EPSILON && enemy.hp > 0) {
        // A plain hit (no proc-from-proc); part of the damage dealt heals the player.
        const dealt = damageEnemy(world, enemy, enemy.seedDps * tick);
        healPlayer(world, dealt * TUNING.status.seedHealFraction);
        enemy.seedTickLeft += tick;
      }
      if (enemy.seedLeft <= 0) enemy.seedDps = 0;
    }
    if (enemy.slowLeft > 0) {
      enemy.slowLeft -= dt;
      if (enemy.slowLeft <= 0) enemy.slow = 0;
    }
    if (enemy.soakLeft > 0) enemy.soakLeft = Math.max(0, enemy.soakLeft - dt);
    if (enemy.stunFatigueLeft > 0) enemy.stunFatigueLeft = Math.max(0, enemy.stunFatigueLeft - dt);
    if (enemy.stunLeft > 0) {
      enemy.stunLeft = Math.max(0, enemy.stunLeft - dt);
      if (enemy.stunLeft === 0 && enemy.fatigueOnEnd) {
        enemy.fatigueOnEnd = false;
        enemy.stunFatigueLeft = MUTATION_TUNING.stunFatigueSeconds;
      }
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
