import type { MoveTag } from './content';

export type StunKind = 'sleep' | 'paralysis';

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
  // Charmander line, new in P4f-7 (docs/moveset/shared)
  | 'smokescreen'
  | 'slash'
  | 'wingAttack'
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
  // Pikachu line (P4d)
  | 'thunderShock'
  | 'thunderbolt'
  | 'quickAttack'
  | 'spark'
  | 'electroBall'
  | 'thunderWave'
  | 'ironTail'
  | 'thunder'
  // Lapras (P4d)
  | 'iceShard'
  | 'sheerCold'
  | 'bodySlam'
  // Shared / other lines
  | 'tackle'
  | 'iceBeam'
  // Mankey line (D56)
  | 'karateChop'
  | 'crossChop'
  | 'rageFist'
  | 'lowKick'
  | 'vacuumWave'
  | 'seismicToss'
  | 'thrash'
  | 'closeCombat'
  | 'shadowPunch'
  // Abra line (D56)
  | 'confusion'
  | 'psychic'
  | 'expandingForce'
  | 'psybeam'
  | 'kinesis'
  | 'psychoCut'
  | 'reflect'
  | 'swift'
  | 'futureSight';

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
  /** Slow strength 0..1 applied on each tick (Sheer Cold's freezing field). */
  readonly slow?: number;
}

/** On-hit statuses built into a move (P4a). Not augments: they never proc anything else. */
export interface InnateEffects {
  /** Slow strength 0..1 for TUNING.status.slowSeconds. */
  readonly slow?: number;
  /** Stun (sleep / paralysis) seconds. */
  readonly stun?: number;
  /** What the stun is, for Mutations that care (Sweet Dreams, Shock Shatter); none = a flinch. */
  readonly stunKind?: StunKind;
  /** Poison damage per second as a fraction of the hit, for TUNING.status.poisonSeconds. */
  readonly poisonPct?: number;
  /** Innate push distance in px (adds to the Knockback augment). */
  readonly knockback?: number;
  /** Leech Seed: damage per second as a fraction of the hit, for TUNING.status.seedSeconds; heals the player. */
  readonly seedPct?: number;
  /** Blinded seconds per zone tick (Smokescreen, D20): enemies wander and hit softer; bosses immune. */
  readonly blind?: number;
  /** Confusion seconds per hit (D56), landing with `confuseChance` (default always). */
  readonly confuse?: number;
  readonly confuseChance?: number;
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
  /** Innate crit chance, added to the Crit augment (Slash). */
  readonly critChance?: number;
  readonly onHit?: InnateEffects;
  /** Rage Fist (D56): +this damage per point of Rage. */
  readonly ragePowerPerPoint?: number;
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
  /** Shadow Punch (D56): homes like the Homing augment. */
  readonly homing?: boolean;
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
  /** 'self': the zone drops on your position, cast while an enemy is within `range` (Smokescreen). */
  readonly target?: 'self';
  /** One instant hit on the target instead of a lingering zone (Slash's cut); duration is unused. */
  readonly instant?: boolean;
  /** Abra signature (D57): the target takes the full hit, everything else in the burst this fraction. */
  readonly splashFraction?: number;
  /** Expanding Force (D56): after the burst, a ring out to `radius` hits for `damageFraction`. */
  readonly ring?: ExplosionDef;
  /** Future Sight (D56): the burst lands this many seconds after it is marked. */
  readonly delay?: number;
  /** Reflect (D56): a barrier on you for `duration`: contact damage cut, enemy shots inside `radius` blocked. */
  readonly barrier?: { readonly contactCut: number };
}

/** Lingering patches a melee swing leaves along its line (Frenzy Plant's roots, D30). */
export interface FieldDef {
  readonly radius: number;
  readonly duration: number;
  readonly tickInterval: number;
  /** Damage per tick as a fraction of the swing's damage. */
  readonly damageFraction: number;
  readonly onTick?: InnateEffects;
  /** Patches spread evenly along the swing toward its target, the last one at the tip (default 1). */
  readonly count?: number;
}

/** The outer part of a lash hits harder (Bulbasaur's whips, D30). */
export interface TipDef {
  /** Outer fraction of the reach that counts as the tip. */
  readonly fraction: number;
  readonly damageMult: number;
}

/** Instant arc swipe toward the nearest enemy. */
export interface MeleeMoveDef extends MoveDefBase {
  readonly form: 'melee';
  /** px from the player's centre. */
  readonly reach: number;
  readonly arcDegrees: number;
  readonly field?: FieldDef;
  readonly tip?: TipDef;
  /** A burst at the end of the swing (Power Whip's crack, D30); splash as a fraction of the swing's damage. */
  readonly tipBurst?: ExplosionDef;
  /**
   * Arcs aimed relative to your facing (degrees; 90 = your left) instead of one arc at the
   * nearest enemy (Wing Attack's two wing beats). Cast while an enemy is within reach.
   */
  readonly sides?: readonly number[];
  /** Low Kick (D56): damage scales with the target's weight, ×minMult (0 kg) … ×maxMult (at maxKg or more). */
  readonly weightScaling?: { readonly minMult: number; readonly maxMult: number; readonly maxKg: number };
  /** Close Combat (D56): after a cast the player takes +pct damage for `seconds`. */
  readonly selfVuln?: { readonly seconds: number; readonly pct: number };
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
    explosion: { radius: 56, damageFraction: 0.6 }, // 45 → 56: its own horde clear (D48)
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
    pierce: 1, // D48: a bubble pops through the first enemy (its own horde clear; evolution keeps it)
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
    pierce: 1, // D48: a bubble pops through the first enemy (its own horde clear; evolution keeps it)
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
    pierce: 1, // D48: a bubble pops through the first enemy (its own horde clear; evolution keeps it)
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
  // D30: a narrow lash, not a circle. Its tip (outer 30%) hits hardest, so Bulbasaur plays at whip length.
  vineWhip: {
    id: 'vineWhip',
    name: 'Vine Whip',
    description: 'A long, narrow lash; the tip hits hardest',
    tags: ['Grass', 'Melee'],
    form: 'melee',
    cooldown: 1.0,
    damage: 13,
    reach: 120,
    arcDegrees: 30,
    tip: { fraction: 0.3, damageMult: 1.3 },
  },
  powerWhip: {
    id: 'powerWhip',
    name: 'Power Whip',
    description: 'A narrow lash whose tip cracks into a burst',
    tags: ['Grass', 'Melee', 'Area'],
    form: 'melee',
    cooldown: 1.1,
    damage: 17,
    reach: 130,
    arcDegrees: 30,
    tip: { fraction: 0.3, damageMult: 1.3 },
    tipBurst: { radius: 45, damageFraction: 0.6 },
  },
  frenzyPlant: {
    id: 'frenzyPlant',
    name: 'Frenzy Plant',
    description: 'A narrow lash that bursts at the tip and leaves roots along it',
    tags: ['Grass', 'Melee', 'Area', 'Zone'],
    form: 'melee',
    cooldown: 1.4,
    damage: 24,
    reach: 140,
    arcDegrees: 30,
    tip: { fraction: 0.3, damageMult: 1.3 },
    tipBurst: { radius: 55, damageFraction: 0.6 },
    field: { radius: 35, duration: 2.5, tickInterval: 0.5, damageFraction: 0.3, onTick: { slow: 0.4 }, count: 3 },
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
    onHit: { stun: 0.8, stunKind: 'sleep' },
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
  // Pikachu-line signature tiers (D13): chain is innate to these two only, ≤ 3 jumps.
  thunderShock: {
    id: 'thunderShock',
    name: 'Thunder Shock',
    description: 'A bolt that jumps to 2 more enemies',
    tags: ['Electric', 'Projectile'],
    form: 'projectile',
    cooldown: 0.9,
    damage: 9,
    range: 320,
    projectileSpeed: 480,
    projectileRadius: 5,
    projectileLifetime: 1.0,
    count: 1,
    chain: { jumps: 2, damageFraction: 0.7 },
  },
  thunderbolt: {
    id: 'thunderbolt',
    name: 'Thunderbolt',
    description: 'A crackling bolt that bursts and jumps to 3 more enemies',
    tags: ['Electric', 'Projectile', 'Area'],
    form: 'projectile',
    cooldown: 0.9,
    damage: 16,
    range: 340,
    projectileSpeed: 500,
    projectileRadius: 7,
    projectileLifetime: 1.0,
    count: 1,
    explosion: { radius: 35, damageFraction: 0.5 },
    chain: { jumps: 3, damageFraction: 0.65 }, // 0.8 → 0.65 (2026-10-23 balance pass, D19)
  },
  quickAttack: {
    id: 'quickAttack',
    name: 'Quick Attack',
    description: 'A very fast strike in front of you',
    tags: ['Normal', 'Melee', 'Contact'],
    form: 'melee',
    cooldown: 0.6,
    damage: 8,
    reach: 60,
    arcDegrees: 100,
  },
  spark: {
    id: 'spark',
    name: 'Spark',
    description: 'Charged sparks circle you and paralyse briefly',
    tags: ['Electric', 'Orbit', 'Contact'],
    form: 'orbit',
    cooldown: 4.5,
    damage: 8,
    count: 2,
    orbitRadius: 55,
    ballRadius: 9,
    angularSpeed: 5.5,
    duration: 3,
    hitInterval: 0.4,
    onHit: { stun: 0.2, stunKind: 'paralysis' },
  },
  electroBall: {
    id: 'electroBall',
    name: 'Electro Ball',
    description: 'A slow electric ball that rolls through enemies',
    tags: ['Electric', 'Projectile', 'Ball'],
    form: 'projectile',
    cooldown: 1.8,
    damage: 16,
    range: 340,
    projectileSpeed: 260,
    projectileRadius: 10,
    projectileLifetime: 1.6,
    count: 1,
    pierce: 2,
  },
  thunderWave: {
    id: 'thunderWave',
    name: 'Thunder Wave',
    description: 'A field that paralyses everything inside',
    tags: ['Electric', 'Zone'],
    form: 'zone',
    cooldown: 6,
    damage: 1,
    range: 300,
    radius: 60,
    duration: 2,
    tickInterval: 0.5,
    onHit: { stun: 0.6, stunKind: 'paralysis' },
  },
  ironTail: {
    id: 'ironTail',
    name: 'Iron Tail',
    description: 'A heavy steel tail swing',
    tags: ['Steel', 'Melee', 'Contact'],
    form: 'melee',
    cooldown: 2.2,
    damage: 24,
    reach: 80,
    arcDegrees: 180,
    onHit: { knockback: 15 },
  },
  // Raichu only (D14). The strike lands half a second after the cast.
  thunder: {
    id: 'thunder',
    name: 'Thunder',
    description: 'Raichu calls down a lightning strike that paralyses',
    tags: ['Electric', 'Zone'],
    form: 'zone',
    cooldown: 3.5,
    damage: 30,
    range: 340,
    radius: 45,
    duration: 0.55,
    tickInterval: 0.5,
    onHit: { stun: 0.5, stunKind: 'paralysis' },
  },
  // Lapras signature: one step by level (Lv 25, D18), smaller than an evolution.
  iceShard: {
    id: 'iceShard',
    name: 'Ice Shard',
    description: 'A fast shard of ice',
    tags: ['Ice', 'Projectile'],
    form: 'projectile',
    cooldown: 0.7,
    damage: 13,
    range: 320,
    projectileSpeed: 520,
    projectileRadius: 6,
    projectileLifetime: 0.9,
    count: 1,
    pierce: 2, // D48: a fast spike goes through (its own horde clear; Sheer Cold keeps it)
  },
  sheerCold: {
    id: 'sheerCold',
    name: 'Sheer Cold',
    description: 'An icy burst that leaves a freezing field',
    tags: ['Ice', 'Projectile', 'Area', 'Zone'],
    form: 'projectile',
    cooldown: 0.9,
    damage: 10.5, // D19: Lapras's late game below the 3-stage finals (was 12)
    range: 340,
    projectileSpeed: 460,
    projectileRadius: 9,
    projectileLifetime: 1.0,
    count: 1,
    pierce: 2, // D48: a fast spike goes through (its own horde clear; Sheer Cold keeps it)
    explosion: { radius: 55, damageFraction: 0.4 },
    crater: { radius: 55, duration: 2.5, tickInterval: 0.5, damageFraction: 0.2, slow: 0.5 },
    onHit: { slow: 0.35 },
  },
  bodySlam: {
    id: 'bodySlam',
    name: 'Body Slam',
    description: 'Lapras crushes what is in front, paralysing it briefly',
    tags: ['Normal', 'Melee', 'Contact'],
    form: 'melee',
    cooldown: 1.4,
    damage: 20,
    reach: 70,
    arcDegrees: 140,
    onHit: { stun: 0.25, stunKind: 'paralysis', knockback: 15 },
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
  // P4f-7 (docs/moveset/shared/*.md, base stats proposed there and approved with D15/D20/D21).
  smokescreen: {
    id: 'smokescreen',
    name: 'Smokescreen',
    description: 'A smoke cloud on you: enemies inside are Blinded',
    tags: ['Normal', 'Zone'],
    form: 'zone',
    cooldown: 8,
    damage: 0,
    // Provisional: cast once an enemy is this close.
    range: 150,
    radius: 90,
    duration: 4,
    tickInterval: 0.5,
    target: 'self',
    onHit: { blind: 1 },
  },
  slash: {
    id: 'slash',
    name: 'Slash',
    description: 'An instant X-cut on the nearest enemy; often crits',
    tags: ['Normal', 'Area', 'Slicing'],
    form: 'zone',
    cooldown: 1.6,
    damage: 18,
    range: 220,
    radius: 30,
    duration: 0,
    tickInterval: 0,
    instant: true,
    critChance: 0.25,
  },
  wingAttack: {
    id: 'wingAttack',
    name: 'Wing Attack',
    description: 'Both wings beat: gusts to your left and right',
    tags: ['Flying', 'Melee', 'Contact'],
    form: 'melee',
    cooldown: 1.4,
    damage: 13,
    reach: 75,
    arcDegrees: 100,
    sides: [90, -90],
    onHit: { knockback: 20 },
  },
  // Mankey line (D56, docs/moveset/mankey). Numbers provisional.
  karateChop: {
    id: 'karateChop',
    name: 'Karate Chop',
    description: 'A fast chop in front; often crits',
    tags: ['Fighting', 'Melee', 'Slicing'],
    form: 'melee',
    cooldown: 0.8,
    damage: 13,
    reach: 60,
    arcDegrees: 120,
    critChance: 0.2,
  },
  crossChop: {
    id: 'crossChop',
    name: 'Cross Chop',
    description: 'A crossing chop whose edge bursts into a shockwave',
    tags: ['Fighting', 'Melee', 'Slicing', 'Area'],
    form: 'melee',
    cooldown: 1.0,
    damage: 17,
    reach: 70,
    arcDegrees: 120,
    critChance: 0.2,
    tipBurst: { radius: 50, damageFraction: 0.6 },
  },
  rageFist: {
    id: 'rageFist',
    name: 'Rage Fist',
    description: 'A phantom fist that explodes; stronger the angrier you are',
    tags: ['Fighting', 'Melee', 'Slicing', 'Area', 'Ghost', 'Projectile', 'Punch'],
    form: 'projectile',
    cooldown: 1.1,
    damage: 22,
    range: 300,
    projectileSpeed: 420,
    projectileRadius: 9,
    projectileLifetime: 0.8,
    count: 1,
    explosion: { radius: 60, damageFraction: 0.7 },
    critChance: 0.2,
    ragePowerPerPoint: 0.004,
  },
  lowKick: {
    id: 'lowKick',
    name: 'Low Kick',
    description: 'A 360° sweep; heavier enemies take more',
    tags: ['Fighting', 'Melee', 'Contact'],
    form: 'melee',
    cooldown: 1.6,
    damage: 12,
    reach: 55,
    arcDegrees: 360,
    onHit: { knockback: 15 },
    weightScaling: { minMult: 0.8, maxMult: 1.5, maxKg: 100 },
  },
  vacuumWave: {
    id: 'vacuumWave',
    name: 'Vacuum Wave',
    description: 'A fast, short wave of air that pierces',
    tags: ['Fighting', 'Projectile'],
    form: 'projectile',
    cooldown: 1.2,
    damage: 9,
    range: 220,
    projectileSpeed: 600,
    projectileRadius: 7,
    projectileLifetime: 0.4,
    count: 1,
    pierce: 3,
  },
  seismicToss: {
    id: 'seismicToss',
    name: 'Seismic Toss',
    description: 'Slams down onto the nearest enemy',
    tags: ['Fighting', 'Zone'],
    form: 'zone',
    cooldown: 4,
    damage: 20,
    range: 250,
    radius: 60,
    duration: 0,
    tickInterval: 0,
    instant: true,
  },
  thrash: {
    id: 'thrash',
    name: 'Thrash',
    description: 'Flailing fists whirl around you',
    tags: ['Normal', 'Orbit', 'Contact'],
    form: 'orbit',
    cooldown: 5,
    damage: 9,
    count: 3,
    orbitRadius: 60,
    ballRadius: 10,
    angularSpeed: 5,
    duration: 3,
    hitInterval: 0.4,
    onHit: { knockback: 10 },
  },
  closeCombat: {
    id: 'closeCombat',
    name: 'Close Combat',
    description: 'A heavy flurry; your guard drops for a moment after',
    tags: ['Fighting', 'Melee', 'Contact', 'Punch'],
    form: 'melee',
    cooldown: 2.5,
    damage: 30,
    reach: 75,
    arcDegrees: 150,
    selfVuln: { seconds: 2, pct: 0.15 },
  },
  shadowPunch: {
    id: 'shadowPunch',
    name: 'Shadow Punch',
    description: 'A homing shadow fist that never misses',
    tags: ['Ghost', 'Projectile', 'Punch'],
    form: 'projectile',
    cooldown: 1.4,
    damage: 18,
    range: 340,
    projectileSpeed: 380,
    projectileRadius: 8,
    projectileLifetime: 1.4,
    count: 1,
    homing: true,
  },
  // Abra line (D56, docs/moveset/abra). Numbers provisional.
  confusion: {
    id: 'confusion',
    name: 'Confusion',
    description: 'An instant mind-burst on the nearest enemy that Confuses it',
    tags: ['Psychic', 'Zone'],
    form: 'zone',
    cooldown: 0.9,
    damage: 11,
    range: 300,
    radius: 35,
    splashFraction: 0.6, // D57
    duration: 0,
    tickInterval: 0,
    instant: true,
    onHit: { confuse: 0.5, confuseChance: 0.35 }, // D57: was every hit
  },
  psychic: {
    id: 'psychic',
    name: 'Psychic',
    description: 'A wider mind-burst that Confuses',
    tags: ['Psychic', 'Zone', 'Area'],
    form: 'zone',
    cooldown: 1.0,
    damage: 15,
    range: 320,
    radius: 50,
    splashFraction: 0.6, // D57
    duration: 0,
    tickInterval: 0,
    instant: true,
    onHit: { confuse: 0.5, confuseChance: 0.35 }, // D57: was every hit
  },
  expandingForce: {
    id: 'expandingForce',
    name: 'Expanding Force',
    description: 'A mind-burst, then a ring that expands from it',
    tags: ['Psychic', 'Zone', 'Area', 'Pulse'],
    form: 'zone',
    cooldown: 1.1,
    damage: 20,
    range: 340,
    radius: 55,
    splashFraction: 0.6, // D57
    duration: 0,
    tickInterval: 0,
    instant: true,
    ring: { radius: 100, damageFraction: 0.35 }, // D57: 140 px / 50%
    onHit: { confuse: 0.5, confuseChance: 0.35 }, // D57: was every hit
  },
  psybeam: {
    id: 'psybeam',
    name: 'Psybeam',
    description: 'A psychic beam that may Confuse',
    tags: ['Psychic', 'Beam'],
    form: 'beam',
    cooldown: 2.6,
    damage: 7,
    range: 300,
    length: 280,
    width: 14,
    duration: 0.6,
    tickInterval: 0.2,
    onHit: { confuse: 0.5, confuseChance: 0.2 },
  },
  kinesis: {
    id: 'kinesis',
    name: 'Kinesis',
    description: 'Bent spoons orbit you',
    tags: ['Psychic', 'Orbit'],
    form: 'orbit',
    cooldown: 5,
    damage: 9,
    count: 3,
    orbitRadius: 70,
    ballRadius: 8,
    angularSpeed: 4.5,
    duration: 3.5,
    hitInterval: 0.4,
  },
  psychoCut: {
    id: 'psychoCut',
    name: 'Psycho Cut',
    description: 'A psychic spoon slash',
    tags: ['Psychic', 'Melee', 'Slicing'],
    form: 'melee',
    cooldown: 1.1,
    damage: 14,
    reach: 70,
    arcDegrees: 110,
    critChance: 0.15,
  },
  reflect: {
    id: 'reflect',
    name: 'Reflect',
    description: 'A barrier on you: less contact damage, enemy shots blocked',
    tags: ['Psychic', 'Zone'],
    form: 'zone',
    cooldown: 9,
    damage: 0,
    // Provisional: cast once an enemy is this close.
    range: 150,
    radius: 70,
    duration: 4,
    tickInterval: 0,
    target: 'self',
    barrier: { contactCut: 0.4 },
  },
  swift: {
    id: 'swift',
    name: 'Swift',
    description: 'Homing stars',
    tags: ['Normal', 'Projectile'],
    form: 'projectile',
    cooldown: 1.3,
    damage: 7,
    range: 320,
    projectileSpeed: 420,
    projectileRadius: 6,
    projectileLifetime: 1.2,
    count: 3,
    homing: true,
  },
  futureSight: {
    id: 'futureSight',
    name: 'Future Sight',
    description: 'Marks an area that explodes 2 s later',
    tags: ['Psychic', 'Zone', 'Area'],
    form: 'zone',
    cooldown: 4,
    damage: 45,
    range: 340,
    radius: 70,
    duration: 0,
    tickInterval: 0,
    delay: 2,
  },
};
