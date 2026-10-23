// Techniques (D40): runtime effects of the ranked passives from normal levels. No Phaser.
import { MOVES } from '../data/moves';
import {
  MAX_TECHNIQUE_RANK,
  MAX_TECHNIQUE_SLOTS,
  TECHNIQUE_IDS,
  TECHNIQUE_TUNING as T,
  TECHNIQUES,
  type TechniqueId,
} from '../data/techniques';
import { applyBurn, applySlow, applyStatuses, damageEnemy, procHit, queryEnemies } from './combat';
import { healPlayer, targetParalysed } from './hooks';
import type { Card, Enemy, MoveSlot, TechniqueState, World } from './types';

export function emptyTechniqueState(): TechniqueState {
  return { rollout: 0, moxie: 0, endureLeft: 0, rageLeft: 0, focusLeft: 0, brawlerBudget: 0, procDepth: 0 };
}

/** The owned Technique's value at its rank; 0 when not owned. */
export function techValue(world: World, id: TechniqueId): number {
  for (const t of world.techniques) if (t.id === id) return TECHNIQUES[id].values[t.rank - 1]!;
  return 0;
}

function moveHasAny(slot: MoveSlot, tags: readonly string[]): boolean {
  return MOVES[slot.moveId].tags.some((tag) => tags.includes(tag));
}

/** Technique cards for a normal level: rank-ups, plus new ones while a slot is free (tag-linked ones need a move). */
export function techniqueCards(world: World): Card[] {
  const cards: Card[] = [];
  for (const t of world.techniques) {
    if (t.rank < MAX_TECHNIQUE_RANK) cards.push({ kind: 'technique', techniqueId: t.id, rank: t.rank + 1 });
  }
  if (world.techniques.length >= MAX_TECHNIQUE_SLOTS) return cards;
  for (const id of TECHNIQUE_IDS) {
    if (world.techniques.some((t) => t.id === id)) continue;
    const { requiresAny } = TECHNIQUES[id];
    if (requiresAny.length > 0 && !world.moves.some((slot) => moveHasAny(slot, requiresAny))) continue;
    cards.push({ kind: 'technique', techniqueId: id, rank: 1 });
  }
  return cards;
}

export function learnTechnique(world: World, id: TechniqueId): void {
  const owned = world.techniques.find((t) => t.id === id);
  if (owned) owned.rank = Math.min(MAX_TECHNIQUE_RANK, owned.rank + 1);
  else world.techniques.push({ id, rank: 1 });
}

/** Timers: Rollout, Endure, Rage, Focus Energy, Brawler's heal budget. */
export function updateTechniques(world: World, dt: number): void {
  if (world.techniques.length === 0) return;
  const t = world.tech;
  // shortcut: only a cast that uses the bonus resets Rollout (auto-fire casts too often for "any cast").
  t.rollout = world.player.movingFor > 0 ? t.rollout + dt : 0;
  if (t.endureLeft > 0) t.endureLeft = Math.max(0, t.endureLeft - dt);
  if (t.rageLeft > 0) t.rageLeft = Math.max(0, t.rageLeft - dt);
  const focus = techValue(world, 'focusEnergy');
  if (focus > 0) {
    t.focusLeft -= dt;
    if (t.focusLeft <= 0) {
      t.focusLeft = focus;
      for (const slot of world.moves) slot.focusReady = true;
    }
  }
  const brawler = techValue(world, 'brawler');
  if (brawler > 0) t.brawlerBudget = Math.min(brawler, t.brawlerBudget + brawler * dt);
}

/** Rollout's damage factor for the cast happening now. */
export function rolloutMult(world: World): number {
  const v = techValue(world, 'rollout');
  return v > 0 && world.tech.rollout >= T.rollout.movingSeconds ? 1 + v : 1;
}

/** Cooldowns tick this much faster (Rage). */
export function cooldownRate(world: World): number {
  return world.tech.rageLeft > 0 ? 1 / (1 - techValue(world, 'rage')) : 1;
}

/** Endure: a lethal hit leaves 1 HP instead, once per cooldown. True if it saved the player. */
export function endureSaves(world: World): boolean {
  const v = techValue(world, 'endure');
  if (v <= 0 || world.tech.endureLeft > 0) return false;
  world.player.hp = 1;
  world.player.invulnLeft = T.endure.invulnSeconds;
  world.tech.endureLeft = v;
  return true;
}

/** A hit landed on the player: Moxie resets, Rage starts. */
export function onPlayerHit(world: World): void {
  if (world.techniques.length === 0) return;
  world.tech.moxie = 0;
  if (techValue(world, 'rage') > 0) world.tech.rageLeft = T.rage.seconds;
}

/** Pickup: a collected gem may heal. RNG is used only when Pickup is owned. */
export function onGemCollected(world: World): void {
  const v = techValue(world, 'pickup');
  if (v > 0 && world.rng.next() < v) healPlayer(world, T.pickup.heal);
}

/** Moxie, Static Field and Sharpshooter on one hit. `slot` is null for procs and status ticks. */
export function techniqueDamageMult(world: World, enemy: Enemy, slot: MoveSlot | null): number {
  if (world.techniques.length === 0) return 1;
  let mult = 1 + world.tech.moxie;
  const field = techValue(world, 'staticField');
  if (field > 0 && targetParalysed(enemy)) mult *= 1 + field;
  const sharp = techValue(world, 'sharpshooter');
  if (sharp > 0 && slot && MOVES[slot.moveId].tags.includes('Projectile')) {
    const dx = enemy.x - world.player.x;
    const dy = enemy.y - world.player.y;
    if (dx * dx + dy * dy > T.sharpshooter.range * T.sharpshooter.range) mult *= 1 + sharp;
  }
  return mult;
}

/** A move's own hit landed (never procs): Riptide slows, Brawler heals. */
export function onTechniqueHit(world: World, slot: MoveSlot, enemy: Enemy): void {
  if (world.techniques.length === 0) return;
  const riptide = techValue(world, 'riptide');
  if (riptide > 0 && enemy.hp > 0 && MOVES[slot.moveId].tags.includes('Water')) applySlow(enemy, riptide, T.riptide.seconds);
  if (techValue(world, 'brawler') > 0 && moveHasAny(slot, ['Melee', 'Contact'])) {
    const heal = Math.min(T.brawler.healPerHit, world.tech.brawlerBudget);
    if (heal > 0) {
      world.tech.brawlerBudget -= heal;
      healPlayer(world, heal);
    }
  }
}

const near: number[] = [];
const picked: Enemy[] = [];

/** Living enemies (not `dead`) within `radius` of it, nearest first, at most `max`. Reuses `picked`. */
function neighbours(world: World, dead: Enemy, radius: number, max: number): Enemy[] {
  picked.length = 0;
  near.length = 0;
  for (const i of queryEnemies(world, dead.x, dead.y, radius, near)) {
    const e = world.enemies[i];
    if (!e || e === dead || e.hp <= 0) continue;
    const dx = e.x - dead.x;
    const dy = e.y - dead.y;
    if (dx * dx + dy * dy <= radius * radius) picked.push(e);
  }
  if (picked.length > max) {
    const d2 = (e: Enemy) => (e.x - dead.x) ** 2 + (e.y - dead.y) ** 2;
    picked.sort((a, b) => d2(a) - d2(b));
    picked.length = max;
  }
  return picked;
}

/**
 * An enemy died: Moxie stacks; Kindling, Spore Cloud and Frostbite fire from it. Nothing a Technique
 * creates triggers a Technique (D29): kills inside `procDepth` and deaths of marked enemies are skipped.
 * shortcut: a marked enemy stays marked even if your own burn/poison lands on it later; clear on re-apply if that reads wrong.
 */
export function onTechniqueKill(world: World, enemy: Enemy, dealt: number): void {
  if (world.techniques.length === 0 || world.tech.procDepth > 0 || enemy.techMarked) return;
  const moxie = techValue(world, 'moxie');
  if (moxie > 0) world.tech.moxie = Math.min(moxie, world.tech.moxie + T.moxie.perKill);
  const kindling = techValue(world, 'kindling');
  if (kindling > 0 && enemy.burnLeft > 0) {
    for (const e of neighbours(world, enemy, T.kindling.radius, kindling)) {
      applyBurn(e, enemy.burnDps);
      e.techMarked = true;
    }
  }
  const spore = techValue(world, 'sporeCloud');
  if (spore > 0 && enemy.poisonLeft > 0) {
    for (const e of neighbours(world, enemy, spore, Infinity)) {
      applyStatuses(e, { slow: 0, stun: 0, poisonDps: enemy.poisonDps });
      e.techMarked = true;
    }
  }
  const frost = techValue(world, 'frostbite');
  if (frost > 0 && enemy.slowLeft > 0 && dealt > 0) {
    // Splash kills run inside procDepth, so they return before touching `picked` again.
    world.tech.procDepth++;
    for (const e of neighbours(world, enemy, T.frostbite.radius, Infinity)) damageEnemy(world, e, dealt * frost, procHit(null));
    world.tech.procDepth--;
  }
}
