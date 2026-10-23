// Techniques (D40): ranked passives offered on normal levels. All numbers provisional.
import type { MoveTag } from './content';

export type TechniqueId =
  | 'rollout'
  | 'moxie'
  | 'endure'
  | 'rage'
  | 'pickup'
  | 'focusEnergy'
  | 'kindling'
  | 'riptide'
  | 'sporeCloud'
  | 'staticField'
  | 'frostbite'
  | 'sharpshooter'
  | 'brawler';

export interface TechniqueDef {
  readonly id: TechniqueId;
  readonly name: string;
  /** Offered only while an owned move has one of these tags; empty = any Pokémon. */
  readonly requiresAny: readonly MoveTag[];
  /** The rank's main number (I, II, III); its meaning is in each description. */
  readonly values: readonly [number, number, number];
  readonly descriptions: readonly [string, string, string];
}

export const MAX_TECHNIQUE_SLOTS = 5;
export const MAX_TECHNIQUE_RANK = 3;

/** Fixed numbers shared by every rank. */
export const TECHNIQUE_TUNING = {
  rollout: { movingSeconds: 2 },
  moxie: { perKill: 0.01 },
  endure: { invulnSeconds: 1 },
  rage: { seconds: 3 },
  pickup: { heal: 5 },
  focusEnergy: { critMult: 2 },
  kindling: { radius: 120 },
  riptide: { seconds: 2 },
  frostbite: { radius: 60 },
  sharpshooter: { range: 300 },
  brawler: { healPerHit: 1 },
} as const;

const def = (
  id: TechniqueId,
  name: string,
  requiresAny: readonly MoveTag[],
  values: readonly [number, number, number],
  describe: (v: number) => string,
): TechniqueDef => ({
  id,
  name,
  requiresAny,
  values,
  descriptions: [describe(values[0]), describe(values[1]), describe(values[2])],
});

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const TECHNIQUES: Readonly<Record<TechniqueId, TechniqueDef>> = {
  rollout: def('rollout', 'Rollout', [], [0.4, 0.6, 0.8], (v) => `After 2 s of moving, your next cast deals +${pct(v)} damage`),
  moxie: def('moxie', 'Moxie', [], [0.1, 0.15, 0.2], (v) => `Each kill: +1% damage, up to +${pct(v)}. Resets when you are hit`),
  endure: def('endure', 'Endure', [], [90, 75, 60], (v) => `A lethal hit leaves you at 1 HP (once every ${v} s)`),
  rage: def('rage', 'Rage', [], [0.2, 0.25, 0.3], (v) => `Taking a hit: cooldowns −${pct(v)} for 3 s`),
  pickup: def('pickup', 'Pickup', [], [0.02, 0.03, 0.04], (v) => `XP gems: ${pct(v)} chance to heal 5 HP`),
  focusEnergy: def('focusEnergy', 'Focus Energy', [], [8, 7, 6], (v) => `Every ${v} s, each move's next hit is a ×2 crit`),
  kindling: def('kindling', 'Kindling', ['Fire'], [1, 2, 3], (v) => `A burning enemy's death spreads its burn to ${v} nearby`),
  riptide: def('riptide', 'Riptide', ['Water'], [0.15, 0.2, 0.25], (v) => `Water hits slow by ${pct(v)} for 2 s`),
  sporeCloud: def('sporeCloud', 'Spore Cloud', ['Grass', 'Poison'], [50, 70, 90], (v) => `A poisoned enemy's death poisons enemies within ${v} px`),
  staticField: def('staticField', 'Static Field', ['Electric'], [0.15, 0.25, 0.35], (v) => `Paralysed enemies take +${pct(v)} damage`),
  frostbite: def('frostbite', 'Frostbite', ['Ice'], [0.2, 0.35, 0.5], (v) => `A slowed enemy's death shatters for ${pct(v)} of the hit nearby`),
  sharpshooter: def('sharpshooter', 'Sharpshooter', ['Projectile'], [0.2, 0.3, 0.4], (v) => `Projectile hits beyond 300 px: +${pct(v)} damage`),
  brawler: def('brawler', 'Brawler', ['Melee', 'Contact'], [3, 4, 5], (v) => `Melee hits heal 1 HP each, up to ${v} HP/s`),
};

export const TECHNIQUE_IDS = Object.keys(TECHNIQUES) as TechniqueId[];
