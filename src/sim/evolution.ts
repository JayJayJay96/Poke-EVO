import { POKEMON } from '../data/content';
import { makeOffer } from './progression';
import { refreshStats } from './stats';
import type { World } from './types';

// Auto evolution at the stage level (D10). Flow: cinematic → summary card (with a trait
// choice when the stage offers one, D11) → back to play, with any queued level-up cards
// after it. Several evolutions resolve one at a time.

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
  world.evolution = { fromStage: world.player.stage, toStage, phase: 'cinematic', traitChoices: null };
  return true;
}

/** End of the animation: the new stage takes effect and the summary card shows. */
export function finishEvolutionCinematic(world: World): void {
  const evo = world.evolution;
  if (evo?.phase !== 'cinematic') return;
  const stage = POKEMON[world.player.pokemonId].stages[evo.toStage]!;
  world.player.stage = evo.toStage;
  // The signature slot upgrades to the new tier. Its augments stay valid:
  // each tier keeps the previous tags and only adds new ones (§8.6).
  const signature = world.moves[0];
  if (signature) signature.moveId = stage.signatureMove;
  refreshStats(world);
  evo.phase = 'summary';
  evo.traitChoices = stage.abilityChoices && stage.abilityChoices.length > 0 ? stage.abilityChoices : null;
}

/** Summary card with a trait choice: takes the chosen trait and continues. */
export function chooseEvolutionTrait(world: World, index: number): void {
  const evo = world.evolution;
  if (evo?.phase !== 'summary' || !evo.traitChoices) return;
  const ability = evo.traitChoices[index];
  if (!ability) return;
  world.player.ability = ability;
  evo.traitChoices = null;
  refreshStats(world);
  dismissEvolution(world);
}

/**
 * Closes the summary card: the next evolution if another is due, else queued level-up cards.
 * Does nothing while a trait choice is still open.
 */
export function dismissEvolution(world: World): void {
  const evo = world.evolution;
  if (evo?.phase !== 'summary' || evo.traitChoices) return;
  world.evolution = null;
  if (!startEvolutionIfDue(world) && world.pendingLevelUps > 0) world.offer = makeOffer(world);
}
