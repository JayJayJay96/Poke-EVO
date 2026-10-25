import { ABILITIES, type RageDef } from '../data/content';
import { MOVES } from '../data/moves';
import { emit, healPlayer, hooksOf } from './hooks';
import { applyPlayerStatus } from './playerStatus';
import type { MoveSlot, World } from './types';

// Anger Point (Mankey line, D56, docs/moveset/mankey): the Rage meter, Rampage, and Close Combat's guard drop.
// Numbers live in ABILITIES / MOVES (src/data).

function rage(world: World): RageDef | undefined {
  return ABILITIES[world.player.ability].rage;
}

export function addRage(world: World, amount: number): void {
  const def = rage(world);
  if (!def || amount <= 0) return;
  const p = world.player;
  p.rage = Math.min(def.max, p.rage + amount);
  p.rageIdle = 0;
}

/** A hit landed on the player (after Shell and Mist). */
export function onRageHitTaken(world: World): void {
  const def = rage(world);
  if (def) addRage(world, def.perHitTaken * (def.rampage?.hitRageMult ?? 1));
}

/** A move's own hit landed on an enemy: Contact moves feed Rage, capped per cast. */
export function onRageHitDealt(world: World, slot: MoveSlot): void {
  const def = rage(world);
  if (!def) return;
  world.player.rageIdle = 0;
  if (!MOVES[slot.moveId].tags.includes('Contact') || slot.rageGain >= def.maxContactPerCast) return;
  slot.rageGain++;
  addRage(world, def.perContactHit);
}

/** Rage as a fraction 0..1 (0 without Anger Point); the `rageLevel` hook. */
export function rageLevel(world: World): number {
  const def = rage(world);
  return def ? world.player.rage / def.max : 0;
}

/** Cooldowns run faster with Rage: up to `maxCooldownCut` at full. */
export function rageCooldownRate(world: World): number {
  const def = rage(world);
  return def ? 1 / (1 - def.maxCooldownCut * rageLevel(world)) : 1;
}

export function rampageDamageMult(world: World): number {
  const r = rage(world)?.rampage;
  return r && world.player.rampageLeft > 0 ? 1 + r.damagePct : 1;
}

export function rampageSpeedMult(world: World): number {
  const r = rage(world)?.rampage;
  return r && world.player.rampageLeft > 0 ? 1 + r.moveSpeedPct : 1;
}

/** Rage Fist: +`ragePowerPerPoint` damage per point of Rage. */
export function ragePowerMult(world: World, slot: MoveSlot): number {
  const per = MOVES[slot.moveId].ragePowerPerPoint;
  return per ? 1 + per * world.player.rage : 1;
}

/** Close Combat's guard drop after a cast. */
export function applySelfVuln(world: World, slot: MoveSlot): void {
  const def = MOVES[slot.moveId];
  if (def.form !== 'melee' || !def.selfVuln) return;
  world.player.vulnLeft = def.selfVuln.seconds;
  world.player.vulnPct = def.selfVuln.pct;
}

export function playerVulnMult(world: World): number {
  return world.player.vulnLeft > 0 ? 1 + world.player.vulnPct : 1;
}

/** Per step: Rage drain, Rampage start and end, the guard-drop timer. */
export function updateRage(world: World, dt: number): void {
  const p = world.player;
  p.vulnLeft = Math.max(0, p.vulnLeft - dt);
  const def = rage(world);
  if (!def) return;
  p.rageIdle += dt;
  if (p.rampageLeft > 0) {
    p.rampageLeft -= dt;
    if (p.rampageLeft <= 0) {
      p.rampageLeft = 0;
      p.rage = 0;
      applyPlayerStatus(world, 'confusion', { seconds: def.rampage!.confuseSeconds });
      emit(world, 'rampageEnd', 1);
    }
    return;
  }
  if (p.rageIdle > def.drainAfter) {
    let drain = 1;
    for (const slot of world.moves) drain *= hooksOf(slot)?.rageDrainMult?.(world, slot) ?? 1;
    p.rage = Math.max(0, p.rage - def.drainPerSec * drain * dt);
  }
  if (def.rampage && p.rage >= def.max) {
    p.rampageLeft = def.rampage.seconds;
    if (def.rampage.healMaxHpFraction) healPlayer(world, p.maxHp * def.rampage.healMaxHpFraction);
    emit(world, 'rampage', 1);
  }
}
