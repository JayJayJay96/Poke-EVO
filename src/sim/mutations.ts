import { MAX_SOCKETS } from '../data/augments';
import { MUTATION_IDS, MUTATIONS, REQUIREMENTS, type MutationDef, type MutationId, type RequirementId } from '../data/mutations';
import { MAX_LEARNSET_SLOTS } from '../data/upgrades';
import { isBuilt } from './hooks';
import { createSlot, refreshStats } from './stats';
import type { MoveSlot, World } from './types';

// Mutation acquisition and sockets (docs/moveset/README.md rules 1, 6–8; D16).
// Map sites will call mutationOffers / grantMutation; until they exist the only way in is the debug grant.

export { isBuilt, registerBuilt } from './hooks';

export function isMutationId(id: string): id is MutationId {
  return id in MUTATIONS;
}

/** Sockets a move has filled: its augments plus its Mutation. */
export function socketsUsed(slot: MoveSlot): number {
  return slot.sockets.length + (slot.mutation ? 1 : 0);
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

export type GrantResult = 'granted' | 'replace' | 'notBuilt' | 'wrongLine' | 'noSlot' | 'busy';

/**
 * Debug grant (until map sites exist): puts a Mutation on its move, ignoring stage and requirements.
 * A missing learnset move is learned first if a slot is free. An existing Mutation on that move is
 * replaced (rule 1). If all 3 sockets hold augments, the replace window opens instead (D11 flow).
 */
export function grantMutation(world: World, id: MutationId): GrantResult {
  if (world.offer || world.evolution || world.status !== 'running') return 'busy';
  if (!isBuilt(id)) return 'notBuilt';
  const def: MutationDef = MUTATIONS[id];
  if (def.line && def.line !== world.player.pokemonId) return 'wrongLine';
  let index = mutationSlotIndex(world, def);
  if (index < 0) {
    if (def.kind === 'signature' || world.moves.length - 1 >= MAX_LEARNSET_SLOTS) return 'noSlot';
    world.moves.push(createSlot(def.move));
    index = world.moves.length - 1;
  }
  const slot = world.moves[index]!;
  if (slot.mutation === null && socketsUsed(slot) >= MAX_SOCKETS) {
    world.offer = { kind: 'mutationReplace', slot: index, mutationId: id };
    return 'replace';
  }
  setMutation(slot, id);
  refreshStats(world);
  return 'granted';
}

/** Replace window: the Mutation takes this augment's socket; the augment is gone. */
export function chooseMutationReplace(world: World, socketIndex: number): void {
  const offer = world.offer;
  if (offer?.kind !== 'mutationReplace') return;
  const slot = world.moves[offer.slot];
  if (!slot || !slot.sockets[socketIndex]) return;
  slot.sockets.splice(socketIndex, 1);
  setMutation(slot, offer.mutationId);
  world.offer = null;
  refreshStats(world);
}

/** Puts a Mutation on a move with fresh hook state. */
export function setMutation(slot: MoveSlot, id: MutationId | null): void {
  slot.mutation = id;
  slot.mutState = {};
  slot.cooldownLeft = 0;
  slot.activeLeft = 0;
}

/** Replace window: keep every augment; the Mutation is not taken. */
export function cancelMutationReplace(world: World): void {
  if (world.offer?.kind === 'mutationReplace') world.offer = null;
}
