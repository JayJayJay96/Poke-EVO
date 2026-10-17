import type { AugmentId } from '../data/augments';
import type { EnemyId, PokemonId } from '../data/content';
import type { MoveId } from '../data/moves';
import type { BoostId, ItemId } from '../data/upgrades';
import type { Rng } from './rng';
import type { SpatialHash } from './spatialHash';

// Sim state is mutable on purpose: hundreds of entities update 60 times a second.

export interface InputState {
  /** -1..1; diagonals are normalised by the sim. */
  readonly moveX: number;
  readonly moveY: number;
}

export interface Player {
  readonly pokemonId: PokemonId;
  /** Index into the line's evolution stages. */
  stage: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  invulnLeft: number;
  hurtFlashLeft: number;
  /** XP gems inside this radius fly to the player. */
  pickupRadius: number;
}

export interface Enemy {
  readonly id: number;
  readonly kind: EnemyId;
  x: number;
  y: number;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  contactDamage: number;
  hitFlashLeft: number;
}

/** Pooled: dead projectiles are reused, so every field is reassigned on spawn. */
export interface Projectile {
  id: number;
  moveId: MoveId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  critChance: number;
  /** Blaze Core: extra damage at 0 HP, scaled by missing HP when the hit lands. */
  missingHpBonus: number;
  /** 0 = no explosion. */
  explodeRadius: number;
  explodeFraction: number;
  /** 0 = no crater. */
  craterRadius: number;
  craterDuration: number;
  craterTick: number;
  /** Damage per crater tick. */
  craterDamage: number;
  lifeLeft: number;
  dead: boolean;
}

/** A lingering damage area (Blast Burn's crater). Never spawns further effects. */
export interface Zone {
  readonly id: number;
  x: number;
  y: number;
  radius: number;
  lifeLeft: number;
  /** Total lifetime, for fading. */
  duration: number;
  tickInterval: number;
  tickLeft: number;
  damage: number;
  critChance: number;
}

/** An explosion kept briefly so it can be drawn. Presentation only. */
export interface Blast {
  x: number;
  y: number;
  radius: number;
  lifeLeft: number;
}

export interface Gem {
  readonly id: number;
  x: number;
  y: number;
  value: number;
  /** Once inside the pickup radius a gem keeps flying to the player. */
  magnetized: boolean;
  collected: boolean;
}

/** Build-wide multipliers from boosts and held items. */
export interface Modifiers {
  damageMult: number;
  cooldownMult: number;
  areaMult: number;
  durationMult: number;
  critChance: number;
  moveSpeedMult: number;
  pickupMult: number;
  maxHpBonus: number;
  regenPerSec: number;
  /** Multiplier on damage the player takes (Glass). */
  damageTakenMult: number;
}

/** Effective numbers for one equipped move; `area`, `duration` and `speedMult` multiply the move's base values. */
export interface MoveStats {
  damage: number;
  cooldown: number;
  area: number;
  duration: number;
  critChance: number;
  /** Projectiles added to each cast. */
  extraCount: number;
  speedMult: number;
  /** Explosion and crater radius. */
  blastRadiusMult: number;
  zoneDurationMult: number;
  zoneDamageMult: number;
  missingHpBonus: number;
}

export interface AugmentSocket {
  readonly augmentId: AugmentId;
  /** 1..3 (I–III). */
  rank: number;
}

export interface MoveSlot {
  /** Changes only for the signature slot, when evolving to the next tier. */
  moveId: MoveId;
  cooldownLeft: number;
  /** Seconds an orbit or beam has left on screen. */
  activeLeft: number;
  /** Orbit rotation in radians. */
  angle: number;
  /** Beam direction, locked at cast. */
  dirX: number;
  dirY: number;
  /** Seconds until the next beam damage tick. */
  tickLeft: number;
  /** Enemy id → seconds before this move may hit it again (orbits). */
  hitCooldowns: Map<number, number>;
  /** Up to 3; each augment appears at most once and ranks up in place. */
  sockets: AugmentSocket[];
  stats: MoveStats;
}

/** A melee swipe kept around briefly so it can be drawn. */
export interface Swing {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  reach: number;
  halfArc: number;
  lifeLeft: number;
}

export type Card =
  | { readonly kind: 'move'; readonly moveId: MoveId }
  | { readonly kind: 'boost'; readonly boostId: BoostId }
  | { readonly kind: 'item'; readonly itemId: ItemId }
  | { readonly kind: 'potion' }
  | { readonly kind: 'bigBoost' };

/** An augment offered for a move: new at rank 1, or the next rank of one already socketed. */
export interface AugmentCard {
  readonly augmentId: AugmentId;
  readonly rank: number;
}

export type LevelUpOffer =
  /** Normal level: pick one card. */
  | { readonly kind: 'cards'; readonly cards: readonly Card[] }
  /** Augment level, window 1: pick which move (indices into `World.moves`). */
  | { readonly kind: 'pickSkill'; readonly slots: readonly number[] }
  /** Augment level, window 2: pick an augment for that move. */
  | { readonly kind: 'augment'; readonly slot: number; readonly cards: readonly AugmentCard[] };

/**
 * An evolution in progress. The sim is paused throughout.
 * `cinematic`: the scene plays the animation, then calls finishEvolutionCinematic.
 * `summary`: the new stage is applied; the "what changed" card waits for dismissEvolution.
 */
export interface EvolutionState {
  readonly fromStage: number;
  readonly toStage: number;
  phase: 'cinematic' | 'summary';
}

export type RunStatus = 'running' | 'fainted' | 'survived';

export interface World {
  time: number;
  status: RunStatus;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  /** Dead projectiles waiting to be reused. */
  projectilePool: Projectile[];
  gems: Gem[];
  zones: Zone[];
  swings: Swing[];
  blasts: Blast[];
  /** Slot 0 is the signature move; the rest are learnset moves. */
  moves: MoveSlot[];
  /** Times each generic boost has been picked. */
  boosts: Record<BoostId, number>;
  items: ItemId[];
  /** Power Surge picks from the augment-level fallback. */
  bigBoosts: number;
  rerollsLeft: number;
  mods: Modifiers;
  kills: number;
  level: number;
  /** XP collected towards the next level. */
  xp: number;
  /** Level-ups not yet resolved by a card choice. */
  pendingLevelUps: number;
  /** Cards waiting for a choice; the sim is paused while this is set. */
  offer: LevelUpOffer | null;
  /** Evolution in progress; takes priority over level-up cards and pauses the sim. */
  evolution: EvolutionState | null;
  nextId: number;
  spawnEnabled: boolean;
  spawnTimer: number;
  /** Distance from the player at which enemies appear; the scene sets it from the screen size. */
  spawnRadius: number;
  readonly rng: Rng;
  readonly hash: SpatialHash;
}
