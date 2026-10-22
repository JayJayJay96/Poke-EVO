import type { PokemonType } from '../data/content';
import { effectiveness } from '../data/typeChart';

// Status resistance by type (D27, docs/enemies/README.md §2–§3; owner-approved): one rule for enemies and the
// player. Elemental statuses follow their element's type-chart row, lore immunities become ×0.25 (never full
// immunity), and a short flavour table only ever lowers a multiplier. The result is clamped to [×0.25, ×1.5].

export type StatusId =
  | 'burn'
  | 'freeze'
  | 'paralysis'
  | 'poison'
  | 'seed'
  | 'soaked'
  | 'sleep'
  | 'confusion'
  | 'flinch'
  | 'slow'
  | 'trap'
  | 'blind'
  | 'weaken';

const FLOOR = 0.25;
const CEIL = 1.5;

/** Elemental statuses: the element whose chart row decides, and the types that are (almost) immune by lore. */
const ELEMENTAL: Readonly<Partial<Record<StatusId, { element: PokemonType; immune: readonly PokemonType[] }>>> = {
  burn: { element: 'Fire', immune: ['Fire'] },
  freeze: { element: 'Ice', immune: ['Ice'] },
  paralysis: { element: 'Electric', immune: ['Electric', 'Ground'] },
  poison: { element: 'Poison', immune: ['Poison', 'Steel'] },
  seed: { element: 'Grass', immune: ['Grass'] },
  soaked: { element: 'Water', immune: ['Water'] },
};

/** Other statuses: lore resistances only (README §3.2). */
const FLAVOUR: Readonly<Partial<Record<StatusId, Readonly<Partial<Record<PokemonType, number>>>>>> = {
  sleep: { Psychic: 0.5, Ghost: 0.5 },
  confusion: { Psychic: 0.5 },
  slow: { Flying: 0.5 },
  trap: { Ghost: 0.25, Flying: 0.5 },
  blind: { Dark: 0.5 },
  weaken: { Steel: 0.5 },
};

/**
 * How strongly a status lands on these types: ×1.5 weak, ×1, ×0.5 resist, ×0.25 lore immunity or a double resist.
 * It scales a DoT's tick damage or any other status's duration (README §2).
 */
export function statusMult(types: readonly PokemonType[], status: StatusId): number {
  const elemental = ELEMENTAL[status];
  let mult = 1;
  if (elemental) {
    if (types.some((t) => elemental.immune.includes(t))) return FLOOR;
    const e = effectiveness(elemental.element, types);
    mult = e >= 2 ? CEIL : e <= 0.25 ? FLOOR : e <= 0.5 ? 0.5 : 1;
  }
  const flavour = FLAVOUR[status];
  if (flavour) for (const t of types) mult *= flavour[t] ?? 1;
  return Math.min(CEIL, Math.max(FLOOR, mult));
}

/** Powders (Sleep Powder, Poison Powder): Grass types shrug them off (Gen 6+ lore, README §3.1). */
export function powderMult(types: readonly PokemonType[]): number {
  return types.includes('Grass') ? FLOOR : 1;
}
