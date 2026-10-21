import {
  MUTATION_IDS,
  MUTATION_RANKS,
  MUTATIONS,
  REQUIREMENTS,
  type MutationDef,
  type MutationId,
  type RequirementId,
} from '../data/mutations';
import { MAX_LEARNSET_SLOTS } from '../data/upgrades';
import { learnsetSlotsUsed } from './combo';
import { isBuilt } from './hooks';
import { createSlot, refreshStats } from './stats';
import type { MoveSlot, World } from './types';

// Mutation acquisition and ranks (docs/moveset/README.md rules 1, 2, 6–8; D16, D23, D24).
// A Mutation sits in its move's own slot, outside the 3 augment sockets, and ranks I → III at sites.
// Sites call mutationOffers / mutationRankUps / grantMutation; the debug grant uses grantMutation too.

export { isBuilt, registerBuilt } from './hooks';

export function isMutationId(id: string): id is MutationId {
  return id in MUTATIONS;
}

/** Augment sockets a move has filled. The Mutation has its own slot (D24). */
export function socketsUsed(slot: MoveSlot): number {
  return slot.sockets.length;
}

/** The move a Mutation sits on in this world, or -1 if it isn't owned. Signature Mutations sit on slot 0. */
export function mutationSlotIndex(world: World, def: MutationDef): number {
  if (def.kind === 'signature') return def.line === world.player.pokemonId ? 0 : -1;
  return world.moves.findIndex((slot, i) => i > 0 && slot.moveId === def.move);
}

export function requirementMet(world: World, req: RequirementId): boolean {
  const { mutations, abilities } = REQUIREMENTS[req];
  return (
    abilities.includes(world.player.ability) ||
    world.moves.some((slot) => slot.mutation !== null && mutations.includes(slot.mutation))
  );
}

/**
 * Every built Mutation a map site could offer right now (INDEX.md offer filter): the move is owned,
 * the line matches (Bond/signature), the stage is reached, requirements are met, and the move has no
 * Mutation yet. A move that already has one is only offered as a replacement, so it's left out here.
 */
export function mutationOffers(world: World): MutationId[] {
  return MUTATION_IDS.filter((id) => {
    if (!isBuilt(id)) return false;
    const def: MutationDef = MUTATIONS[id];
    if (def.line && def.line !== world.player.pokemonId) return false;
    if (world.player.stage < def.fromStage) return false;
    if (def.requires?.some((req) => !requirementMet(world, req))) return false;
    const index = mutationSlotIndex(world, def);
    return index >= 0 && world.moves[index]!.mutation === null;
  });
}

/** Rank-up cards for the Mutations the build holds below the top rank (D24). */
export function mutationRankUps(world: World): { mutationId: MutationId; rank: number }[] {
  return world.moves.flatMap((slot) =>
    slot.mutation && slot.mutationRank < MUTATION_RANKS.max ? [{ mutationId: slot.mutation, rank: slot.mutationRank + 1 }] : [],
  );
}

export type GrantResult = 'granted' | 'rankUp' | 'maxRank' | 'notBuilt' | 'wrongLine' | 'noSlot' | 'busy';

/**
 * Puts a Mutation on its move (sites and the debug grant), ignoring stage and requirements.
 * A missing learnset move is learned first if a slot is free. The same Mutation again ranks it up;
 * a different one replaces it at rank I (rule 1, D24). Augment sockets are never touched.
 */
export function grantMutation(world: World, id: MutationId): GrantResult {
  if (world.offer || world.evolution || world.status !== 'running') return 'busy';
  if (!isBuilt(id)) return 'notBuilt';
  const def: MutationDef = MUTATIONS[id];
  if (def.line && def.line !== world.player.pokemonId) return 'wrongLine';
  let index = mutationSlotIndex(world, def);
  if (index < 0) {
    if (def.kind === 'signature' || learnsetSlotsUsed(world) >= MAX_LEARNSET_SLOTS) return 'noSlot';
    world.moves.push(createSlot(def.move));
    index = world.moves.length - 1;
  }
  const slot = world.moves[index]!;
  if (slot.mutation === id) {
    if (slot.mutationRank >= MUTATION_RANKS.max) return 'maxRank';
    slot.mutationRank++;
    refreshStats(world);
    return 'rankUp';
  }
  setMutation(slot, id);
  refreshStats(world);
  return 'granted';
}

/** Puts a Mutation on a move at `rank` (switching resets to rank I, D24) with fresh hook state. */
export function setMutation(slot: MoveSlot, id: MutationId | null, rank = 1): void {
  slot.mutation = id;
  slot.mutationRank = id ? Math.min(MUTATION_RANKS.max, Math.max(1, rank)) : 0;
  slot.mutState = {};
  slot.cooldownLeft = 0;
  slot.activeLeft = 0;
}
