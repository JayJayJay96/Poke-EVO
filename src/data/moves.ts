import type { MoveTag } from './content';

// Move definitions. All numbers provisional (PROJECT.md).

export type MoveId =
  | 'ember'
  | 'flameBurst'
  | 'blastBurn'
  | 'scratch'
  | 'fireSpin'
  | 'dragonRage'
  | 'airSlash'
  | 'hurricane'
  // Squirtle line (P4b)
  | 'bubble'
  | 'waterPulse'
  | 'hydroCannon'
  | 'tackle'
  | 'bite'
  | 'rapidSpin'
  | 'iceBeam'
  | 'surf';

/** Splash around the impact point. */
export interface ExplosionDef {
  readonly radius: number;
  /** Splash damage to everyone else in the radius, as a fraction of the hit. */
  readonly damageFraction: number;
}

/** A burning area left at the impact point. */
export interface CraterDef {
  readonly radius: number;
  /** Seconds the crater stays. */
  readonly duration: number;
  readonly tickInterval: number;
  /** Damage per tick, as a fraction of the hit. */
  readonly damageFraction: number;
}

/** On-hit statuses built into a move (P4a). Not augments: they never proc anything else. */
export interface InnateEffects {
  /** Slow strength 0..1 for TUNING.status.slowSeconds. */
  readonly slow?: number;
  /** Stun (sleep / paralysis) seconds. */
  readonly stun?: number;
  /** Poison damage per second as a fraction of the hit, for TUNING.status.poisonSeconds. */
  readonly poisonPct?: number;
  /** Innate push distance in px (adds to the Knockback augment). */
  readonly knockback?: number;
}

interface MoveDefBase {
  readonly id: MoveId;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly MoveTag[];
  /** Seconds between casts. */
  readonly cooldown: number;
  /** Damage per hit (per tick for beams and zones). */
  readonly damage: number;
  readonly onHit?: InnateEffects;
}

/** Lightning that jumps from the first enemy hit to nearby ones (Pikachu, D13: ≤ 3 jumps). */
export interface ChainDef {
  readonly jumps: number;
  /** Damage of each jump as a fraction of the hit. */
  readonly damageFraction: number;
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
  /** Signature tiers gain these as they gain the Area / Zone tags. */
  readonly explosion?: ExplosionDef;
  readonly crater?: CraterDef;
  readonly chain?: ChainDef;
}

/** Drops a lingering zone on the nearest enemy (Poison Powder, Sleep Powder…). */
export interface ZoneMoveDef extends MoveDefBase {
  readonly form: 'zone';
  /** Auto-target search radius in px. */
  readonly range: number;
  readonly radius: number;
  /** Seconds the zone stays. */
  readonly duration: number;
  readonly tickInterval: number;
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

export type MoveDef = ProjectileMoveDef | MeleeMoveDef | OrbitMoveDef | BeamMoveDef | ZoneMoveDef;
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
  // Charmander-line signature tiers: each keeps the previous tags and adds one (§8.6).
  flameBurst: {
    id: 'flameBurst',
    name: 'Flame Burst',
    description: 'Fireball that bursts on impact',
    tags: ['Fire', 'Projectile', 'Area'],
    form: 'projectile',
    cooldown: 1.0,
    damage: 13,
    range: 340,
    projectileSpeed: 380,
    projectileRadius: 7,
    projectileLifetime: 1.2,
    count: 1,
    explosion: { radius: 45, damageFraction: 0.6 },
  },
  blastBurn: {
    id: 'blastBurn',
    name: 'Blast Burn',
    description: 'Huge blast that leaves a burning crater',
    tags: ['Fire', 'Projectile', 'Area', 'Zone'],
    form: 'projectile',
    cooldown: 1.2,
    damage: 18,
    range: 360,
    projectileSpeed: 360,
    projectileRadius: 9,
    projectileLifetime: 1.3,
    count: 1,
    explosion: { radius: 65, damageFraction: 0.7 },
    crater: { radius: 55, duration: 2.5, tickInterval: 0.5, damageFraction: 0.3 },
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
  // Charizard-only Flying moves (D11): stronger than the base learnset, and STAB once Flying.
  airSlash: {
    id: 'airSlash',
    name: 'Air Slash',
    description: 'Twin fast blades of air',
    tags: ['Flying', 'Projectile', 'Slicing'],
    form: 'projectile',
    cooldown: 1.1,
    damage: 16,
    range: 360,
    projectileSpeed: 540,
    projectileRadius: 6,
    projectileLifetime: 0.9,
    count: 2,
  },
  hurricane: {
    id: 'hurricane',
    name: 'Hurricane',
    description: 'A wide storm of wind circles you',
    tags: ['Flying', 'Orbit', 'Wind'],
    form: 'orbit',
    cooldown: 5,
    damage: 14,
    count: 4,
    orbitRadius: 110,
    ballRadius: 14,
    angularSpeed: 4.5,
    duration: 3,
    hitInterval: 0.4,
  },
  // Squirtle-line signature tiers (D13): control first, then knockback, then a heavy burst.
  bubble: {
    id: 'bubble',
    name: 'Bubble',
    description: 'Slowing bubbles at the nearest enemy',
    tags: ['Water', 'Projectile'],
    form: 'projectile',
    cooldown: 0.9,
    damage: 8,
    range: 300,
    projectileSpeed: 300,
    projectileRadius: 7,
    projectileLifetime: 1.3,
    count: 1,
    onHit: { slow: 0.35 },
  },
  waterPulse: {
    id: 'waterPulse',
    name: 'Water Pulse',
    description: 'Bubbles burst into a knockback ring',
    tags: ['Water', 'Projectile', 'Pulse'],
    form: 'projectile',
    cooldown: 1.0,
    damage: 11,
    range: 320,
    projectileSpeed: 320,
    projectileRadius: 8,
    projectileLifetime: 1.3,
    count: 1,
    explosion: { radius: 45, damageFraction: 0.5 },
    onHit: { slow: 0.35, knockback: 40 },
  },
  hydroCannon: {
    id: 'hydroCannon',
    name: 'Hydro Cannon',
    description: 'Heavy shot with a big knockback burst',
    tags: ['Water', 'Projectile', 'Pulse', 'Area'],
    form: 'projectile',
    cooldown: 1.2,
    damage: 20,
    range: 340,
    projectileSpeed: 340,
    projectileRadius: 10,
    projectileLifetime: 1.3,
    count: 1,
    explosion: { radius: 65, damageFraction: 0.6 },
    onHit: { slow: 0.4, knockback: 70 },
  },
  tackle: {
    id: 'tackle',
    name: 'Tackle',
    description: 'A short body slam in front of you',
    tags: ['Normal', 'Melee', 'Contact'],
    form: 'melee',
    cooldown: 0.8,
    damage: 12,
    reach: 55,
    arcDegrees: 90,
  },
  bite: {
    id: 'bite',
    name: 'Bite',
    description: 'Heavy bite that makes enemies flinch',
    tags: ['Dark', 'Melee', 'Bite', 'Contact'],
    form: 'melee',
    cooldown: 1.1,
    damage: 18,
    reach: 50,
    arcDegrees: 70,
    onHit: { stun: 0.4 },
  },
  rapidSpin: {
    id: 'rapidSpin',
    name: 'Rapid Spin',
    description: 'A spinning shell that knocks enemies away',
    tags: ['Normal', 'Orbit', 'Contact'],
    form: 'orbit',
    cooldown: 4,
    damage: 9,
    count: 3,
    orbitRadius: 50,
    ballRadius: 10,
    angularSpeed: 6,
    duration: 2.5,
    hitInterval: 0.4,
    onHit: { knockback: 50 },
  },
  iceBeam: {
    id: 'iceBeam',
    name: 'Ice Beam',
    description: 'A freezing beam that slows',
    tags: ['Ice', 'Beam'],
    form: 'beam',
    cooldown: 2.8,
    damage: 7,
    range: 320,
    length: 280,
    width: 12,
    duration: 0.6,
    tickInterval: 0.2,
    onHit: { slow: 0.5 },
  },
  surf: {
    id: 'surf',
    name: 'Surf',
    description: 'A 360° wave around you',
    tags: ['Water', 'Melee', 'Area'],
    form: 'melee',
    cooldown: 3.5,
    damage: 22,
    reach: 110,
    arcDegrees: 360,
    onHit: { knockback: 60 },
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
