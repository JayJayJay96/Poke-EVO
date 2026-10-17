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
  // Squirtle line (P4b, redesigned D14)
  | 'bubble'
  | 'waterPulse'
  | 'hydroCannon'
  | 'withdraw'
  | 'rapidSpin'
  | 'waterGun'
  | 'whirlpool'
  | 'surf'
  | 'hydroPump'
  | 'flashCannon'
  // Bulbasaur line (P4c)
  | 'vineWhip'
  | 'powerWhip'
  | 'frenzyPlant'
  | 'razorLeaf'
  | 'leechSeed'
  | 'poisonPowder'
  | 'sleepPowder'
  | 'sludge'
  | 'petalDance'
  | 'solarBeam'
  // Shared / other lines
  | 'tackle'
  | 'iceBeam';

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
  /** Leech Seed: damage per second as a fraction of the hit, for TUNING.status.seedSeconds; heals the player. */
  readonly seedPct?: number;
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
  /** Innate pierce (adds to the Pierce augment), e.g. Flash Cannon. */
  readonly pierce?: number;
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

/** A lingering field left by a melee swing on its target (Frenzy Plant's roots). */
export interface FieldDef {
  readonly radius: number;
  readonly duration: number;
  readonly tickInterval: number;
  /** Damage per tick as a fraction of the swing's damage. */
  readonly damageFraction: number;
  readonly onTick?: InnateEffects;
}

/** Instant arc swipe toward the nearest enemy. */
export interface MeleeMoveDef extends MoveDefBase {
  readonly form: 'melee';
  /** px from the player's centre. */
  readonly reach: number;
  readonly arcDegrees: number;
  readonly field?: FieldDef;
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
    description: 'Bubbles burst into a staggering splash',
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
    onHit: { slow: 0.35, knockback: 15 },
  },
  hydroCannon: {
    id: 'hydroCannon',
    name: 'Hydro Cannon',
    description: 'Heavy shot with a big staggering burst',
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
    onHit: { slow: 0.4, knockback: 30 },
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
  rapidSpin: {
    id: 'rapidSpin',
    name: 'Rapid Spin',
    description: 'A spinning shell that staggers enemies',
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
    onHit: { knockback: 15 },
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
    onHit: { knockback: 25 },
  },
  withdraw: {
    id: 'withdraw',
    name: 'Withdraw',
    description: 'Shell bash: staggers and briefly stuns everything close',
    tags: ['Water', 'Melee', 'Contact'],
    form: 'melee',
    cooldown: 2.5,
    damage: 10,
    reach: 45,
    arcDegrees: 360,
    onHit: { knockback: 20, stun: 0.3 },
  },
  waterGun: {
    id: 'waterGun',
    name: 'Water Gun',
    description: 'Pressure stream that pushes enemies along it',
    tags: ['Water', 'Beam'],
    form: 'beam',
    cooldown: 2.4,
    damage: 6,
    range: 300,
    length: 240,
    width: 12,
    duration: 0.6,
    tickInterval: 0.2,
    onHit: { knockback: 10 },
  },
  whirlpool: {
    id: 'whirlpool',
    name: 'Whirlpool',
    description: 'Traps enemies in a slowing vortex',
    tags: ['Water', 'Zone'],
    form: 'zone',
    cooldown: 5,
    damage: 5,
    range: 300,
    radius: 55,
    duration: 3,
    tickInterval: 0.5,
    onHit: { slow: 0.6 },
  },
  // Blastoise only (D14).
  hydroPump: {
    id: 'hydroPump',
    name: 'Hydro Pump',
    description: 'Blastoise cannons: a heavy water beam',
    tags: ['Water', 'Beam'],
    form: 'beam',
    cooldown: 4,
    damage: 18,
    range: 340,
    length: 340,
    width: 22,
    duration: 0.8,
    tickInterval: 0.2,
    onHit: { knockback: 15 },
  },
  flashCannon: {
    id: 'flashCannon',
    name: 'Flash Cannon',
    description: 'Blastoise cannons: a steel shot that pierces',
    tags: ['Steel', 'Projectile'],
    form: 'projectile',
    cooldown: 1.6,
    damage: 26,
    range: 380,
    projectileSpeed: 520,
    projectileRadius: 9,
    projectileLifetime: 1.0,
    count: 1,
    pierce: 2,
  },
  // Bulbasaur-line signature tiers (D13): long whips → 360° sweep → sweep that leaves roots.
  vineWhip: {
    id: 'vineWhip',
    name: 'Vine Whip',
    description: 'Two long vines lash in front of you',
    tags: ['Grass', 'Melee'],
    form: 'melee',
    cooldown: 1.0,
    damage: 13,
    reach: 75,
    arcDegrees: 140,
  },
  powerWhip: {
    id: 'powerWhip',
    name: 'Power Whip',
    description: 'A 360° vine sweep',
    tags: ['Grass', 'Melee', 'Area'],
    form: 'melee',
    cooldown: 1.1,
    damage: 18,
    reach: 95,
    arcDegrees: 360,
  },
  frenzyPlant: {
    id: 'frenzyPlant',
    name: 'Frenzy Plant',
    description: 'A 360° sweep that leaves a slowing root field',
    tags: ['Grass', 'Melee', 'Area', 'Zone'],
    form: 'melee',
    cooldown: 1.4,
    damage: 26,
    reach: 105,
    arcDegrees: 360,
    field: { radius: 60, duration: 2.5, tickInterval: 0.5, damageFraction: 0.35, onTick: { slow: 0.4 } },
  },
  razorLeaf: {
    id: 'razorLeaf',
    name: 'Razor Leaf',
    description: 'Two sharp leaves',
    tags: ['Grass', 'Projectile', 'Slicing'],
    form: 'projectile',
    cooldown: 1.0,
    damage: 9,
    range: 320,
    projectileSpeed: 420,
    projectileRadius: 6,
    projectileLifetime: 1.0,
    count: 2,
  },
  leechSeed: {
    id: 'leechSeed',
    name: 'Leech Seed',
    description: 'Plants a seed that drains the enemy and heals you',
    tags: ['Grass', 'Projectile'],
    form: 'projectile',
    cooldown: 2.5,
    damage: 4,
    range: 320,
    projectileSpeed: 300,
    projectileRadius: 6,
    projectileLifetime: 1.4,
    count: 1,
    onHit: { seedPct: 1.5 },
  },
  poisonPowder: {
    id: 'poisonPowder',
    name: 'Poison Powder',
    description: 'A cloud that poisons everything inside',
    tags: ['Poison', 'Zone'],
    form: 'zone',
    cooldown: 4.5,
    damage: 3,
    range: 300,
    radius: 60,
    duration: 3,
    tickInterval: 0.5,
    onHit: { poisonPct: 1 },
  },
  sleepPowder: {
    id: 'sleepPowder',
    name: 'Sleep Powder',
    description: 'A cloud that puts enemies to sleep',
    tags: ['Grass', 'Zone'],
    form: 'zone',
    cooldown: 6,
    damage: 1,
    range: 300,
    radius: 55,
    duration: 2,
    tickInterval: 0.5,
    onHit: { stun: 0.8 },
  },
  sludge: {
    id: 'sludge',
    name: 'Sludge',
    description: 'A toxic glob that poisons',
    tags: ['Poison', 'Projectile', 'Ball'],
    form: 'projectile',
    cooldown: 1.3,
    damage: 12,
    range: 320,
    projectileSpeed: 330,
    projectileRadius: 8,
    projectileLifetime: 1.2,
    count: 1,
    onHit: { poisonPct: 0.5 },
  },
  petalDance: {
    id: 'petalDance',
    name: 'Petal Dance',
    description: 'A swirl of petals around you',
    tags: ['Grass', 'Orbit'],
    form: 'orbit',
    cooldown: 5,
    damage: 10,
    count: 4,
    orbitRadius: 80,
    ballRadius: 9,
    angularSpeed: 4,
    duration: 3.5,
    hitInterval: 0.4,
  },
  // Venusaur only (kit rule 4).
  solarBeam: {
    id: 'solarBeam',
    name: 'Solar Beam',
    description: 'Venusaur gathers light into a massive beam',
    tags: ['Grass', 'Beam'],
    form: 'beam',
    cooldown: 4.5,
    damage: 22,
    range: 380,
    length: 380,
    width: 26,
    duration: 0.8,
    tickInterval: 0.2,
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
