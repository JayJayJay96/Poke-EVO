import type { EnemyId, MoveId, PokemonId } from '../data/content';
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

export interface Projectile {
  readonly id: number;
  readonly moveId: MoveId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  lifeLeft: number;
  dead: boolean;
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

export interface MoveSlot {
  readonly moveId: MoveId;
  cooldownLeft: number;
}

export type RunStatus = 'running' | 'fainted' | 'survived';

export interface World {
  time: number;
  status: RunStatus;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  gems: Gem[];
  moves: MoveSlot[];
  kills: number;
  level: number;
  /** XP collected towards the next level. */
  xp: number;
  /** Level-ups not yet shown to the player (the card window consumes these from P2b). */
  pendingLevelUps: number;
  nextId: number;
  spawnEnabled: boolean;
  spawnTimer: number;
  /** Distance from the player at which enemies appear; the scene sets it from the screen size. */
  spawnRadius: number;
  readonly rng: Rng;
  readonly hash: SpatialHash;
}
