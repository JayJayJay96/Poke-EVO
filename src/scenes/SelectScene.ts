import Phaser from 'phaser';
import { ABILITIES, POKEMON, type PokemonDef, type PokemonId } from '../data/content';
import { MOVES } from '../data/moves';

// Simple grey-box starter select (D13). Polish and unlocks come in P7.

const CARD_W = 250;
const CARD_H = 210;
const CARD_GAP = 16;
const NUMBER_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'] as const;

export interface RunSceneData {
  pokemonId: PokemonId;
}

/** "3-stage", "2-stage" or "No evolution": the early-vs-late gamble (§5). */
export function tierLabel(def: PokemonDef): string {
  if (def.stages.length === 1) return 'No evolution';
  return `${def.stages.length}-stage`;
}

export class SelectScene extends Phaser.Scene {
  constructor() {
    super('select');
  }

  create(): void {
    // Stress mode skips the menu.
    if (new URLSearchParams(window.location.search).has('stress')) {
      this.scene.start('run', { pokemonId: 'charmander' } satisfies RunSceneData);
      return;
    }

    const lines = Object.values(POKEMON);
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, 24, 'Choose your Pokémon', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    this.add
      .text(cam.width / 2, 56, `Keys 1–${lines.length} or click`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5, 0);

    const n = lines.length;
    const cardW = Math.min(CARD_W, (cam.width - 40 - (n - 1) * CARD_GAP) / n);
    const startX = cam.width / 2 - (n * cardW + (n - 1) * CARD_GAP) / 2;
    const top = Math.max(84, cam.height / 2 - CARD_H / 2 - 40);

    // Narrow windows wrap the text, so the cards grow to fit the tallest one.
    const cards = lines.map((def, i) => {
      const first = def.stages[0]!;
      const last = def.stages[def.stages.length - 1]!;
      const names = def.stages.map((s) => s.name).join(' → ');
      const ability = ABILITIES[def.ability];
      const tiers = def.signatureTiers?.length ? ` (stronger at Lv ${def.signatureTiers.map((t) => t.level).join(' / ')})` : '';
      const x = startX + i * (cardW + CARD_GAP);
      const text = this.add
        .text(
          x + 10,
          top + 10,
          [
            `[${i + 1}] ${names}`,
            `${first.types.join('/')}${last.types.length > first.types.length ? ` → ${last.types.join('/')}` : ''} · ${tierLabel(def)}`,
            '',
            def.role,
            '',
            `Ability: ${ability.name}`,
            ability.description,
            '',
            `Signature: ${MOVES[first.signatureMove].name}${tiers}`,
          ].join('\n'),
          { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', lineSpacing: 2, wordWrap: { width: cardW - 20 } },
        )
        .setDepth(1);
      return { def, x, text };
    });
    const cardH = Math.max(CARD_H, ...cards.map((c) => c.text.height + 20));
    for (const { def, x } of cards) {
      this.add
        .rectangle(x, top, cardW, cardH, 0x1c2233, 0.97)
        .setOrigin(0)
        .setStrokeStyle(2, 0xffd34d)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.start(def.id));
    }

    const keyboard = this.input.keyboard!;
    lines.forEach((def, i) => {
      const key = NUMBER_KEYS[i];
      if (key) keyboard.addKey(key).once('down', () => this.start(def.id));
    });
  }

  private start(pokemonId: PokemonId): void {
    this.scene.start('run', { pokemonId } satisfies RunSceneData);
  }
}
