import { ABILITIES } from '../data/content';
import { MUTATION_TUNING, type MutationId } from '../data/mutations';
import type { Enemy, MoveSlot, MoveStats, World } from './types';

// Mutation hook layer (P4f-2). Each Mutation is a small set of named functions (§8.8) registered
// with defineMutation; the sim calls them at fixed points. Hook functions hold no numbers: they
// read their Mutation's `values` from src/data/mutations.ts. Anything they spawn deals proc hits
// (`fromProc`), which never trigger augments, Lifesteal, Mutations or ability counters.

/** Events a Bond can listen to (INDEX.md hook vocabulary, the event-type ones). */
export type HookEvent =
  | 'shellBlock'
  | 'shellBurst'
  | 'hitTaken'
  | 'healing'
  | 'flareUp'
  | 'kill'
  | 'bloom'
  | 'chargeFull'
  | 'staticProc'
  | 'chainJump'
  | 'discharge'
  | 'levelUp'
  | 'armorAbsorb';

export interface MutationHooks {
  /** Permanent stat changes (costs, multipliers), applied whenever stats refresh. */
  stats?(stats: MoveStats, world: World, slot: MoveSlot): void;
  /** Per-step changes from live state (Shell ready, HP level…), applied to a copy of the base stats. */
  live?(stats: MoveStats, world: World, slot: MoveSlot): void;
  /** Replaces the move's normal cast (verb changes). Returns whether it cast. */
  cast?(world: World, slot: MoveSlot): boolean;
  onCast?(world: World, slot: MoveSlot): void;
  /** Every step, after the move updates. */
  update?(world: World, slot: MoveSlot, dt: number): void;
  /** A beam or orbit ran out. */
  onExpire?(world: World, slot: MoveSlot): void;
  /** Live damage factor for one hit from this move on this enemy. */
  damageMult?(world: World, slot: MoveSlot, enemy: Enemy): number;
  onHit?(world: World, slot: MoveSlot, enemy: Enemy, dealt: number): void;
  onKill?(world: World, slot: MoveSlot, enemy: Enemy): void;
  onEvent?(world: World, slot: MoveSlot, event: HookEvent, amount: number): void;
  /** Player move-speed factor while this Mutation is owned. */
  moveSpeedMult?(world: World, slot: MoveSlot): number;
  /** Player damage-taken factor while this Mutation is owned. */
  damageTakenMult?(world: World, slot: MoveSlot): number;
}

const HOOKS = new Map<MutationId, MutationHooks>();

/** Registers a built Mutation's behaviour; only built Mutations can be granted or offered. */
export function defineMutation(id: MutationId, hooks: MutationHooks): void {
  HOOKS.set(id, hooks);
}

/** Marks a Mutation as built without behaviour (tests of the socket plumbing). */
export function registerBuilt(id: MutationId): void {
  if (!HOOKS.has(id)) HOOKS.set(id, {});
}

export function isBuilt(id: MutationId): boolean {
  return HOOKS.has(id);
}

export function hooksOf(slot: MoveSlot): MutationHooks | undefined {
  return slot.mutation ? HOOKS.get(slot.mutation) : undefined;
}

/** Tells every owned Mutation that an event happened. */
export function emit(world: World, event: HookEvent, amount = 0): void {
  for (const slot of world.moves) {
    const onEvent = hooksOf(slot)?.onEvent;
    if (onEvent) onEvent(world, slot, event, amount);
  }
}

/** Product of every owned Mutation's player move-speed factor. */
export function mutationMoveSpeedMult(world: World): number {
  let mult = 1;
  for (const slot of world.moves) {
    const f = hooksOf(slot)?.moveSpeedMult;
    if (f) mult *= f(world, slot);
  }
  return mult;
}

/** Product of every owned Mutation's player damage-taken factor. */
export function mutationDamageTakenMult(world: World): number {
  let mult = 1;
  for (const slot of world.moves) {
    const f = hooksOf(slot)?.damageTakenMult;
    if (f) mult *= f(world, slot);
  }
  return mult;
}

/**
 * The single healing path: caps at max HP, tells the hooks, returns the HP actually restored.
 * Healing past max HP fills the Bulb (Ivysaur+, docs/moveset/bulbasaur).
 */
export function healPlayer(world: World, amount: number): number {
  const p = world.player;
  if (amount <= 0 || p.hp <= 0) return 0;
  const healed = Math.min(amount, p.maxHp - p.hp);
  p.hp += healed;
  if (healed > 0) emit(world, 'healing', healed);
  const overheal = amount - healed;
  const cap = bulbCapacity(world);
  if (overheal > 0 && cap > 0) p.bulb = Math.min(cap, p.bulb + overheal);
  return healed;
}

/** The Bulb's capacity for the current ability (0 = no Bulb). */
export function bulbCapacity(world: World): number {
  const bulb = ABILITIES[world.player.ability].bulb;
  return bulb ? world.player.maxHp * bulb.capacityMaxHpFraction : 0;
}

// ── State hooks (INDEX.md: state / gradient) ───────────────────────────────

/** `shellReady`: the player has Shell and it is up. */
export function shellReady(world: World): boolean {
  return (ABILITIES[world.player.ability].blockEvery ?? 0) > 0 && world.player.blockReadyLeft <= 0;
}

export function hpFraction(world: World): number {
  return world.player.maxHp > 0 ? world.player.hp / world.player.maxHp : 0;
}

/** `hpBelow` with the Bond's own threshold. */
export function hpBelow(world: World, threshold: number): boolean {
  return hpFraction(world) < threshold;
}

/** `missingHp`: 1 − HP fraction. */
export function missingHp(world: World): number {
  return 1 - hpFraction(world);
}

/** `fullHp` */
export function atFullHp(world: World): boolean {
  return world.player.hp >= world.player.maxHp;
}

/** `moving` for at least `seconds`. */
export function movingFor(world: World, seconds: number): boolean {
  return world.player.movingFor >= seconds;
}

/** `standingStill` for at least `seconds`. */
export function standingStill(world: World, seconds: number): boolean {
  return world.player.stillFor >= seconds;
}

/** `levelBelow` with the Bond's own threshold. */
export function levelBelow(world: World, level: number): boolean {
  return world.level < level;
}

/** The Tide (Lapras, D18): Bonds use their Flood values before `tideLevel`, Ebb values from it. */
export function tideFlood(world: World): boolean {
  return world.level < MUTATION_TUNING.tideLevel;
}

/** `targetBurning` */
export function targetBurning(enemy: Enemy): boolean {
  return enemy.burnLeft > 0;
}
