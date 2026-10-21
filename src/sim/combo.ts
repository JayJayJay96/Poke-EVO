import { MAX_SOCKETS } from '../data/augments';
import type { World } from './types';

// Skill combine (D2, D28). The first arena win picks a combo base; each later win absorbs one more
// move. Members stay in `world.moves` (their hooks and stats keep working) but fire together with
// the base on one shared cooldown, and an absorbed learnset move frees its learnset slot.

/** A full combo: the base plus 3 absorbed moves (D2: 4 wins, 1 full 4-skill combo). */
export const MAX_COMBO_MOVES = 4;

/** Learnset slots in use; absorbed learnset moves don't count (D28: combining frees the slot). */
export function learnsetSlotsUsed(world: World): number {
  const freed = world.combo.slice(1).filter((i) => i > 0).length;
  return world.moves.length - 1 - freed;
}

/** Moves that may join the combo now: all 3 augment sockets filled, not in it yet (D28). */
export function comboCandidates(world: World): number[] {
  if (world.combo.length >= MAX_COMBO_MOVES) return [];
  return world.moves
    .map((_, i) => i)
    .filter((i) => !world.combo.includes(i) && world.moves[i]!.sockets.length >= MAX_SOCKETS);
}

/** The combo's shared cooldown: the average of its members' cooldowns (owner, D28). */
export function comboCooldown(world: World): number {
  return world.combo.reduce((sum, i) => sum + world.moves[i]!.stats.cooldown, 0) / world.combo.length;
}
