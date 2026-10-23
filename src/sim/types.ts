import type { ArenaBossId } from '../data/arena';
import type { AugmentId } from '../data/augments';
import type { AbilityId, EnemyId, PokemonId, PokemonType } from '../data/content';
import type { MoveId, StunKind } from '../data/moves';
import type { MutationId } from '../data/mutations';
import type { PlayerStatusId } from '../data/playerStatus';
import type { TechniqueId } from '../data/techniques';
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
  /** Seconds of continuous movement / standing still (hooks `moving`, `standingStill`). */
  movingFor: number;
  stillFor: number;
  /** Seconds since the player last took damage; rest regen starts past TUNING.restRegen.afterSeconds (D44). */
  calmFor: number;
  /** Last movement direction (unit vector), for moves aimed with your feet. */
  faceX: number;
  faceY: number;
  /** Actual velocity this step in px/s (0 when standing still); boss attacks lead-aim with it. */
  vx: number;
  vy: number;
  /** Line mechanics (docs/moveset): Shell blocks so far (Shell Burst counts them). */
  shellBlocks: number;
  /** Seconds until Flare Up can erupt again. */
  flareCooldownLeft: number;
  /** The Bulb's stored overheal, and timers for Bloom and Overgrow+'s emergency heal. */
  bulb: number;
  bloomCooldownLeft: number;
  emergencyCooldownLeft: number;
  /** Pikachu's Charge, 0..max. */
  charge: number;
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
  /** Its burn/poison was spread by a Technique (D40): its death triggers no Technique. */
  techMarked?: boolean;
  /** Slow strength 0..1 while slowLeft > 0. */
  slow: number;
  slowLeft: number;
  /** Stunned (sleep / paralysis): no movement, no contact damage. */
  stunLeft: number;
  /** What the current stun is (null = a flinch or trap). */
  stunKind: StunKind | null;
  /** Type multiplier of the last hit, for the hit-flash colour (D14). */
  lastEffectiveness: number;
  /** Leech Seed: ticks like poison, and each tick heals the player. */
  seedDps: number;
  seedLeft: number;
  seedTickLeft: number;
  /** Soaked (shared Water terrain): slower, staggers further. */
  soakLeft: number;
  /** Stun fatigue (new effects only, D21): can't be stunned by them again while > 0. */
  stunFatigueLeft: number;
  /** The current stun came from a new effect, so fatigue starts when it ends. */
  fatigueOnEnd: boolean;
  /** Bubble Trap: seconds until the bubble around it pops (0 = not trapped), and the pop damage. */
  trapLeft: number;
  trapDamage: number;
  /** Takes extra damage for a while: +vulnPct from moves of vulnType (null = every source). */
  vulnPct: number;
  vulnLeft: number;
  vulnType: PokemonType | null;
  /** A second, all-types vulnerability that stacks with the one above (Wash Down III, D24). */
  vulnAllPct: number;
  vulnAllLeft: number;
  /** Blinded (Smokescreen, D20): wanders toward (wanderX, wanderY) instead of you and hits softer. */
  blindLeft: number;
  wanderX: number;
  wanderY: number;
  /** Aurora Beam: deals contactDamage × weakenMult while weakenLeft > 0. */
  weakenMult: number;
  weakenLeft: number;
  /** Spreading Seed: how many times the seed on this enemy has already jumped. */
  seedJumps: number;
  /** Toxic: poison stacks while it stays in the cloud (reset when the poison ends). */
  poisonStacks: number;
  /** Elite variant (D34): tougher, its species' ability on. */
  elite: boolean;
  /** The horde it belongs to (0 = none). */
  hordeId: number;
  /** Running away from the player: until this far (horde whose leader fell; 0 = not), or for `fleeLeft` s. */
  fleeTo: number;
  fleeLeft: number;
  /** A once-per-life Elite ability (Run Away, Sturdy) has been used. */
  abilityUsed: boolean;
  /** Anger Point (Elite Tauros): enraged for this long. */
  rageLeft: number;
  /** Telegraphed attack (D35, ranged / charge): cooldown, current step and its timer, the locked aim, dash left. */
  atkCooldown: number;
  atkPhase: 'windup' | 'dash' | 'recover' | null;
  atkTimer: number;
  aimX: number;
  aimY: number;
  dashLeft: number;
  /** A diver's locked landing spot. */
  markX: number;
  markY: number;
}

/** A dart fired by a ranged enemy (D35). */
export interface EnemyShot {
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
  left: number;
  readonly damage: number;
  readonly owner: Enemy;
  /** A status the dart puts on you (Psyduck's Soak). */
  readonly status?: PlayerStatusId;
}

/**
 * Something a Mutation spawned that lives on its own for a while (mines, sprouts, orbs,
 * live wires...). The owning Mutation hooks move and resolve it; the scene draws it by owner.
 */
export interface MutationEntity {
  readonly id: number;
  readonly owner: MutationId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Second end point for line-shaped entities (wires). */
  x2: number;
  y2: number;
  radius: number;
  lifeLeft: number;
  /** Seconds until its next action (zap, lash...). */
  timer: number;
  damage: number;
  /** Enemies already hit, where an entity hits each enemy once. Reused. */
  hitIds: number[];
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
  /** Slow applied by each crater tick (Sheer Cold). */
  craterSlow: number;
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
  /** Mutation marker (e.g. a Kindled shot); 0 = plain. */
  tag: number;
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
  stunKind: StunKind | null;
  /** Poison damage per second to apply (0 = none). */
  poisonDps: number;
  /** The move's type for the type chart (null = typeless, e.g. burn/poison ticks). */
  attackType: PokemonType | null;
  /** Leech Seed damage per second to apply (0 = none). */
  seedDps: number;
  /** The move that hit, for Mutation hooks (null for zone, status and proc hits). */
  slot: MoveSlot | null;
  /** Spawned by a Mutation or ability effect: plain damage only, never triggers anything (no proc-from-proc). */
  fromProc: boolean;
}

/** Shared terrain patch (docs/moveset/README.md): a Water puddle or Fire Scorch. Never spawns effects. */
export interface Terrain {
  readonly id: number;
  x: number;
  y: number;
  radius: number;
  lifeLeft: number;
  duration: number;
  /** Puddles: chance per second for a light enemy to slip (0 = none), and the slip's stun. */
  slipChancePerSec: number;
  slipStun: number;
  /** Scorch: burn damage per second applied to enemies standing in it. */
  burnDps: number;
}

/** An Oran Berry on the ground: walk over it to heal (D12). Not magnetized. */
/** A floor pickup: an Oran Berry (heal) or a Magnet (pulls in gems). */
export interface Berry {
  readonly id: number;
  readonly kind: 'oran' | 'magnet';
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
  /** Innate statuses applied on each tick (zone-cast moves, Sheer Cold's freezing crater). */
  slow: number;
  stun: number;
  stunKind: StunKind | null;
  poisonDps: number;
  /** Type of the move that made it, for the type chart. */
  attackType: PokemonType | null;
  /** Blinded seconds per tick (smoke). */
  blind: number;
  /** The move that made it (root fields, for Sap Lash), if any. */
  source: MoveId | null;
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
  /** Ability bursts are drawn in their type's colour; null = the default explosion colour. */
  type: PokemonType | null;
}

export interface Gem {
  readonly id: number;
  x: number;
  y: number;
  value: number;
  /** Once inside the pickup radius a gem keeps flying to the player. */
  magnetized: boolean;
  /** Run time at which an uncollected gem vanishes. */
  readonly expiresAt: number;
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
  /** Predatory: aim at the lowest-HP % enemy in range; executePct = extra damage below half HP. */
  predatory: boolean;
  executePct: number;
  /** Volatility: each cast's damage multiplier is rolled between these (1, 1 = off). */
  volatileMin: number;
  volatileMax: number;
  /** Innate statuses from the move (P4a). */
  slow: number;
  stun: number;
  stunKind: StunKind | null;
  /** Poison damage per second as a fraction of the hit. */
  poisonPct: number;
  /** For the type chart (D14). */
  attackType: PokemonType | null;
  /** Leech Seed damage per second as a fraction of the hit. */
  seedPct: number;
  /** Beam length / melee reach multiplier (Mutations); area still scales both. */
  reachMult: number;
  /** Orbit radius multiplier (Spiral Spin); area still scales it. */
  orbitRadiusMult: number;
  /** Melee arc multiplier (Fury Swipes, Crescent); capped at a full circle. */
  arcMult: number;
  /** Orbit spin speed multiplier (Frenzy Dance). */
  spinMult: number;
  /** Beam width multiplier (Full Charge). */
  widthMult: number;
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
  /** Up to 3 minus a Mutation; each augment appears at most once and ranks up in place. */
  sockets: AugmentSocket[];
  /** At most one Mutation per move; it takes one of the 3 sockets and never ranks up. */
  mutation: MutationId | null;
  /** Rank of the Mutation, 1..MUTATION_RANKS.max (0 when there is none). D24. */
  mutationRank: number;
  /** An orbit can circle a point instead of the player (Tornado). */
  anchored: boolean;
  anchorX: number;
  anchorY: number;
  /** Per-move scratch state for its Mutation's hooks; reset when the Mutation changes. */
  mutState: Record<string, number>;
  stats: MoveStats;
  /** Stats before per-step `live` Mutation adjustments. */
  baseStats: MoveStats;
  /** Volatility's roll for the latest cast; applies to this move's hits (1 without Volatility). */
  volatileMult: number;
  /** Focus Energy (D40): this move's next own hit is a forced ×2 crit. */
  focusReady: boolean;
}

/** A melee swipe kept around briefly so it can be drawn. */
/** Slash's X-cut on the ground, kept briefly so it can be drawn. Presentation only. */
export interface Cut {
  x: number;
  y: number;
  radius: number;
  lifeLeft: number;
}

export interface Swing {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  reach: number;
  halfArc: number;
  lifeLeft: number;
}

export interface OwnedTechnique {
  readonly id: TechniqueId;
  rank: number;
}

/** Live Technique state (D40). */
export interface TechniqueState {
  /** Rollout: seconds moving since the last cast. */
  rollout: number;
  /** Moxie: current damage bonus. */
  moxie: number;
  endureLeft: number;
  rageLeft: number;
  focusLeft: number;
  /** Brawler: HP it may still heal this second. */
  brawlerBudget: number;
  /** > 0 while a Technique effect resolves: kills inside it trigger no Technique. */
  procDepth: number;
}

export type Card =
  | { readonly kind: 'move'; readonly moveId: MoveId }
  | { readonly kind: 'boost'; readonly boostId: BoostId }
  | { readonly kind: 'technique'; readonly techniqueId: TechniqueId; readonly rank: number }
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
    }
  /** A Mutation granted to a move whose sockets are all augments: pick the augment it replaces, or cancel. */
  /** A captured Mutation Site (D23): pick one of its cards, or skip. */
  | { readonly kind: 'site'; readonly siteId: number; readonly cards: readonly SiteCard[] }
  /** Arena boss beaten, step 1 (D28): pick the combo base, or a move to absorb into the combo; Esc skips. */
  | { readonly kind: 'combine'; readonly slots: readonly number[] }
  /**
   * Arena boss beaten, step 2 (D28): pick one card from the mixed level / augment / site pools.
   * `combineMissed`: no move had 3 augments, so this win gave no combine step.
   */
  | { readonly kind: 'arenaReward'; readonly cards: readonly RewardCard[]; readonly combineMissed: boolean };

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

/** One reward on a Mutation Site. `learn`: the move isn't owned yet and is learned with it. */
export type SiteCard =
  | { readonly kind: 'mutation'; readonly mutationId: MutationId; readonly learn: boolean }
  /** Ranks up the Mutation the move already holds, to `rank` (D24). */
  | { readonly kind: 'mutationRank'; readonly mutationId: MutationId; readonly rank: number }
  | { readonly kind: 'item'; readonly itemId: ItemId }
  /** Fallback when nothing else is eligible: a heal and a timed Power Surge (D25). */
  | { readonly kind: 'surge' };

/**
 * A Mutation Site on the map (D16, D23). Its cards are rolled the first time the player
 * stands inside and stay fixed; Pokémon-bound rolls take longer to capture.
 */
export interface MutationSite {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Seconds captured so far; drains while the player is outside. */
  progress: number;
  /** Seconds needed; set with the roll. */
  required: number;
  /** null until the player first steps inside. */
  cards: readonly SiteCard[] | null;
  /** The roll holds a Bond or signature Mutation (longer capture, gold ring). */
  bound: boolean;
}

/** One card of an arena reward (D28), with the pool it came from. */
export type RewardCard =
  | { readonly pool: 'level'; readonly card: Card }
  | { readonly pool: 'augment'; readonly slot: number; readonly card: AugmentCard }
  | { readonly pool: 'site'; readonly card: SiteCard };

/** An arena event's entrance on the main map (D28), open until `closesAt`. */
export interface ArenaEntrance {
  readonly bossId: ArenaBossId;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly closesAt: number;
}

/** A boss fight in progress (D28). The main map waits in `stored` until it ends. */
/** Moves Snorlax's picker can start (owner 2026-10-22: at least 10 kinds). */
export type SnorlaxMove =
  | 'bodySlam'
  | 'yawn'
  | 'hyperBeam'
  | 'crunch'
  | 'rockSlide'
  | 'fling'
  | 'heavySlam'
  | 'block'
  | 'belch'
  | 'earthquake';

/** Moves Zapdos's picker can start (D32). */
export type ZapdosMove =
  | 'thunder'
  | 'drillPeck'
  | 'shockWave'
  | 'thunderbolt'
  | 'roost'
  | 'thunderstorm'
  | 'zapCannon'
  | 'fence'
  | 'agility'
  | 'discharge';

/** Zapdos's fight state (D32); null on other bosses' fights. */
export interface ZapdosState {
  phase: number;
  /** Immune phase-change animation (Charge-up, Rain Dance). */
  transitionLeft: number;
  raining: boolean;
  puddleTimer: number;
  moveGap: number;
  lastMove: ZapdosMove | null;
  cooldowns: Record<Exclude<ZapdosMove, 'roost'>, number>;
  /** The phase Roost was last used in (once per phase), and the HP it entered the phase with. */
  roostPhase: number;
  phaseStartHp: number;
  /** Generators: the enemy standing there (null while broken) and the seconds until it's rebuilt. */
  pylons: { readonly x: number; readonly y: number; enemyId: number | null; recharge: number }[];
  /** Thunder rings waiting to land. */
  strikes: { readonly x: number; readonly y: number; left: number; readonly total: number; readonly factor: number }[];
  /** Thunderstorm: strikes still to call and the seconds until the next. */
  storm: { next: number; left: number } | null;
  /** Drill Peck: the locked line, then the dash, then the recover. */
  peck: { readonly x: number; readonly y: number; readonly angle: number; left: number; travelled: number; hit: boolean; phase: 'windup' | 'dash' | 'recover' } | null;
  /** Standing still while casting Shock Wave, Thunderbolt or Zap Cannon. */
  cast: { readonly move: 'shockWave' | 'thunderbolt' | 'zapCannon'; left: number } | null;
  shots: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    readonly radius: number;
    left: number;
    homingLeft: number;
    readonly turnRate: number;
    readonly factor: number;
    readonly kind: 'shock' | 'bolt' | 'cannon';
    /** Zigzag: seconds alive and the straight heading the bolt weaves around. */
    age: number;
    readonly heading: number;
  }[];
  /** Electric Fences: a telegraph line, then live for a while. */
  fences: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; left: number; phase: 'windup' | 'live' }[];
  /** Agility: the line to where it zips, then a speed buff. */
  agility: { readonly x: number; readonly y: number; left: number } | null;
  agilityLeft: number;
  roost: { left: number } | null;
  discharge: { left: number; taken: number; readonly safeX: number; readonly safeY: number; phase: 'channel' | 'recover' } | null;
  /** Overload (all generators down at once): seconds of the crash, then of the Weakened tail. */
  overloadLeft: number;
  weakLeft: number;
}

export interface ArenaRock {
  x: number;
  y: number;
  readonly radius: number;
  left: number;
  hp?: number;
}

export type MachampMove =
  | 'karateChop'
  | 'crossChop'
  | 'lowSweep'
  | 'rockTomb'
  | 'seismicToss'
  | 'rock'
  | 'bulletPunch'
  | 'dynamicPunch'
  | 'focusBlast'
  | 'focusPunch'
  | 'closeCombat';

/** Machamp (D42, BOSSES.md §4). Each move in progress is its own field; at most one runs at a time (but rocks fly). */
export interface MachampState {
  phase: number;
  /** Immune phase-change animation (Focus Energy, No Guard). */
  transitionLeft: number;
  moveGap: number;
  lastMove: MachampMove | null;
  cooldowns: Record<MachampMove, number>;
  /** Attacks since the last pose, and how many it makes before the next one (2–3, rolled). */
  attacks: number;
  poseAfter: number;
  /** Bulk Up stacks (+damage for the rest of the fight). */
  bulk: number;
  /** A pose in progress: Bulk Up (open) or Iron Pose (behind its rock); `taken` is the interrupt meter. */
  pose: { left: number; taken: number; readonly iron: boolean } | null;
  /** Staggered (shield broken, Focus Punch interrupted): it stands open. */
  staggerLeft: number;
  /** Close Combat lowered its defences: it takes more damage while > 0. */
  openLeft: number;
  /** Karate Chop / Close Combat: a string of cone hits, each re-aimed when its telegraph starts. */
  chops: { angle: number; left: number; index: number; readonly count: number; readonly close: boolean; phase: 'windup' | 'recover' } | null;
  crossChop: { readonly x: number; readonly y: number; readonly angle: number; left: number; phase: 'crouch' | 'windup' | 'recover' } | null;
  sweep: { left: number; phase: 'windup' | 'recover' } | null;
  toss: { left: number; phase: 'windup' | 'recover' } | null;
  /** Rock Tomb boulders falling on their rings. */
  tombs: { readonly x: number; readonly y: number; left: number }[];
  /** The rock in hand: getting it, the tell, then the follow-up. `stone` is the rubble entry it holds. */
  rock: {
    stone: ArenaRock | null;
    left: number;
    phase: 'grab' | 'rip' | 'tell' | 'throw' | 'charge' | 'plant' | 'recover';
    follow: 'throw' | 'strength' | 'iron';
    /** Strength: heading (rad), seconds charging; the locked line once planted. */
    heading: number;
    charged: number;
    angle: number;
    /** Rock Throw: the locked landing spot. */
    tx: number;
    ty: number;
  } | null;
  lastFollow: 'throw' | 'strength' | 'iron' | null;
  /** A thrown rock in the air (Rock Throw), landing on its ring. */
  lob: { readonly fx: number; readonly fy: number; readonly tx: number; readonly ty: number; left: number } | null;
  /** Strength boulders: queued ones wait `wait` s, then roll along the line; at the wall they stay as rocks. */
  boulders: { x: number; y: number; readonly vx: number; readonly vy: number; wait: number; hit: boolean }[];
  bullet: { readonly angle: number; left: number; travelled: number; hit: boolean; phase: 'windup' | 'dash' | 'recover' } | null;
  dynamic: { readonly x: number; readonly y: number; left: number; phase: 'windup' | 'recover' } | null;
  /** Focus Blast: casting, and the orbs in flight (each a 'focusOrb' enemy moved here). */
  blastCast: number;
  orbs: { readonly enemyId: number; vx: number; vy: number; homingLeft: number; left: number }[];
  focus: { left: number; taken: number; angle: number; phase: 'channel' | 'line' | 'recover' } | null;
}

export interface ArenaFight {
  readonly bossId: ArenaBossId;
  readonly bossEnemyId: number;
  /** Arena centre and radius; the player can't leave the circle. */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** The boss waits until the player walks in (or a few seconds pass); the timer runs from then. */
  engaged: boolean;
  waitLeft: number;
  timeLeft: number;
  /** The boss's scaled speed, applied when the fight starts. */
  readonly bossSpeed: number;
  /** Where the boss walks instead of at the player (Snorlax heading for a berry); null = the player. */
  goal: { readonly x: number; readonly y: number } | null;
  /** A Body Slam in progress: the locked ring, then the recover window (B1-3). */
  slam: { readonly x: number; readonly y: number; readonly radius: number; readonly windup: number; left: number; phase: 'windup' | 'recover' } | null;
  slamCooldown: number;
  /** Seconds until the next Gluttony berry drops. */
  berryTimer: number;
  /** Seconds left of the ground-shake before a berry (owner 2026-10-21); 0 when not shaking. */
  shakeLeft: number;
  /** Whether this shake's berry has popped up yet. */
  berryDropped: boolean;
  /** Snorlax's phase, 1–3; each Rest moves it on and it never goes back (B2). */
  phase: number;
  /** Rest in progress: seconds left and damage taken while asleep (the wake meter). */
  rest: { left: number; wake: number } | null;
  /** Snore rings flying out from where Snorlax sleeps; each hits at most once. */
  snores: { readonly x: number; readonly y: number; r: number; readonly gapAngle: number; hit: boolean }[];
  snoreTimer: number;
  /** The gap angle of the next Snore ring (it turns between rings). */
  nextSnoreGap: number;
  /** Yawn: the locked cone, telegraph then drowsy cloud. */
  yawn: { readonly x: number; readonly y: number; readonly angle: number; left: number; phase: 'windup' | 'cloud' } | null;
  yawnCooldown: number;
  /** Slow on the player from the Yawn cloud, set each step and applied to the next step's movement. */
  playerSlow: number;
  /** Body Slams still to come in the current chain (phase 2+). */
  slamsQueued: number;
  /** Hyper Beam: the locked line telegraph, then the recharge (punish window). */
  beam: { readonly x: number; readonly y: number; readonly angle: number; left: number; phase: 'windup' | 'recharge' } | null;
  beamCooldown: number;
  /** The player dropped to 0 HP in here: they're thrown back to the map, not out of the run (owner 2026-10-21). */
  knockedOut: boolean;
  /** Seconds before the boss may start its next move (pacing between moves, owner 2026-10-22). */
  moveGap: number;
  /** The last move the picker started; it never picks the same one twice in a row. */
  lastMove: SnorlaxMove | null;
  /** Cooldowns of the moves added for variety (owner 2026-10-22). */
  cooldowns: Record<'crunch' | 'rockSlide' | 'fling' | 'heavySlam' | 'block' | 'earthquake', number>;
  /** Belly Drum's drumming animation (immune while > 0). */
  drumLeft: number;
  /** Crunch: a locked bite cone in front of Snorlax, then a short recover. */
  crunch: { readonly angle: number; left: number; phase: 'windup' | 'recover' } | null;
  /** Rock Slide: Snorlax's roar (it stands still), while the rocks fall on their own. */
  rockSlideLeft: number;
  /** Rock Slide rocks: a ring telegraph each, then they land; `keep` ones stay as rubble. */
  rocks: { readonly x: number; readonly y: number; left: number; readonly keep: boolean }[];
  /** Fling: a line from a picked-up rubble rock to the locked target, then the throw. */
  fling: { readonly x: number; readonly y: number; readonly tx: number; readonly ty: number; left: number } | null;
  /** Boss projectiles: Flung rocks (they split into shards at the wall) and Belch gas puffs. */
  shots: { x: number; y: number; vx: number; vy: number; readonly radius: number; left: number; readonly factor: number; readonly kind: 'rock' | 'shard' | 'gas' }[];
  /** Heavy Slam: crouch, then airborne (immune, its shadow chases you), lock, land, recover. x/y = the shadow. */
  heavySlam: { x: number; y: number; left: number; phase: 'crouch' | 'air' | 'lock' | 'recover' } | null;
  /** Block: you can't get farther than the leash from Snorlax for a while. */
  block: { left: number; phase: 'windup' | 'hold' } | null;
  /** Belch (only right after eating a berry): a cone of gas puffs. */
  belch: { readonly angle: number; left: number; phase: 'windup' | 'recover' } | null;
  /** True after Snorlax eats a berry: its next move is Belch (lore: Belch needs a berry eaten). */
  belchReady: boolean;
  /** Earthquake: two bands of ground around where it stomped hit, then the band between them. */
  quake: { readonly x: number; readonly y: number; left: number; step: 1 | 2; phase: 'windup' | 'recover' } | null;
  /** Zapdos's own state (D32); null when the boss is someone else. */
  zap: ZapdosState | null;
  /** Machamp's own state (D42); null when the boss is someone else. */
  champ: MachampState | null;
  /**
   * Rocks that block the player and their shots (D41) for a while. A rock with `hp` is one Machamp holds as a shield:
   * it moves with Machamp, shots that hit it wear it down, and it never crumbles from the rubble cap.
   */
  rubble: ArenaRock[];
  readonly stored: {
    readonly enemies: Enemy[];
    readonly gems: Gem[];
    readonly berries: Berry[];
    readonly projectiles: Projectile[];
    readonly zones: Zone[];
    readonly puddles: Terrain[];
    readonly scorches: Terrain[];
    readonly entities: MutationEntity[];
    readonly x: number;
    readonly y: number;
  };
}

/** Arena news for the scene to show once (D28). */
export interface ArenaNotice {
  readonly kind: 'opened' | 'missed' | 'won' | 'lost' | 'knockedOut' | 'rest' | 'woke' | 'bellyDrum' | 'chargeUp' | 'rainDance' | 'overloaded' | 'focusEnergy' | 'noGuard';
  readonly bossId: ArenaBossId;
}

export type RunStatus = 'running' | 'fainted' | 'survived';

export interface World {
  time: number;
  /** Seconds spent inside arenas: the run clock (`runClock`) doesn't count them (owner 2026-10-23). */
  arenaSeconds: number;
  status: RunStatus;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  /** Dead projectiles waiting to be reused. */
  projectilePool: Projectile[];
  gems: Gem[];
  berries: Berry[];
  zones: Zone[];
  /** Shared terrain, each capped (oldest dries first). */
  puddles: Terrain[];
  scorches: Terrain[];
  /** Things Mutations spawned (mines, sprouts, orbs, wires...). */
  entities: MutationEntity[];
  /** Run times of this run's arena events (D28), seeded by the map seed. */
  readonly arenaSchedule: readonly number[];
  /** Arena events opened so far (the next index into `arenaSchedule`). */
  arenaEventsDone: number;
  arenaBossesUsed: ArenaBossId[];
  /** An open entrance on the map, if any. */
  entrance: ArenaEntrance | null;
  /** The boss fight in progress, if any. */
  arena: ArenaFight | null;
  arenaNotice: ArenaNotice | null;
  /** Mutation Sites generated so far (D23). */
  sites: MutationSite[];
  /** Map chunks whose site has been decided ("cx,cy"). */
  siteChunks: Set<string>;
  /** Seeds site placement, independent of the gameplay RNG. */
  readonly mapSeed: number;
  /** Seconds until terrain next applies its effects (0.25 s cadence, like status ticks). */
  terrainTickLeft: number;
  swings: Swing[];
  cuts: Cut[];
  blasts: Blast[];
  arcs: Arc[];
  /** Slot 0 is the signature move; the rest are learnset moves. */
  moves: MoveSlot[];
  /** Skill combine (D28): indices into `moves`, base first. Members fire with the base. */
  combo: number[];
  /** Times each Nature / filler boost has been picked. */
  boosts: Record<BoostId, number>;
  /** Owned Techniques in pick order (D40), at most MAX_TECHNIQUE_SLOTS. */
  techniques: OwnedTechnique[];
  tech: TechniqueState;
  items: ItemId[];
  /** Power Surge picks from the augment-level fallback. */
  bigBoosts: number;
  /** Seconds left on the timed Power Surge from a site's fallback (D25). */
  surgeLeft: number;
  rerollsLeft: number;
  mods: Modifiers;
  kills: number;
  level: number;
  /** XP collected towards the next level. */
  xp: number;
  /** Level-ups not yet resolved by a card choice (banked until opened, owner 2026-10-23). */
  pendingLevelUps: number;
  /** Seconds the bank has held level-ups without opening. */
  levelUpWait: number;
  /** The player asked to open the bank (hotkey or badge); consumed by the next step. */
  openLevelUps: boolean;
  /** Cards waiting for a choice; the sim is paused while this is set. */
  offer: LevelUpOffer | null;
  /** Evolution in progress; takes priority over level-up cards and pauses the sim. */
  evolution: EvolutionState | null;
  /** Set when a non-evolver's signature tiers up by level; the scene shows it and clears it. */
  signatureTierUp: { readonly from: MoveId; readonly to: MoveId } | null;
  nextId: number;
  spawnEnabled: boolean;
  spawnTimer: number;
  /** Distance from the player at which enemies appear; the scene sets it from the screen size. */
  spawnRadius: number;
  /** Pack spawning (D34): the side the current pack comes from and how many are still to come. */
  packAngle: number;
  packLeft: number;
  /** Extra lull after a horde leader falls (seconds left). */
  lullLeft: number;
  /** Horde events (D34): when the next one is due (run clock), the warning in progress, the hordes alive. */
  nextHordeAt: number;
  hordeWarning: { readonly angle: number; left: number; readonly leader: EnemyId } | null;
  hordes: { readonly id: number; readonly leaderId: number }[];
  /** Darts from ranged enemies in flight (D35), capped. */
  enemyShots: EnemyShot[];
  /** String Shot webs on the ground (D37): they slow you while you stand in one. */
  webs: { readonly x: number; readonly y: number; readonly radius: number; left: number }[];
  /** Aftermath (Elite Voltorb, D37): rings that explode after a short delay. */
  delayedBlasts: { readonly x: number; readonly y: number; readonly radius: number; left: number; readonly total: number; readonly damage: number; readonly owner: Enemy }[];
  /** Statuses on the player (D36, README §10): seconds left, poison's damage, and each status's fatigue. */
  playerStatus: {
    poisonLeft: number;
    poisonDps: number;
    poisonTick: number;
    burnLeft: number;
    burnDps: number;
    burnTick: number;
    slowLeft: number;
    paraLeft: number;
    paraTotal: number;
    confuseLeft: number;
    soakLeft: number;
    fatigue: Record<PlayerStatusId, number>;
  };
  readonly rng: Rng;
  readonly hash: SpatialHash;
}
