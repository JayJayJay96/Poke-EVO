import type { EnemyId } from './content';

// Spawn pacing, horde events and Elites (D34; docs/enemies/README.md §7–§8, ROSTER.md). Every number provisional.

/**
 * Pressure cycle on the run clock (owner 2026-10-23: "test the 10 s lull first"): a build-up, a short surge, then a
 * lull. The average spawn rate stays about the same as before, so difficulty doesn't drop; it comes in waves.
 */
export const PACING = {
  cycle: 45,
  /** Seconds into each cycle where the surge starts and where the lull starts (it lasts until the cycle ends). */
  surgeAt: 30,
  lullAt: 35,
  surgeRate: 2,
  lullRate: 0.35,
  /** Outside surges enemies come in packs from one side (lanes stay open); in a surge they come from everywhere. */
  pack: { min: 3, max: 8, arcDeg: 60 },
} as const;

/** The Elite variant (README §7, owner-approved): any species, its ability switched on. */
export const ELITE = { hpMult: 6, contactMult: 1.3, xpMult: 6, radiusMult: 1.35, staggerMult: 0.5, berryChance: 0.5 } as const;

/**
 * Horde events (README §8): a warning, then an Elite leading a pack of its own species line. When the leader falls
 * the pack flees until `fleeDistance` px away, then turns and fights again (owner 2026-10-23), and a lull follows.
 */
export const HORDE = {
  firstAt: 90,
  every: 90,
  warning: 3,
  followers: { base: 6, perMinute: 0.6, max: 14 },
  /** px around the leader the followers spawn in. */
  spread: 70,
  fleeDistance: 450,
  lullAfterLeader: 8,
} as const;

/** Who follows an Elite of each species: its own line (owner, D27). Healers never lead or follow (none yet). */
export const HORDE_FOLLOWERS: Readonly<Partial<Record<EnemyId, readonly EnemyId[]>>> = {
  rattata: ['rattata'],
  raticate: ['raticate', 'rattata'],
  pidgey: ['pidgey'],
  spearow: ['spearow'],
  fearow: ['fearow', 'spearow'],
  tauros: ['tauros'],
  // Batch 2 (D37). Chansey is a healer: never in a horde (owner 2026-10-21).
  caterpie: ['caterpie'],
  weedle: ['weedle'],
  zubat: ['zubat'],
  oddish: ['oddish'],
  psyduck: ['psyduck'],
  geodude: ['geodude'],
  gastly: ['gastly'],
  abra: ['abra'],
  voltorb: ['voltorb'],
};

/** Each species' ability, switched on only for its Elite (ROSTER.md, owner-approved). */
export type EliteAbility =
  | 'runAway'
  | 'tangledFeet'
  | 'sniper'
  | 'guts'
  | 'keenEye'
  | 'angerPoint'
  | 'shieldDust'
  | 'infiltrator'
  | 'swiftSwim'
  | 'sturdy'
  | 'levitate'
  | 'synchronize'
  | 'aftermath'
  | 'healer';

export const ELITE_ABILITY: Readonly<Partial<Record<EnemyId, EliteAbility>>> = {
  rattata: 'runAway',
  pidgey: 'tangledFeet',
  spearow: 'sniper',
  raticate: 'guts',
  fearow: 'keenEye',
  tauros: 'angerPoint',
  // Batch 2 (ROSTER.md, owner-approved 2026-10-21; D37).
  caterpie: 'shieldDust',
  weedle: 'runAway',
  zubat: 'infiltrator',
  oddish: 'runAway',
  psyduck: 'swiftSwim',
  geodude: 'sturdy',
  gastly: 'levitate',
  abra: 'synchronize',
  voltorb: 'aftermath',
  chansey: 'healer',
};

export const ELITE_ABILITY_NAMES: Readonly<Record<EliteAbility, string>> = {
  runAway: 'Run Away',
  tangledFeet: 'Tangled Feet',
  sniper: 'Sniper',
  guts: 'Guts',
  keenEye: 'Keen Eye',
  angerPoint: 'Anger Point',
  shieldDust: 'Shield Dust',
  infiltrator: 'Infiltrator',
  swiftSwim: 'Swift Swim',
  sturdy: 'Sturdy',
  levitate: 'Levitate',
  synchronize: 'Synchronize',
  aftermath: 'Aftermath',
  healer: 'Healer',
};

export const ABILITY_TUNING = {
  /** The first time it drops below `belowPct` HP it sprints away at ×`speedMult` for `seconds`, then turns back. */
  runAway: { belowPct: 0.3, speedMult: 1.5, seconds: 3 },
  /** While slowed or trapped it takes ×`damageTakenMult` hit damage. */
  tangledFeet: { damageTakenMult: 0.7 },
  /** Its contact hits on a player below `belowPct` HP deal ×`contactMult`. */
  sniper: { belowPct: 0.5, contactMult: 1.5 },
  /** While burned, poisoned or paralysed it deals ×`contactMult` contact damage. */
  guts: { contactMult: 1.5 },
  /** Blinded lasts ×`blindMult` on it. */
  keenEye: { blindMult: 0.25 },
  /** A critical hit on it enrages it: ×`contactMult` contact damage for `seconds`. */
  angerPoint: { contactMult: 1.5, seconds: 4 },
  /** Statuses that come from a damaging hit land at ×`statusMult` (status moves and zones land normally). */
  shieldDust: { statusMult: 0.25 },
  /** ×`speedMult` while standing in a Puddle (puddles stand in for rain). */
  swiftSwim: { speedMult: 1.5 },
  /** Killed, it leaves a ring for `delay` s, then explodes (`radius` px, ×`damageFactor` contact). */
  aftermath: { delay: 0.6, radius: 70, damageFactor: 2 },
} as const;
