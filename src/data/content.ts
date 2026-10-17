// Game content as typed data. Every number here is provisional tuning (PROJECT.md).

export type PokemonType = 'Normal' | 'Fire' | 'Water' | 'Grass' | 'Flying' | 'Dragon';
export type FormTag = 'Projectile' | 'Area' | 'Beam' | 'Melee' | 'Aura' | 'Zone' | 'Orbit';
export type FlagTag = 'Slicing' | 'Punch' | 'Bite' | 'Pulse' | 'Sound' | 'Wind' | 'Ball' | 'Contact';
export type MoveTag = PokemonType | FormTag | FlagTag;

export type MoveId = 'ember';
export type PokemonId = 'charmander';
export type EnemyId = 'rattata' | 'pidgey' | 'raticate';

export interface ProjectileMoveDef {
  readonly id: MoveId;
  readonly name: string;
  readonly tags: readonly MoveTag[];
  /** Seconds between casts. */
  readonly cooldown: number;
  readonly damage: number;
  /** Auto-target search radius in px. */
  readonly range: number;
  /** px per second. */
  readonly projectileSpeed: number;
  readonly projectileRadius: number;
  /** Seconds before an unhit projectile disappears. */
  readonly projectileLifetime: number;
}

export interface PokemonDef {
  readonly id: PokemonId;
  readonly name: string;
  readonly types: readonly PokemonType[];
  readonly maxHp: number;
  /** px per second. */
  readonly speed: number;
  readonly radius: number;
  readonly signatureMove: MoveId;
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

export const MOVES: Readonly<Record<MoveId, ProjectileMoveDef>> = {
  ember: {
    id: 'ember',
    name: 'Ember',
    tags: ['Fire', 'Projectile'],
    cooldown: 1.0,
    damage: 10,
    range: 320,
    projectileSpeed: 380,
    projectileRadius: 6,
    projectileLifetime: 1.2,
  },
};

export const POKEMON: Readonly<Record<PokemonId, PokemonDef>> = {
  charmander: {
    id: 'charmander',
    name: 'Charmander',
    types: ['Fire'],
    maxHp: 100,
    speed: 150,
    radius: 12,
    signatureMove: 'ember',
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
} as const;
