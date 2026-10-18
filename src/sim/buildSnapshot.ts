import type { AugmentId } from '../data/augments';
import type { AbilityId, PokemonId } from '../data/content';
import type { MoveId } from '../data/moves';
import type { MutationId } from '../data/mutations';
import type { BoostId, ItemId } from '../data/upgrades';
import { setMutation } from './mutations';
import { createSlot, refreshStats } from './stats';
import type { World } from './types';

// The player's build as plain JSON, so a later map level can continue it (owner, D23).
// Only the build is kept: no position, enemies, timers or XP progress inside a level.

// v2 (D24): Mutation ranks.
export const BUILD_SNAPSHOT_VERSION = 2;

export interface BuildSnapshot {
  readonly version: typeof BUILD_SNAPSHOT_VERSION;
  readonly pokemonId: PokemonId;
  readonly stage: number;
  readonly ability: AbilityId;
  readonly level: number;
  readonly moves: readonly {
    readonly moveId: MoveId;
    readonly sockets: readonly { readonly augmentId: AugmentId; readonly rank: number }[];
    readonly mutation: MutationId | null;
    readonly mutationRank: number;
  }[];
  readonly boosts: Readonly<Record<BoostId, number>>;
  readonly items: readonly ItemId[];
  readonly bigBoosts: number;
  readonly rerollsLeft: number;
}

export function snapshotBuild(world: World): BuildSnapshot {
  const { player } = world;
  return {
    version: BUILD_SNAPSHOT_VERSION,
    pokemonId: player.pokemonId,
    stage: player.stage,
    ability: player.ability,
    level: world.level,
    moves: world.moves.map((slot) => ({
      moveId: slot.moveId,
      sockets: slot.sockets.map((s) => ({ augmentId: s.augmentId, rank: s.rank })),
      mutation: slot.mutation,
      mutationRank: slot.mutationRank,
    })),
    boosts: { ...world.boosts },
    items: [...world.items],
    bigBoosts: world.bigBoosts,
    rerollsLeft: world.rerollsLeft,
  };
}

/**
 * Puts a saved build on a fresh world of the same Pokémon line, at full HP.
 * Throws on a different line or snapshot version rather than guessing.
 */
export function restoreBuild(world: World, snap: BuildSnapshot): void {
  if (snap.version !== BUILD_SNAPSHOT_VERSION) throw new Error(`Unknown build snapshot version ${snap.version}`);
  if (snap.pokemonId !== world.player.pokemonId) {
    throw new Error(`Snapshot is for ${snap.pokemonId}, world is ${world.player.pokemonId}`);
  }
  world.player.stage = snap.stage;
  world.player.ability = snap.ability;
  world.level = snap.level;
  world.xp = 0;
  world.pendingLevelUps = 0;
  world.moves = snap.moves.map((m) => {
    const slot = createSlot(m.moveId);
    slot.sockets = m.sockets.map((s) => ({ augmentId: s.augmentId, rank: s.rank }));
    setMutation(slot, m.mutation, m.mutationRank);
    return slot;
  });
  world.boosts = { ...snap.boosts };
  world.items = [...snap.items];
  world.bigBoosts = snap.bigBoosts;
  world.rerollsLeft = snap.rerollsLeft;
  refreshStats(world);
  world.player.hp = world.player.maxHp;
}
