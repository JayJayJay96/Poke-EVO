// Game content as typed data. Every number here is provisional tuning (PROJECT.md).

export type PokemonType = 'Normal' | 'Fire' | 'Water' | 'Grass';
export type FormTag = 'Projectile' | 'Area' | 'Beam' | 'Melee' | 'Aura' | 'Zone' | 'Orbit';
export type FlagTag = 'Slicing' | 'Punch' | 'Bite' | 'Pulse' | 'Sound' | 'Wind' | 'Ball' | 'Contact';
export type MoveTag = PokemonType | FormTag | FlagTag;

export type MoveId = 'ember';
export type PokemonId = 'charmander';
export type EnemyId = 'rattata';

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
  },
};

export const TUNING = {
  stepSeconds: 1 / 60,
  player: {
    invulnSeconds: 0.6,
    hurtFlashSeconds: 0.15,
  },
  enemy: {
    hitFlashSeconds: 0.08,
    /** px per second of push when two enemies fully overlap. */
    separationStrength: 120,
  },
  spawn: {
    startInterval: 1.2,
    endInterval: 0.2,
    rampSeconds: 180,
    maxEnemies: 300,
    /** Extra distance beyond the screen corner so spawns are never visible. */
    ringPadding: 48,
  },
  spatialCellSize: 64,
} as const;
