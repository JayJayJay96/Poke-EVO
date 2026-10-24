import Phaser from 'phaser';
import { POKEMON, type PokemonId } from '../data/content';
import { SelectOverlay } from '../ui/selectOverlay';

// Starter select (D13): an HTML overlay since 2026-10-24 (src/ui/selectOverlay.ts). Unlocks come in P7.

export interface RunSceneData {
  pokemonId: PokemonId;
}

export class SelectScene extends Phaser.Scene {
  /** The last line picked, so "change Pokémon" opens on it. */
  private static last: PokemonId | undefined;

  constructor() {
    super('select');
  }

  create(): void {
    // Stress mode skips the menu. `?stress=<line>` (e.g. `?stress=lapras`) runs that line's maxed-Mutation build.
    const stress = new URLSearchParams(window.location.search).get('stress');
    if (stress !== null) {
      const pokemonId = stress in POKEMON ? (stress as PokemonId) : 'charmander';
      this.scene.start('run', { pokemonId } satisfies RunSceneData);
      return;
    }
    const overlay = new SelectOverlay((pokemonId) => {
      SelectScene.last = pokemonId;
      this.scene.start('run', { pokemonId } satisfies RunSceneData);
    }, SelectScene.last);
    overlay.show();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => overlay.hide());
  }
}
