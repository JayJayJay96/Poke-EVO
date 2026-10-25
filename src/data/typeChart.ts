import type { MoveTag, PokemonType } from './content';

// Type effectiveness (D14): the real chart for the types in the game so far, multiplied for
// dual-type defenders. Immunities are softened to ×0.5 so no move is ever useless (§9).
// Unlisted pairs are ×1. Extend the table as new types arrive (Rock, Ground, Psychic…).

const SUPER = 2;
const NOT_VERY = 0.5;
/** Immunities (×0 in the games) become not-very-effective. */
const IMMUNE = NOT_VERY;

type Chart = Readonly<Partial<Record<PokemonType, Readonly<Partial<Record<PokemonType, number>>>>>>;

// Bug, Rock, Ground, Ghost and Psychic defenders arrived with the batch-2 enemies (ROSTER.md, D27).
export const TYPE_CHART: Chart = {
  Normal: { Steel: NOT_VERY, Rock: NOT_VERY, Ghost: IMMUNE },
  Fire: { Fire: NOT_VERY, Water: NOT_VERY, Grass: SUPER, Ice: SUPER, Dragon: NOT_VERY, Steel: SUPER, Bug: SUPER, Rock: NOT_VERY },
  Water: { Fire: SUPER, Water: NOT_VERY, Grass: NOT_VERY, Dragon: NOT_VERY, Rock: SUPER, Ground: SUPER },
  Grass: {
    Fire: NOT_VERY,
    Water: SUPER,
    Grass: NOT_VERY,
    Poison: NOT_VERY,
    Flying: NOT_VERY,
    Dragon: NOT_VERY,
    Steel: NOT_VERY,
    Bug: NOT_VERY,
    Rock: SUPER,
    Ground: SUPER,
  },
  Electric: { Water: SUPER, Grass: NOT_VERY, Electric: NOT_VERY, Flying: SUPER, Dragon: NOT_VERY, Ground: IMMUNE },
  Ice: {
    Fire: NOT_VERY,
    Water: NOT_VERY,
    Grass: SUPER,
    Ice: NOT_VERY,
    Flying: SUPER,
    Dragon: SUPER,
    Steel: NOT_VERY,
    Ground: SUPER,
  },
  Poison: { Grass: SUPER, Poison: NOT_VERY, Steel: IMMUNE, Rock: NOT_VERY, Ground: NOT_VERY, Ghost: NOT_VERY },
  Flying: { Grass: SUPER, Electric: NOT_VERY, Steel: NOT_VERY, Bug: SUPER, Rock: NOT_VERY, Fighting: SUPER },
  Dragon: { Dragon: SUPER, Steel: NOT_VERY },
  Dark: { Dark: NOT_VERY, Ghost: SUPER, Psychic: SUPER, Fighting: NOT_VERY },
  Steel: { Fire: NOT_VERY, Water: NOT_VERY, Electric: NOT_VERY, Ice: SUPER, Steel: NOT_VERY, Rock: SUPER },
  // Player attack rows for the Mankey and Abra lines (D56).
  Fighting: {
    Normal: SUPER,
    Ice: SUPER,
    Rock: SUPER,
    Dark: SUPER,
    Steel: SUPER,
    Poison: NOT_VERY,
    Flying: NOT_VERY,
    Psychic: NOT_VERY,
    Bug: NOT_VERY,
    Ghost: IMMUNE,
  },
  Ghost: { Ghost: SUPER, Psychic: SUPER, Dark: NOT_VERY, Normal: IMMUNE },
  Psychic: { Fighting: SUPER, Poison: SUPER, Psychic: NOT_VERY, Steel: NOT_VERY, Dark: IMMUNE },
};

const POKEMON_TYPES: ReadonlySet<string> = new Set<PokemonType>([
  'Normal',
  'Fire',
  'Water',
  'Grass',
  'Flying',
  'Dragon',
  'Poison',
  'Electric',
  'Ice',
  'Dark',
  'Steel',
  'Bug',
  'Rock',
  'Ground',
  'Ghost',
  'Psychic',
  'Fighting',
]);

/** A move's attack type: its first Pokémon-type tag (null if it has none). */
export function moveType(tags: readonly MoveTag[]): PokemonType | null {
  return (tags.find((tag) => POKEMON_TYPES.has(tag)) as PokemonType | undefined) ?? null;
}

/** Damage multiplier of an attack type against a defender's types (multiplied for dual types). */
export function effectiveness(attack: PokemonType | null, defender: readonly PokemonType[]): number {
  if (!attack) return 1;
  const row = TYPE_CHART[attack];
  if (!row) return 1;
  return defender.reduce((mult, type) => mult * (row[type] ?? 1), 1);
}
