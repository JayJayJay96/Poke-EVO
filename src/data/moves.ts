import type { MoveTag } from './content';

// Move definitions. All numbers provisional (PROJECT.md).

export type MoveId = 'ember' | 'scratch' | 'fireSpin' | 'dragonRage';

interface MoveDefBase {
  readonly id: MoveId;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly MoveTag[];
  /** Seconds between casts. */
  readonly cooldown: number;
  /** Damage per hit (per tick for beams). */
  readonly damage: number;
}

/** Fires projectiles at the nearest enemy. */
export interface ProjectileMoveDef extends MoveDefBase {
  readonly form: 'projectile';
  /** Auto-target search radius in px. */
  readonly range: number;
  readonly projectileSpeed: number;
  readonly projectileRadius: number;
  readonly projectileLifetime: number;
  readonly count: number;
}

/** Instant arc swipe toward the nearest enemy. */
export interface MeleeMoveDef extends MoveDefBase {
  readonly form: 'melee';
  /** px from the player's centre. */
  readonly reach: number;
  readonly arcDegrees: number;
}

/** Balls circling the player for a while after each cast. */
export interface OrbitMoveDef extends MoveDefBase {
  readonly form: 'orbit';
  readonly count: number;
  readonly orbitRadius: number;
  readonly ballRadius: number;
  /** Radians per second. */
  readonly angularSpeed: number;
  /** Seconds the orbit stays out per cast. */
  readonly duration: number;
  /** Seconds before the same enemy can be hit again. */
  readonly hitInterval: number;
}

/** A line from the player toward the nearest enemy that damages in ticks. */
export interface BeamMoveDef extends MoveDefBase {
  readonly form: 'beam';
  /** Auto-target search radius in px. */
  readonly range: number;
  readonly length: number;
  readonly width: number;
  /** Seconds the beam stays on per cast. */
  readonly duration: number;
  readonly tickInterval: number;
}

export type MoveDef = ProjectileMoveDef | MeleeMoveDef | OrbitMoveDef | BeamMoveDef;
export type MoveForm = MoveDef['form'];

export const MOVES: Readonly<Record<MoveId, MoveDef>> = {
  ember: {
    id: 'ember',
    name: 'Ember',
    description: 'Fireball at the nearest enemy',
    tags: ['Fire', 'Projectile'],
    form: 'projectile',
    cooldown: 1.0,
    damage: 10,
    range: 320,
    projectileSpeed: 380,
    projectileRadius: 6,
    projectileLifetime: 1.2,
    count: 1,
  },
  scratch: {
    id: 'scratch',
    name: 'Scratch',
    description: 'Claw swipe in front of you',
    tags: ['Normal', 'Melee', 'Contact'],
    form: 'melee',
    cooldown: 0.9,
    damage: 14,
    reach: 60,
    arcDegrees: 110,
  },
  fireSpin: {
    id: 'fireSpin',
    name: 'Fire Spin',
    description: 'Flames circle around you',
    tags: ['Fire', 'Orbit'],
    form: 'orbit',
    cooldown: 6,
    damage: 8,
    count: 2,
    orbitRadius: 70,
    ballRadius: 9,
    angularSpeed: 3.5,
    duration: 3.5,
    hitInterval: 0.5,
  },
  dragonRage: {
    id: 'dragonRage',
    name: 'Dragon Rage',
    description: 'Beam toward the nearest enemy',
    tags: ['Dragon', 'Beam'],
    form: 'beam',
    cooldown: 3,
    damage: 6,
    range: 300,
    length: 260,
    width: 14,
    duration: 0.6,
    tickInterval: 0.2,
  },
};
