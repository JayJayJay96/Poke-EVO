import { POKEMON } from '../data/content';
import { makeOffer } from './progression';
import { refreshStats } from './stats';
import type { World } from './types';

// Auto evolution at the stage level (D10). Flow: cinematic → summary card → back to play,
// with any queued level-up cards after it. Several evolutions resolve one at a time.

/** The stage the player should evolve into now, or null. */
export function dueEvolutionStage(world: World): number | null {
  const { stages } = POKEMON[world.player.pokemonId];
  const next = world.player.stage + 1;
  const stage = stages[next];
  return stage && world.level >= stage.level ? next : null;
}

/** Starts the cinematic if an evolution is due. Returns true if one started. */
export function startEvolutionIfDue(world: World): boolean {
  if (world.evolution) return true;
  const toStage = dueEvolutionStage(world);
  if (toStage === null) return false;
  world.evolution = { fromStage: world.player.stage, toStage, phase: 'cinematic' };
  return true;
}

/** End of the animation: the new stage takes effect and the summary card shows. */
export function finishEvolutionCinematic(world: World): void {
  const evo = world.evolution;
  if (evo?.phase !== 'cinematic') return;
  world.player.stage = evo.toStage;
  refreshStats(world);
  evo.phase = 'summary';
}

/** Closes the summary card: the next evolution if another is due, else queued level-up cards. */
export function dismissEvolution(world: World): void {
  if (world.evolution?.phase !== 'summary') return;
  world.evolution = null;
  if (!startEvolutionIfDue(world) && world.pendingLevelUps > 0) world.offer = makeOffer(world);
}
