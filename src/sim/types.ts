import type { AugmentId } from '../data/augments';
import type { AbilityId, EnemyId, PokemonId, PokemonType } from '../data/content';
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
  /** Current trait; can change when an evolution offers a choice (D11). */
  ability: AbilityId;
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
  /** Shell: seconds until the next block is ready (0 = ready). */
  blockReadyLeft: number;
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
  /** Knockback velocity, decaying each step. */
  kbX: number;
  kbY: number;
  /** Burn: damage per second while burnLeft > 0, applied in 0.25 s ticks. */
  burnDps: number;
  burnLeft: number;
  burnTickLeft: number;
  /** Poison: like burn, tracked separately so both can stack. */
  poisonDps: number;
  poisonLeft: number;
  poisonTickLeft: number;
  /** Slow strength 0..1 while slowLeft > 0. */
  slow: number;
  slowLeft: number;
  /** Stunned (sleep / paralysis): no movement, no contact damage. */
  stunLeft: number;
  /** Type multiplier of the last hit, for the hit-flash colour (D14). */
  lastEffectiveness: number;
  /** Leech Seed: ticks like poison, and each tick heals the player. */
  seedDps: number;
  seedLeft: number;
  seedTickLeft: number;
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
  /** 0 = no explosion. */
  explodeRadius: number;
  explodeFraction: number;
  /** 0 = no crater. */
  craterRadius: number;
  craterDuration: number;
  craterTick: number;
  /** Damage per crater tick. */
  craterDamage: number;
  /** A projectile leaves at most one crater, on its first hit (D11). */
  craterSpawned: boolean;
  /** Innate chain: jumps after the first hit, and damage per jump as a fraction. */
  chainJumps: number;
  chainFraction: number;
  /** On-hit effects carried to every enemy this projectile hits. */
  hit: HitInfo;
  /** Enemies it may still pass through. */
  pierceLeft: number;
  homing: boolean;
  homingTarget: Enemy | null;
  returns: boolean;
  /** On the way back to the player. Return projectiles pierce on both legs. */
  returning: boolean;
  /** Remaining life at which a Return projectile turns around. */
  turnAt: number;
  speed: number;
  /** Ids already hit this leg, so pierce/return never hit the same enemy twice in a row. Reused. */
  hitIds: number[];
  lifeLeft: number;
  dead: boolean;
}

/**
 * On-hit effects of a move, applied by damageEnemy (§8.8 onHit).
 * Splash damage carries them too; zone and burn ticks do not (no proc-from-proc).
 */
export interface HitInfo {
  critChance: number;
  missingHpBonus: number;
  /** Heal as a fraction of damage dealt. */
  lifesteal: number;
  /** Burn damage per second to apply (0 = none). */
  burnDps: number;
  /** Push distance in px (0 = none), along dirX/dirY. */
  knockback: number;
  dirX: number;
  dirY: number;
  /** Slow strength 0..1 (0 = none). */
  slow: number;
  /** Stun seconds (0 = none). */
  stun: number;
  /** Poison damage per second to apply (0 = none). */
  poisonDps: number;
  /** The move's type for the type chart (null = typeless, e.g. burn/poison ticks). */
  attackType: PokemonType | null;
  /** Leech Seed damage per second to apply (0 = none). */
  seedDps: number;
}

/** An Oran Berry on the ground: walk over it to heal (D12). Not magnetized. */
export interface Berry {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  collected: boolean;
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
  /** Innate statuses applied on each tick (zone-cast moves); craters have none. */
  slow: number;
  stun: number;
  poisonDps: number;
  /** Type of the move that made it, for the type chart. */
  attackType: PokemonType | null;
}

/** A chain-lightning jump, kept briefly so it can be drawn. Presentation only. */
export interface Arc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lifeLeft: number;
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
  pierce: number;
  homing: boolean;
  returns: boolean;
  knockback: number;
  /** Burn damage per second as a fraction of the hit. */
  burnPct: number;
  lifesteal: number;
  /** Innate statuses from the move (P4a). */
  slow: number;
  stun: number;
  /** Poison damage per second as a fraction of the hit. */
  poisonPct: number;
  /** For the type chart (D14). */
  attackType: PokemonType | null;
  /** Leech Seed damage per second as a fraction of the hit. */
  seedPct: number;
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

/**
 * Augment cards already dealt per move during one augment level, so going Back and
 * picking the same move again shows the same cards (Back is not a free reroll, D12).
 */
export type DrawnAugments = Partial<Record<number, readonly AugmentCard[]>>;

export type LevelUpOffer =
  /** Normal level: pick one card. */
  | { readonly kind: 'cards'; readonly cards: readonly Card[] }
  /** Augment level, window 1: pick which move (indices into `World.moves`). */
  | { readonly kind: 'pickSkill'; readonly slots: readonly number[]; readonly drawn: DrawnAugments }
  /** Augment level, window 2: pick an augment for that move, or go Back to window 1. */
  | {
      readonly kind: 'augment';
      readonly slot: number;
      readonly cards: readonly AugmentCard[];
      /** Window 1's moves, for Back. */
      readonly skills: readonly number[];
      readonly drawn: DrawnAugments;
    }
  /** Augment level, window 3 (sockets full): pick which socket the new augment replaces, or go back. */
  | {
      readonly kind: 'replace';
      readonly slot: number;
      readonly card: AugmentCard;
      /** The augment cards to return to on Back. */
      readonly cards: readonly AugmentCard[];
      readonly skills: readonly number[];
      readonly drawn: DrawnAugments;
    };

/**
 * An evolution in progress. The sim is paused throughout.
 * `cinematic`: the scene plays the animation, then calls finishEvolutionCinematic.
 * `summary`: the new stage is applied; the "what changed" card waits for dismissEvolution.
 */
export interface EvolutionState {
  readonly fromStage: number;
  readonly toStage: number;
  phase: 'cinematic' | 'summary';
  /** Traits to choose from on the summary card; null when the stage offers no choice. */
  traitChoices: readonly AbilityId[] | null;
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
  berries: Berry[];
  zones: Zone[];
  swings: Swing[];
  blasts: Blast[];
  arcs: Arc[];
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
