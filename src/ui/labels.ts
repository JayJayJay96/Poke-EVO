import { AUGMENTS, RANK_NUMERALS, maxRankOf, type AugmentId } from '../data/augments';
import { POKEMON, type PokemonType } from '../data/content';
import { MUTATIONS, type MutationId } from '../data/mutations';

// Shared by the Phaser scenes and the HTML overlays (pause, select).

/** Player and move colours by Pokémon type, so each line reads differently in grey-box. */
export const TYPE_COLORS: Readonly<Record<PokemonType, number>> = {
  Normal: 0xd8d8c0,
  Fire: 0xff7a2f,
  Water: 0x3d8bff,
  Grass: 0x4cd964,
  Flying: 0xb9c7ff,
  Dragon: 0x7b5cff,
  Poison: 0xb05cff,
  Electric: 0xffe84d,
  Ice: 0x9ff3ff,
  Dark: 0x6b5a4e,
  Steel: 0xb8b8d0,
  Bug: 0xa8b820,
  Rock: 0xb8a038,
  Ground: 0xe0c068,
  Ghost: 0x705898,
  Psychic: 0xf85888,
  Fighting: 0xc03028,
};

/** `#rrggbb` for a 0xRRGGBB colour. */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Readable text on a 0xRRGGBB background: dark ink on light colours (Electric, Ice, Steel…). */
export function textOn(color: number): string {
  const luma = (0.299 * ((color >> 16) & 255) + 0.587 * ((color >> 8) & 255) + 0.114 * (color & 255)) / 255;
  return luma > 0.68 ? '#23263a;text-shadow:none' : '#fff';
}

/** "Slick (Mutation)" or "Steady Aim II (Bond · Squirtle)"; rank I shows no numeral. */
export function mutationLabel(id: MutationId, rank = 1): string {
  const def = MUTATIONS[id];
  const name = rank > 1 ? `${def.name} ${RANK_NUMERALS[rank - 1]}` : def.name;
  if (def.kind === 'generic') return `${name} (Mutation)`;
  const line = POKEMON[def.line].stages[0]!.name;
  return `${name} (${def.kind === 'bond' ? 'Bond' : 'Signature'} · ${line})`;
}

/** "Pierce II"; single-rank augments show just the name. */
export function augmentLabel(id: AugmentId, rank: number): string {
  const name = AUGMENTS[id].name;
  return maxRankOf(id) > 1 ? `${name} ${RANK_NUMERALS[rank - 1]}` : name;
}
