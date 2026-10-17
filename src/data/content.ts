// Game content as typed data. Every number here is provisional tuning (PROJECT.md).
import type { MoveId } from './moves';

export type PokemonType = 'Normal' | 'Fire' | 'Water' | 'Grass' | 'Flying' | 'Dragon';
export type FormTag = 'Projectile' | 'Area' | 'Beam' | 'Melee' | 'Aura' | 'Zone' | 'Orbit';
export type FlagTag = 'Slicing' | 'Punch' | 'Bite' | 'Pulse' | 'Sound' | 'Wind' | 'Ball' | 'Contact';
export type MoveTag = PokemonType | FormTag | FlagTag;

/** An evolution line, named after its first stage. */
export type PokemonId = 'charmander';
export type EnemyId = 'rattata' | 'pidgey' | 'raticate';
export type AbilityId = 'blaze';

/** One form of an evolution line. Later stages: bigger and stronger (D3 early-vs-late gamble). */
export interface EvolutionStage {
  readonly name: string;
  /** Level at which the run evolves into this stage (1 for the first stage). */
  readonly level: number;
  readonly maxHp: number;
  /** px per second. */
  readonly speed: number;
  readonly radius: number;
  /** Multiplies all of the player's damage. */
  readonly damageMult: number;
  /** Signature tier at this stage; replaces the previous tier in slot 0, keeping its augments. */
  readonly signatureMove: MoveId;
}

export interface PokemonDef {
  readonly id: PokemonId;
  readonly types: readonly PokemonType[];
  readonly stages: readonly EvolutionStage[];
  readonly ability: AbilityId;
  /** Moves that can be offered on level-up cards. */
  readonly learnset: readonly MoveId[];
}

export interface AbilityDef {
  readonly id: AbilityId;
  readonly name: string;
  readonly description: string;
  /** Active below this fraction of max HP. */
  readonly lowHpThreshold: number;
  /** Extra damage while active, as a fraction. */
  readonly damageBonus: number;
}

export interface EnemyDef {
  readonly id: EnemyId;
  readonly name: string;
  readonly types: readonly PokemonType[];
  readonly maxHp: number;
  /** px per second. */
  readonly speed: number;
  readonly radius: number;
  readonly contactDamage: number;
  /** XP value of the gem it drops. */
  readonly xp: number;
}

export const POKEMON: Readonly<Record<PokemonId, PokemonDef>> = {
  charmander: {
    id: 'charmander',
    types: ['Fire'],
    // Stage numbers are provisional (D10).
    stages: [
      { name: 'Charmander', level: 1, maxHp: 100, speed: 150, radius: 12, damageMult: 1, signatureMove: 'ember' },
      { name: 'Charmeleon', level: 10, maxHp: 140, speed: 160, radius: 15, damageMult: 1.15, signatureMove: 'flameBurst' },
      { name: 'Charizard', level: 25, maxHp: 200, speed: 175, radius: 19, damageMult: 1.35, signatureMove: 'blastBurn' },
    ],
    ability: 'blaze',
    // P2 subset (D9); Smokescreen, Wing Attack and Slash come later.
    learnset: ['scratch', 'fireSpin', 'dragonRage'],
  },
};

export const ABILITIES: Readonly<Record<AbilityId, AbilityDef>> = {
  blaze: {
    id: 'blaze',
    name: 'Blaze',
    description: 'Below 30% HP: +50% damage',
    lowHpThreshold: 0.3,
    damageBonus: 0.5,
  },
};

export const ENEMIES: Readonly<Record<EnemyId, EnemyDef>> = {
  rattata: {
    id: 'rattata',
    name: 'Rattata',
    types: ['Normal'],
    maxHp: 20,
    speed: 75,
    radius: 10,
    contactDamage: 10,
    xp: 1,
  },
  // Stat-only variants until real archetype behaviours arrive in P5 (D9).
  pidgey: {
    id: 'pidgey',
    name: 'Pidgey',
    types: ['Normal', 'Flying'],
    maxHp: 12,
    speed: 115,
    radius: 9,
    contactDamage: 8,
    xp: 1,
  },
  raticate: {
    id: 'raticate',
    name: 'Raticate',
    types: ['Normal'],
    maxHp: 70,
    speed: 62,
    radius: 14,
    contactDamage: 16,
    xp: 6,
  },
};

export const TUNING = {
  stepSeconds: 1 / 60,
  /** Run length; reaching it is a victory until the final boss exists (D9). */
  runSeconds: 15 * 60,
  player: {
    invulnSeconds: 0.6,
    hurtFlashSeconds: 0.15,
    /** XP gems inside this radius get pulled in. */
    baseMagnetRadius: 64,
  },
  xp: {
    /** XP needed for level L → L+1 = base + linear·(L−1) + quadratic·(L−1)²; ~3.9k XP to reach Lv 40. */
    curve: { base: 5, linear: 3, quadratic: 0.08 },
    /** px per second for gems flying to the player; must beat player speed. */
    gemPullSpeed: 420,
    /** Extra reach beyond the player radius for collecting a gem. */
    collectPadding: 4,
    /** Budget: past this, new gem value merges into the oldest gem. */
    maxGems: 400,
  },
  enemy: {
    hitFlashSeconds: 0.08,
    /** px per second of push when two enemies fully overlap. */
    separationStrength: 120,
  },
  spawn: {
    // Spawn rate and enemy mix live in waves.ts.
    maxEnemies: 300,
    /** Extra distance beyond the screen corner so spawns are never visible. */
    ringPadding: 48,
  },
  spatialCellSize: 64,
  status: {
    burnSeconds: 3,
    /** DoT tick (budget §11.1: not every frame). */
    burnTick: 0.25,
    /** Knockback velocity decays by e^(−decay·t); total push ≈ the knockback distance. */
    knockbackDecay: 10,
  },
  homing: {
    /** px around a projectile searched for a homing target. */
    range: 250,
    /** Max turn in radians per second. */
    turnRate: 6,
  },
  /** Performance budgets (PROJECT.md §11.1). */
  budget: {
    /** Past this, a cast spawns fewer projectiles that carry the missing damage. */
    maxProjectiles: 500,
    /** Lingering zones (craters); new ones are skipped past this. */
    maxZones: 40,
  },
} as const;
