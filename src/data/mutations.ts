import type { AugmentId } from './augments';
import type { AbilityId, PokemonId } from './content';
import type { MoveId } from './moves';

// Mutations: move-specific rule changers (docs/moveset/, owner decisions D15–D21).
// IDs, kinds, lines, stages and hooks mirror docs/moveset/INDEX.md exactly; a unit test keeps
// them in sync. Every tuning number lives here; sim hook functions read `values` and hold none.
// All numbers provisional. Mutations come only from map sites (D16), never from augment levels.

export type MutationKind = 'generic' | 'bond' | 'signature';

/** Sim events and state that Bond hooks read (INDEX.md "Hook vocabulary"). */
export const HOOK_IDS = [
  'shellReady',
  'shellBlock',
  'shellRecharge',
  'shellBurst',
  'hitTaken',
  'hpBelow',
  'missingHp',
  'fullHp',
  'healing',
  'blazeActive',
  'flareUp',
  'moving',
  'standingStill',
  'kill',
  'inOwnSmoke',
  'targetBurning',
  'targetAsleep',
  'ownScorch',
  'bulbFill',
  'bloom',
  'leechStrength',
  'chargeLevel',
  'chargeFull',
  'staticProc',
  'moveSpeed',
  'chainJump',
  'targetParalysed',
  'discharge',
  'levelUp',
  'levelBelow',
  'xpGem',
  'armorAbsorb',
] as const;
export type HookId = (typeof HOOK_IDS)[number];

export const REQUIREMENT_IDS = ['scorchSource'] as const;
export type RequirementId = (typeof REQUIREMENT_IDS)[number];

type Value = number | boolean;
export type MutationValues = { readonly [key: string]: Value | { readonly [key: string]: Value } };

export interface MutationDef {
  readonly name: string;
  /** One line for cards and the build panel. */
  readonly text: string;
  readonly kind: MutationKind;
  /** Signature: the line's FIRST signature move; the Mutation keeps its ID as the move evolves. */
  readonly move: MoveId;
  /** Bond and signature only. */
  readonly line?: PokemonId;
  /** Earliest stage index it can be offered at (0 = first form). */
  readonly fromStage: 0 | 1 | 2;
  readonly hook?: HookId;
  readonly requires?: readonly RequirementId[];
  readonly pool: 'site';
  /** Lapras Bonds: Flood values before `MUTATION_TUNING.tideLevel`, Ebb values from it (D18). */
  readonly tide?: { readonly flood: MutationValues; readonly ebb: MutationValues };
  /** Every tuning number. Signature Mutations nest per-tier additions under `tier1` / `tier2`. */
  readonly values: MutationValues;
  /** Augments this Mutation's move can no longer take (Undertow: Return). */
  readonly excludesAugments?: readonly AugmentId[];
  /**
   * Rank II and III (D24, docs/moveset/RANKS.md): overrides of top-level `values`, absolute.
   * Rank III applies on top of rank II. Every key must already exist at rank I (twists start "off").
   */
  readonly ranks?: readonly [MutationValues, MutationValues];
  /** Card text for rank II and III (the RANKS.md cells); present exactly when `ranks` is. */
  readonly rankText?: readonly [string, string];
}

/**
 * Mutation ranks (D24): a Mutation sits in its own slot and ranks I → III at sites.
 * Until P4h-3…7 give every Mutation its own rank values, a rank scales the move's damage
 * (provisional placeholder: rank II ≈ +15%, rank III ≈ +30% over rank I).
 */
export const MUTATION_RANKS = {
  max: 3,
  placeholderDamageMult: [1, 1.15, 1.3],
} as const;

/** Shared terrain, crowd-control guard rails and the Tide (docs/moveset/README.md). */
export const MUTATION_TUNING = {
  puddle: { radius: 35, seconds: 4, maxAlive: 6 },
  /** Soaked: −25% move speed, +50% stagger taken (after weight resistance). */
  soaked: { seconds: 2, speedMult: 0.75, staggerTakenMult: 1.5 },
  /** Scorch burns enemies standing in it for 20% of the hit that made it, per second. */
  scorch: { radius: 35, seconds: 3, maxAlive: 6, burnFraction: 0.2 },
  /** Applies to new effects only (D21): Mutations, Shell Burst, Flare Up, Discharge… */
  stunFatigueSeconds: 1.5,
  slowCap: 0.7,
  /** Traps, slips and drags only work on lighter enemies; heavier ones get this slow instead. */
  trapMaxWeightKg: 40,
  trapFallbackSlow: 0.3,
  bossStaggerMult: 0.5,
  /** Lapras Bonds switch from Flood to Ebb at this level (D18). */
  tideLevel: 30,
} as const;

const generic = <const V extends MutationValues>(
  move: MoveId,
  name: string,
  text: string,
  values: V,
) => ({ name, text, kind: 'generic', move, fromStage: 0, pool: 'site', values }) as const;

const bond = <const V extends MutationValues>(
  move: MoveId,
  line: PokemonId,
  fromStage: 0 | 1 | 2,
  hook: HookId,
  name: string,
  text: string,
  values: V,
) => ({ name, text, kind: 'bond', move, line, fromStage, hook, pool: 'site', values }) as const;

const signature = <const V extends MutationValues>(
  move: MoveId,
  line: PokemonId,
  hook: HookId | undefined,
  name: string,
  text: string,
  values: V,
) => ({ name, text, kind: 'signature', move, line, fromStage: 0, hook, pool: 'site', values }) as const;

export const MUTATIONS = {
  // ── Squirtle line moves ────────────────────────────────────────────────
  'withdraw.spikedShell': {
    ...generic('withdraw', 'Spiked Shell', 'A 3 s contact-damage aura', {
      auraSeconds: 3,
      tickInterval: 0.5,
      /** P4f-3 rule-4 tuning: 7 ticks per cast, so each tick is a fraction of a bash. */
      tickDamageFraction: 0.28,
      moveSpeedMult: 0.8,
      cooldownMult: 1.6,
    }),
    ranks: [{ tickDamageFraction: 0.32 }, { tickDamageFraction: 0.3, auraSeconds: 4 }],
    rankText: ['aura ticks 0.32 (0.28)', 'ticks 0.3; ★ aura lasts 4 s (3)'],
  },
  'withdraw.hunkerDown': {
    ...generic('withdraw', 'Hunker Down', '−40% damage taken for 1.5 s after a cast', {
      buffSeconds: 1.5,
      damageTakenMult: 0.6,
      moveSpeedMult: 0.5,
      damageMult: 0.8,
      hitStagger: 0,
    }),
    ranks: [{ damageMult: 0.92, buffSeconds: 1.75 }, { damageMult: 1.04, buffSeconds: 2, hitStagger: 15 }],
    rankText: ['dmg ×0.92 (0.8); buff 1.75 s (1.5)', 'dmg ×1.04; buff 2 s; ★ hits taken while hunkered stagger the attacker 15 px'],
  },
  'withdraw.counterShell': {
    ...bond('withdraw', 'squirtle', 0, 'shellBlock', 'Counter Shell', 'Shell blocks reset Withdraw; stagger ×2', {
      staggerMult: 2,
      damageMult: 0.8,
      resetHitMult: 1,
    }),
    ranks: [{ damageMult: 0.92 }, { damageMult: 1.04, resetHitMult: 1.5 }],
    rankText: ['dmg ×0.92 (0.8)', 'dmg ×1.04; ★ the reset Withdraw hits +50%'],
  },
  'rapidSpin.spiralSpin': {
    ...generic('rapidSpin', 'Spiral Spin', 'Shells spiral out from 30 to 120 px', {
      innerRadius: 30,
      outerRadius: 120,
      damageMult: 0.9, // P4f-6 rule-4 tuning (doc: 0.85, 0.84x)
    }),
    ranks: [{ damageMult: 1.03 }, { damageMult: 1.17, outerRadius: 140 }],
    rankText: ['dmg ×1.03 (0.9)', 'dmg ×1.17; ★ spirals out to 140 px (120)'],
  },
  'rapidSpin.deflector': {
    ...generic('rapidSpin', 'Deflector', 'Shells eat enemy projectiles', {
      secondsPerDeflect: 0.3,
      damageMult: 0.7,
    }),
    ranks: [{ damageMult: 0.8 }, { damageMult: 0.91, secondsPerDeflect: 0.2 }],
    rankText: ['dmg ×0.8 (0.7)', 'dmg ×0.91; deflect window 0.2 s (0.3)'],
  },
  'rapidSpin.shellSpin': {
    ...bond('rapidSpin', 'squirtle', 0, 'shellRecharge', 'Shell Spin', 'Shell hits cut Shell recharge', {
      rechargeCutPerHit: 0.25,
      maxCutPerCast: 1.5,
      damageMult: 0.8,
    }),
    ranks: [{ rechargeCutPerHit: 0.3, damageMult: 0.92 }, { rechargeCutPerHit: 0.35, maxCutPerCast: 2, damageMult: 1.04 }],
    rankText: ['cut 0.3 s per hit (0.25); dmg ×0.92 (0.8)', 'cut 0.35 s; max 2 s per cast (1.5); dmg ×1.04'],
  },
  'waterGun.slick': {
    ...generic('waterGun', 'Slick', 'Leaves a puddle line; light enemies slip', {
      puddleSeconds: 3,
      slipChancePerSec: 0.15,
      slipStun: 0.6,
      damageMult: 0.7,
    }),
    ranks: [{ damageMult: 0.8, slipChancePerSec: 0.2 }, { damageMult: 0.91, slipChancePerSec: 0.25, puddleSeconds: 4.5 }],
    rankText: ['dmg ×0.8 (0.7); slip 0.2/s (0.15)', 'dmg ×0.91; slip 0.25/s; ★ puddles last 4.5 s (3)'],
  },
  'waterGun.washDown': {
    ...generic('waterGun', 'Wash Down', 'Soaks; +20% Water damage taken', {
      debuffSeconds: 3,
      waterDamageTakenPct: 0.2,
      damageMult: 0.5,
      pushMult: 0,
      otherDamageTakenPct: 0,
    }),
    ranks: [{ waterDamageTakenPct: 0.25, damageMult: 0.55 }, { waterDamageTakenPct: 0.3, damageMult: 0.55, otherDamageTakenPct: 0.1 }],
    rankText: ['Water taken +25% (20%); dmg ×0.55 (0.5)', '+30%; dmg ×0.55; ★ also +10% from every other type'],
  },
  'waterGun.steadyAim': {
    ...bond('waterGun', 'squirtle', 0, 'shellReady', 'Steady Aim', 'Shell up: longer beam, push ×2', {
      lengthMult: 1.4,
      pushMult: 2,
      damageMultShellDown: 0.75,
      shellUpDamageMult: 1,
    }),
    ranks: [{ lengthMult: 1.5, damageMultShellDown: 0.85, shellUpDamageMult: 1.1 }, { lengthMult: 1.6, damageMultShellDown: 0.95, shellUpDamageMult: 1.2 }],
    rankText: ['length ×1.5 (1.4); Shell down ×0.85 (0.75); Shell up +10% damage', 'length ×1.6; Shell down ×0.95; ★ Shell up: +20% damage'],
  },
  'whirlpool.maelstrom': {
    ...generic('whirlpool', 'Maelstrom', 'Pulls in, then collapses into a burst', {
      pullSpeed: 30,
      collapseTickMult: 1.6, // P4f-6 rule-4 tuning (doc: 3, 1.33x)
      perEnemyPct: 0.15,
      maxEnemies: 10,
      cooldownMult: 1.4,
    }),
    ranks: [{ collapseTickMult: 1.85, cooldownMult: 1.25 }, { collapseTickMult: 2.1, cooldownMult: 1.15, pullSpeed: 45 }],
    rankText: ['collapse ×1.85 (1.6); cooldown ×1.25 (1.4)', 'collapse ×2.1; cooldown ×1.15; ★ pull 45 px/s (30)'],
  },
  'whirlpool.moat': {
    ...generic('whirlpool', 'Moat', 'A slowing ring that follows you', {
      innerRadius: 40,
      outerRadius: 90,
      slow: 0.7,
      damageMult: 0.5, // P4f-6 rule-4 tuning (doc: 0.6, 1.17x)
      soaksCrossers: false,
    }),
    ranks: [{ damageMult: 0.58 }, { damageMult: 0.65, soaksCrossers: true }],
    rankText: ['dmg ×0.58 (0.5)', 'dmg ×0.65; ★ enemies crossing the ring are Soaked'],
  },
  'whirlpool.eyeOfTheStorm': {
    ...bond('whirlpool', 'squirtle', 1, 'shellBurst', 'Eye of the Storm', 'Shell Burst drops a whirlpool at your feet', {
      sizeMult: 0.5,
      seconds: 2,
      cooldownMult: 1.3,
      pullSpeed: 0,
    }),
    ranks: [{ sizeMult: 0.6, seconds: 2.5 }, { sizeMult: 0.7, seconds: 3, pullSpeed: 30 }],
    rankText: ['size ×0.6 (0.5); 2.5 s (2)', 'size ×0.7; 3 s; ★ it pulls like Maelstrom (30 px/s)'],
  },
  'surf.rideTheWave': {
    ...generic('surf', 'Ride the Wave', 'A wall rolling the way you move', {
      wallLength: 250,
      moveSpeedPct: 0.3,
      speedSeconds: 1,
      // P4f-6 build values: how fast and far the wall rolls, and how far it carries light enemies.
      waveSpeed: 300,
      travel: 220,
      carryPx: 40,
      wallThickness: 24,
      waveDamageMult: 1,
    }),
    ranks: [{ waveDamageMult: 1.15, travel: 250 }, { waveDamageMult: 1.3, speedSeconds: 2 }],
    rankText: ['wave dmg ×1.15; travel 250 px (220)', 'wave dmg ×1.3; ★ speed boost 2 s (1)'],
  },
  'surf.backwash': {
    ...generic('surf', 'Backwash', 'The wave rolls back in and pulls', {
      returnDamageFraction: 0.3, // P4f-6 rule-4 tuning (doc: 0.5, 1.30x)
      pullPx: 20,
      cooldownMult: 1.3,
      /** P4f-6 build value: seconds until the wave rolls back in. */
      returnDelay: 0.3,
      returnSoaks: false,
    }),
    ranks: [{ returnDamageFraction: 0.5 }, { returnDamageFraction: 0.7, returnSoaks: true }],
    rankText: ['return 50% (30%)', 'return 70%; ★ the return wave Soaks'],
  },
  'surf.lastWave': {
    ...bond('surf', 'squirtle', 0, 'hpBelow', 'Last Wave', 'Below 40% HP: faster, bigger Surf', {
      hpThreshold: 0.4,
      cooldownMult: 0.5,
      radiusMult: 1.3,
      damageMultAbove: 0.8,
    }),
    ranks: [{ damageMultAbove: 0.9, hpThreshold: 0.5 }, { damageMultAbove: 1, hpThreshold: 0.6 }],
    rankText: ['above-threshold dmg ×0.9 (0.8); threshold 50% HP (40%)', '×1.0; threshold 60%'],
  },
  'hydroPump.splitStream': {
    ...generic('hydroPump', 'Split Stream', 'Two beams at ±30°', {
      angleDeg: 30,
      beamDamageFraction: 0.33, // P4f-6 rule-4 tuning (doc: 0.6; two beams cover twice the crowd, 2.09x)
    }),
    ranks: [{ beamDamageFraction: 0.38 }, { beamDamageFraction: 0.43 }],
    rankText: ['38% per beam (33%)', '43% per beam'],
  },
  'hydroPump.pressureBuild': {
    ...generic('hydroPump', 'Pressure Build', 'Damage ramps each tick', {
      rampPerTick: 0.12, // P4f-6 rule-4 tuning (doc: 0.25, 1.34x)
      durationMult: 1.5,
      cooldownMult: 1.5,
    }),
    ranks: [{ rampPerTick: 0.15, cooldownMult: 1.35 }, { rampPerTick: 0.2, cooldownMult: 1.3 }],
    rankText: ['ramp +15% per tick (12%); cooldown ×1.35 (1.5)', 'ramp +20%; ★ cooldown ×1.3'],
  },
  'hydroPump.rainCannon': {
    ...bond('hydroPump', 'squirtle', 2, 'healing', 'Rain Cannon', 'Rains around you; heals per enemy hit', {
      radius: 130,
      healPerEnemy: 1,
      maxHealPerSec: 4,
      damageMult: 0.1, // P4f-6 rule-4 tuning (doc: 0.7; a 130 px rain every tick instead of one beam line, 7.3x)
      pushMult: 0,
      rainSoaks: false,
    }),
    ranks: [{ damageMult: 0.115, maxHealPerSec: 5 }, { damageMult: 0.13, maxHealPerSec: 6, rainSoaks: true }],
    rankText: ['dmg ×0.115 (0.1); heal cap 5/s (4)', 'dmg ×0.13; cap 6/s; ★ the rain Soaks'],
  },
  'flashCannon.shrapnel': {
    ...generic('flashCannon', 'Shrapnel', 'Shatters into 6 shards', {
      shards: 6,
      shardDamageFraction: 0.35,
      cooldownMult: 1.3,
      // P4f-6 build values: shard flight.
      shardSpeed: 400,
      shardRange: 120,
      shardRadius: 5,
      shardPierce: 0,
    }),
    ranks: [{ shardDamageFraction: 0.4, cooldownMult: 1.15 }, { shardDamageFraction: 0.45, cooldownMult: 1, shardPierce: 1 }],
    rankText: ['shards 40% (35%); cooldown ×1.15 (1.3)', '45%; cooldown ×1.0; ★ shards pierce 1'],
  },
  'flashCannon.railgun': {
    ...generic('flashCannon', 'Railgun', 'Fires where you move; infinite pierce', {
      speedMult: 1.8,
      damageMult: 1.3,
    }),
    ranks: [{ damageMult: 1.5 }, { damageMult: 1.7 }],
    rankText: ['dmg ×1.5 (1.3)', 'dmg ×1.7'],
  },
  'flashCannon.armorRounds': {
    ...bond('flashCannon', 'squirtle', 2, 'hitTaken', 'Armor Rounds', 'Hit since last shot: a second round', {
      secondRoundFraction: 0.6,
      damageMult: 0.8,
    }),
    ranks: [{ secondRoundFraction: 0.7, damageMult: 0.92 }, { secondRoundFraction: 0.8, damageMult: 1.04 }],
    rankText: ['second round 70% (60%); dmg ×0.92 (0.8)', '80%; dmg ×1.04'],
  },
  'bubble.trap': {
    ...signature('bubble', 'squirtle', undefined, 'Bubble Trap', 'Traps a light enemy, then pops', {
      floatSeconds: 1.2,
      popRadius: 40,
      /** P4f-5 rule-4 tuning: the pop splashes a crowd, so it deals less than the full hit. */
      popDamageFraction: 0.8,
      popStagger: 20,
      cooldownMult: 1.3,
      tier1: { pullRadius: 60, pullPx: 15 },
      tier2: { maxTrapped: 3, leavesPuddle: true },
      popSoaks: false,
    }),
    ranks: [{ popDamageFraction: 1 }, { popDamageFraction: 1.2, popSoaks: true }],
    rankText: ['pop 100% (80%)', 'pop 120%; ★ the pop Soaks'],
  },
  'bubble.froth': {
    ...signature('bubble', 'squirtle', undefined, 'Froth Mines', 'Shots leave hovering bubble mines', {
      minesPerShot: 3,
      mineSeconds: 3,
      mineDamageFraction: 0.25, // P4f-5 rule-4 tuning (doc: 0.5, measured 1.52× Power Up I)
      maxMines: 9,
      damageMult: 0.7,
      // P4f-5 build values (not in the doc): mine size, stagger ring, drift search range.
      mineRadius: 9,
      mineRingRadius: 30,
      driftRange: 200,
      tier1: { mineStagger: 10 },
      tier2: { driftSpeed: 40 },
    }),
    ranks: [{ mineDamageFraction: 0.33 }, { mineDamageFraction: 0.4, maxMines: 12 }],
    rankText: ['mines 33% (25%)', '40%; ★ up to 12 mines (9)'],
  },
  'bubble.undertow': {
    ...signature('bubble', 'squirtle', undefined, 'Undertow', 'Bubbles return to you, hitting twice', {
      damageMult: 0.65, // P4f-5 rule-4 tuning (doc: 0.75; both legs hit, 1.25×)
      rangeMult: 0.8,
      tier1: { dragPx: 25 },
      tier2: { soaks: true, puddleEvery: 0.2 },
    }),
    excludesAugments: ['boomerang'],
    ranks: [{ damageMult: 0.75 }, { damageMult: 0.88, rangeMult: 0.9 }],
    rankText: ['dmg ×0.75 (0.65)', 'dmg ×0.88; ★ range ×0.9 (0.8)'],
  },

  // ── Charmander line moves ──────────────────────────────────────────────
  'scratch.furySwipes': {
    ...generic('scratch', 'Fury Swipes', 'Stacks damage on one target', {
      stackWindow: 2,
      stackPct: 0.08, // P4f-6 rule-4 tuning (doc: 0.15, 1.36x)
      maxStacks: 5,
      arcMult: 0.6,
    }),
    ranks: [{ stackPct: 0.135 }, { stackPct: 0.16, maxStacks: 6 }],
    rankText: ['+13.5% per stack (8%)', '+16%; ★ up to 6 stacks (5)'],
  },
  'scratch.crescent': {
    ...generic('scratch', 'Crescent', '200° arc plus a slash wave', {
      arcDeg: 200,
      /** P4f-6 rule-4 tuning: the doc gave Crescent no damage cost; 200° plus the wave measured 2.46x. */
      damageMult: 0.45,
      waveLength: 70,
      waveDamageFraction: 0.4,
      /** P4f-6 build value: the slash wave's width. */
      waveWidth: 30,
      reachMult: 0.8,
      cooldownMult: 1.2,
    }),
    ranks: [{ damageMult: 0.52, waveDamageFraction: 0.45 }, { damageMult: 0.58, waveDamageFraction: 0.5, waveLength: 100 }],
    rankText: ['dmg ×0.52 (0.45); wave 45% (40%)', '×0.58; wave 50%; ★ wave travels 100 px (70)'],
  },
  'scratch.blazeClaws': {
    ...bond('scratch', 'charmander', 0, 'blazeActive', 'Blaze Claws', 'Blaze active: Fire-type, burns, longer reach', {
      burnPct: 0.3,
      reachMult: 1.3,
      damageMultOff: 0.85,
    }),
    ranks: [{ burnPct: 0.4, damageMultOff: 0.95 }, { burnPct: 0.5, damageMultOff: 1.05, reachMult: 1.4 }],
    rankText: ['burn 40% (30%); off ×0.95 (0.85)', 'burn 50%; off ×1.05; ★ reach ×1.4 (1.3)'],
  },
  'fireSpin.vortex': {
    ...generic('fireSpin', 'Vortex', 'Collapses, then bursts out', {
      burstRadius: 110,
      burstDamageMult: 1.6, // P4f-6 rule-4 tuning (doc: 2, 1.20x)
      cooldownMult: 1.2,
    }),
    ranks: [{ burstDamageMult: 2 }, { burstDamageMult: 2.1, burstRadius: 130 }],
    rankText: ['burst ×2.0 (1.6)', '×2.1; ★ burst radius 130 px (110)'],
  },
  'fireSpin.flameTrail': {
    ...generic('fireSpin', 'Flame Trail', 'Flames leave Scorch', {
      scorchEvery: 0.6,
      damageMult: 0.7,
    }),
    ranks: [{ damageMult: 0.8, scorchEvery: 0.5 }, { damageMult: 0.9, scorchEvery: 0.4 }],
    rankText: ['dmg ×0.8 (0.7); Scorch every 0.5 s (0.6)', '×0.9; every 0.4 s'],
  },
  'fireSpin.tailFlame': {
    ...bond('fireSpin', 'charmander', 0, 'missingHp', 'Tail Flame', 'More flames as HP drops', {
      hpOneFlame: 0.7,
      hpTwoFlames: 0.4,
      burnPct: 0.2,
      damageMult: 0.75,
    }),
    ranks: [{ damageMult: 0.86 }, { damageMult: 0.97, hpOneFlame: 0.8, hpTwoFlames: 0.5 }],
    rankText: ['dmg ×0.86 (0.75)', '×0.97; ★ flames at 80% / 50% HP (70% / 40%)'],
  },
  'dragonRage.fixedRage': {
    ...generic('dragonRage', 'Fixed Rage', 'Fixed damage; ignores types and damage augments', {
      fixedDamage: 7, // P4f-6 rule-4 tuning (doc: 10, 1.45x at Lv 1; it ignores every boost, so it falls off later)
      levelsPerPoint: 4,
    }),
    ranks: [{ fixedDamage: 8 }, { fixedDamage: 9, levelsPerPoint: 3 }],
    rankText: ['fixed 8 (7)', 'fixed 9; ★ +1 per 3 levels (4)'],
  },
  'dragonRage.dragonBreath': {
    ...generic('dragonRage', 'Dragon Breath', 'Short cone; paralysis chance', {
      coneDeg: 60,
      coneLength: 140,
      /** P4f-6 rule-4 tuning: the doc gave no damage cost; the cone covers far more than the beam (1.74x). */
      damageMult: 0.6,
      paralyseChance: 0.1,
      paralyseSeconds: 0.5,
      rangeMult: 0.55,
    }),
    ranks: [{ damageMult: 0.69 }, { damageMult: 0.78, paralyseChance: 0.15 }],
    rankText: ['dmg ×0.69 (0.6)', '×0.78; ★ paralysis chance 15% (10%)'],
  },
  'dragonRage.corneredDragon': {
    ...bond('dragonRage', 'charmander', 1, 'flareUp', 'Cornered Dragon', 'Flare Up fires Dragon Rage in a cross', {
      directions: 4,
      cooldownMult: 1.3,
      crossDamageMult: 1,
    }),
    ranks: [{ cooldownMult: 1.15 }, { cooldownMult: 1, crossDamageMult: 1.5 }],
    rankText: ['cooldown ×1.15 (1.3)', '×1.0; ★ the cross hits ×1.5'],
  },
  'airSlash.crosscut': {
    ...generic('airSlash', 'Crosscut', 'Blades cross; the 2nd hit crits', {
      damageMult: 0.85,
      /** P4f-6 build value: the blades start this far apart, then converge on the target. */
      crossOffset: 12,
    }),
    ranks: [{ damageMult: 0.98 }, { damageMult: 1.1 }],
    rankText: ['dmg ×0.98 (0.85)', '×1.1'],
  },
  'airSlash.tailwind': {
    ...generic('airSlash', 'Tailwind', 'Hits give move speed', {
      speedPctPerHit: 0.03,
      speedSeconds: 2,
      maxSpeedPct: 0.15,
      damageMult: 0.8,
    }),
    ranks: [{ damageMult: 0.92, maxSpeedPct: 0.2 }, { damageMult: 1.04, maxSpeedPct: 0.25 }],
    rankText: ['dmg ×0.92 (0.8); speed cap +20% (15%)', '×1.04; cap +25%'],
  },
  'airSlash.aerialAce': {
    ...bond('airSlash', 'charmander', 2, 'moving', 'Aerial Ace', 'Moving: homing blades, +20% crit', {
      movingSeconds: 1,
      critBonus: 0.2,
      damageMultStill: 0.75,
    }),
    ranks: [{ critBonus: 0.25, damageMultStill: 0.85 }, { critBonus: 0.3, damageMultStill: 0.95, movingSeconds: 0.7 }],
    rankText: ['crit +25% (20%); still ×0.85 (0.75)', '+30%; still ×0.95; ★ homing after 0.7 s moving (1)'],
  },
  'hurricane.tornado': {
    ...generic('hurricane', 'Tornado', 'The storm travels forward', {
      travelSpeed: 120,
      damageMult: 0.8,
    }),
    ranks: [{ damageMult: 0.92 }, { damageMult: 1.04, travelSpeed: 150 }],
    rankText: ['dmg ×0.92 (0.8)', '×1.04; ★ travels 150 px/s (120)'],
  },
  'hurricane.galeWall': {
    ...generic('hurricane', 'Gale Wall', 'Shoves the crowd outward', {
      stagger: 30,
      damageMult: 0.65,
    }),
    ranks: [{ damageMult: 0.75 }, { damageMult: 0.85, stagger: 40 }],
    rankText: ['dmg ×0.75 (0.65)', '×0.85; ★ stagger 40 (30)'],
  },
  'hurricane.infernoStorm': {
    ...bond('hurricane', 'charmander', 2, 'kill', 'Inferno Storm', 'Kills extend it; 30 kills turn it Fire', {
      secondsPerKill: 0.25,
      maxBonusSeconds: 1.5,
      killsToIgnite: 30,
      burnPct: 0.2,
      damageMult: 0.85,
    }),
    ranks: [{ damageMult: 0.98, killsToIgnite: 25 }, { damageMult: 1.1, killsToIgnite: 20 }],
    rankText: ['dmg ×0.98 (0.85); ignites at 25 kills (30)', '×1.1; 20 kills'],
  },
  'smokescreen.chokingSmoke': {
    ...generic('smokescreen', 'Choking Smoke', 'The cloud also damages', {
      tickDamage: 4,
      tickInterval: 0.5,
      radiusMult: 0.7,
    }),
    ranks: [{ tickDamage: 4.6 }, { tickDamage: 5, radiusMult: 0.72 }],
    rankText: ['4.6 per tick (4)', '5 per tick; ★ radius ×0.72 (0.7)'],
  },
  'smokescreen.smokeTrail': {
    ...generic('smokescreen', 'Smoke Trail', 'Smoke puffs behind you while kiting', {
      puffRadius: 40,
      puffEvery: 0.4,
      trailSeconds: 4,
      puffSeconds: 1.5,
      cooldownMult: 1.2,
    }),
    ranks: [{ puffSeconds: 2 }, { puffSeconds: 2.5, trailSeconds: 5 }],
    rankText: ['puffs last 2 s (1.5)', '2.5 s; ★ trail lasts 5 s (4)'],
  },
  'smokescreen.hiddenFlame': {
    ...bond('smokescreen', 'charmander', 0, 'inOwnSmoke', 'Hidden Flame', 'In your smoke, Blaze counts as active', {
      radiusMult: 0.6,
      cooldownMult: 1.4,
    }),
    ranks: [{ radiusMult: 0.7, cooldownMult: 1.25 }, { radiusMult: 0.8, cooldownMult: 1.1 }],
    rankText: ['radius ×0.7 (0.6); cooldown ×1.25 (1.4)', '×0.8; cooldown ×1.1'],
  },
  'slash.afterimage': {
    ...generic('slash', 'Afterimage', 'The X lingers and cuts again', {
      markSeconds: 0.6,
      recutFraction: 0.5,
      innateCrit: 0.15,
      damageMult: 1,
    }),
    ranks: [{ recutFraction: 0.6, innateCrit: 0.2, damageMult: 1.1 }, { recutFraction: 0.7, innateCrit: 0.25, markSeconds: 0.9, damageMult: 1.2 }],
    rankText: ['re-cut 60% (50%); innate crit 20% (15%); move dmg ×1.1', '70%; crit 25%; move dmg ×1.2; ★ mark lasts 0.9 s (0.6)'],
  },
  'slash.flurry': {
    ...generic('slash', 'Flurry', '3 cuts on 3 enemies', {
      targets: 3,
      /**
       * P4f-7 rule-4 tuning: 0.5 read 0.43. The base X already hits ~3 enemies in a crowd, so 3 half cuts
       * are half its damage anywhere. Full cuts: the cost is losing the X area (flagged for the owner).
       */
      cutDamageFraction: 1,
    }),
    ranks: [{ cutDamageFraction: 1.15 }, { cutDamageFraction: 1.3 }],
    rankText: ['cuts 115% (100%)', 'cuts 130%'],
  },
  'slash.searingSlash': {
    ...bond('slash', 'charmander', 1, 'targetBurning', 'Searing Slash', 'Crits Burning enemies and cashes in the Burn', {
      damageMultNotBurning: 0.8,
      cashInMult: 1,
    }),
    ranks: [{ damageMultNotBurning: 0.9 }, { damageMultNotBurning: 1, cashInMult: 1.25 }],
    rankText: ['not Burning ×0.9 (0.8)', '×1.0; ★ the cash-in deals ×1.25 the remaining Burn'],
  },
  'wingAttack.updraft': {
    ...generic('wingAttack', 'Updraft', 'Lifts light enemies off the ground', {
      liftSeconds: 0.6,
      landStagger: 10,
      damageMult: 0.75,
    }),
    ranks: [{ damageMult: 0.86 }, { damageMult: 0.97, liftSeconds: 0.8 }],
    rankText: ['dmg ×0.86 (0.75)', '×0.97; ★ lift 0.8 s (0.6)'],
  },
  'wingAttack.backdraft': {
    ...generic('wingAttack', 'Backdraft', 'One rear gust guards your escape', {
      arcDeg: 160,
      stagger: 35,
      damageMult: 1,
    }),
    ranks: [{ damageMult: 1.15 }, { damageMult: 1.05, arcDeg: 200 }],
    rankText: ['move dmg ×1.15', 'move dmg ×1.05; ★ rear arc 200° (160)'],
  },
  'wingAttack.fanTheFlames': {
    ...bond('wingAttack', 'charmander', 2, 'ownScorch', 'Fan the Flames', 'Gusts flare and push your Scorch', {
      refreshSeconds: 3,
      growPct: 0.5,
      driftPx: 40,
      damageMult: 0.8,
    }),
    requires: ['scorchSource'],
    ranks: [{ damageMult: 0.92 }, { damageMult: 1.04, growPct: 0.75 }],
    rankText: ['dmg ×0.92 (0.8)', '×1.04; ★ patches grow to ×1.75 (1.5)'],
  },
  'ember.kindle': {
    ...signature('ember', 'charmander', 'blazeActive', 'Kindle', 'Every 3rd shot is Kindled', {
      everyN: 3,
      everyNBlaze: 2,
      kindledMult: 2.2,
      kindledSizeMult: 1.5,
      otherMult: 0.6,
      tier1: { scorchRingPatches: 3 },
      tier2: { meteorTelegraph: 0.6, craterSizeMult: 1.5 },
      kindledBurnPct: 0,
    }),
    ranks: [{ kindledMult: 2.75 }, { kindledMult: 2.75, kindledBurnPct: 0.05 }],
    rankText: ['Kindled ×2.75 (2.2)', '×2.75; ★ Kindled shots Burn (5% per s)'],
  },
  'ember.flamethrower': {
    ...signature('ember', 'charmander', 'blazeActive', 'Flamethrower', 'A short cone of flames', {
      flames: 4,
      coneDeg: 40,
      reach: 130,
      flameDamageFraction: 0.3, // P4f-5 rule-4 tuning (doc: 0.35, 1.22× in a crowd)
      blazeReachMult: 1.3,
      tier1: { burnPct: 0.2 },
      tier2: { scorchLine: true },
    }),
    ranks: [{ flameDamageFraction: 0.35 }, { flameDamageFraction: 0.4, reach: 150 }],
    rankText: ['flames 35% (30%)', '40%; ★ reach 150 px (130)'],
  },
  'ember.wisp': {
    ...signature('ember', 'charmander', 'blazeActive', 'Will-o-Wisp', 'Orbiting wisps launch at close enemies', {
      maxWisps: 3,
      maxWispsBlaze: 5,
      triggerRadius: 110,
      damageMult: 1.3, // P4f-5 rule-4 tuning (doc: 1.4, 1.22×)
      /** P4f-5 build value: seconds between two wisp launches. */
      launchInterval: 0.15,
      tier1: { splash: true },
      tier2: { craterSizeMult: 0.5 },
    }),
    ranks: [{ damageMult: 1.5 }, { damageMult: 1.7, maxWisps: 4, maxWispsBlaze: 6 }],
    rankText: ['dmg ×1.5 (1.3)', '×1.7; ★ +1 wisp (3 / 5 with Blaze)'],
  },

  // ── Bulbasaur line moves ───────────────────────────────────────────────
  'tackle.rollout': generic('tackle', 'Rollout', 'Stacks while it keeps hitting', {
    stackDamagePct: 0.07, // P4f-6 rule-4 tuning (doc: 0.2 / 0.1 reach, 2.34x)
    stackReachPct: 0.02,
    maxStacks: 5,
    damageMult: 0.8,
  }),
  'tackle.bowling': generic('tackle', 'Bowling', 'Knocked enemies hit others', {
    stagger: 30,
    collisionDamageFraction: 0.3,
    cooldownMult: 1.2,
  }),
  'tackle.bulbBash': bond('tackle', 'bulbasaur', 1, 'bulbFill', 'Bulb Bash', 'Up to +80% damage with a full Bulb', {
    maxBonus: 0.8,
    emptyMult: 0.8,
  }),
  'razorLeaf.spiral': generic('razorLeaf', 'Leaf Spiral', '360° spiral of leaves', {
    damageMult: 0.8,
  }),
  'razorLeaf.embed': generic('razorLeaf', 'Embed', 'Leaves stick, then rip out', {
    embedSeconds: 1.5,
    ripFraction: 0.45, // P4f-6 rule-4 tuning (doc: 0.6, 1.21x)
    damageMult: 0.85,
  }),
  'razorLeaf.healthyGrowth': bond('razorLeaf', 'bulbasaur', 0, 'fullHp', 'Healthy Growth', 'Full HP: +1 leaf, pierce 1', {
    extraLeaves: 1,
    pierce: 1,
    damageMultHurt: 0.6, // P4f-6 rule-4 tuning (doc: 0.8; 1.74x at full HP, so the hurt side pays more)
  }),
  'leechSeed.spread': generic('leechSeed', 'Spreading Seed', 'Seed jumps on death (once)', {
    durationMult: 0.75,
    maxJumps: 1,
    /** P4f-6 build value: how far a seed can jump. */
    jumpRange: 140,
  }),
  'leechSeed.seedBomb': generic('leechSeed', 'Seed Bomb', 'Seeds a 50 px area', {
    radius: 50,
    seedStrength: 0.1, // P4f-6 rule-4 tuning (doc: 0.4, 1.69x)
    cooldownMult: 1.3,
  }),
  'leechSeed.seedNetwork': bond('leechSeed', 'bulbasaur', 0, 'leechStrength', 'Seed Network', 'Each Seeded enemy raises Leech', {
    leechPerSeeded: 0.005,
    maxLeechBonus: 0.03,
    seedDamageMult: 0.7,
  }),
  'poisonPowder.drift': generic('poisonPowder', 'Drift Cloud', 'The cloud follows enemies', {
    driftSpeed: 30,
    radiusMult: 0.8,
  }),
  'poisonPowder.toxic': generic('poisonPowder', 'Toxic', 'Poison stacks up to ×5', {
    maxStacks: 5,
    stackPct: 0.2,
    durationMult: 0.7,
  }),
  'poisonPowder.sporeSac': bond('poisonPowder', 'bulbasaur', 0, 'hitTaken', 'Spore Sac', 'Getting hit puffs a poison cloud', {
    sizeMult: 0.5,
    cloudSeconds: 1.5,
    minInterval: 2,
    cooldownMult: 1.3,
  }),
  'sleepPowder.drowsy': generic('sleepPowder', 'Drowsy Haze', 'Big slowing cloud, delayed sleep', {
    radiusMult: 1.8,
    slow: 0.5,
    sleepAfter: 1.5,
  }),
  'sleepPowder.nightmare': generic('sleepPowder', 'Nightmare', 'Sleepers take +25% damage', {
    damageTakenPct: 0.25,
    sleepSeconds: 0.6,
  }),
  'sleepPowder.sweetDreams': bond('sleepPowder', 'bulbasaur', 0, 'targetAsleep', 'Sweet Dreams', 'Leech ×3 on sleeping enemies', {
    leechMult: 3,
    sleepMult: 0.75,
  }),
  'sludge.pool': generic('sludge', 'Sludge Pool', 'Leaves a toxic pool', {
    radius: 40,
    seconds: 2.5,
    damageMult: 0.7,
    /** P4f-6 rule-4 tuning: the pool poisons for half the glob poison (1.26x at full). */
    poolPoisonFraction: 0.5,
  }),
  'sludge.acid': generic('sludge', 'Acid', '+15% damage taken from everything', {
    damageTakenPct: 0.15,
    debuffSeconds: 3,
    damageMult: 0.75,
  }),
  'sludge.sludgeBomb': bond('sludge', 'bulbasaur', 0, 'hpBelow', 'Sludge Bomb', 'Below 50% HP: splash and poison ×2', {
    hpThreshold: 0.5,
    splashRadius: 50,
    poisonMult: 2,
    /** P4f-6 build value: the bomb splash, as a fraction of the glob. */
    splashDamageFraction: 0.5,
    damageMultAbove: 0.85,
  }),
  'petalDance.frenzy': generic('petalDance', 'Frenzy Dance', 'Spins faster; petals fly out', {
    spinRampPerSec: 0.3,
    flyOutSeconds: 1,
    // P4f-6 build values: the petals flying out.
    petalSpeed: 300,
    petalRange: 150,
    petalRadius: 6,
    moveSpeedMult: 0.85,
  }),
  'petalDance.pollen': generic('petalDance', 'Pollen Ring', 'Petal hits heal you', {
    healPerHit: 1,
    maxHealPerSec: 5,
    damageMult: 0.75,
  }),
  'petalDance.petalBlizzard': bond('petalDance', 'bulbasaur', 1, 'bloom', 'Petal Blizzard', 'Each Bloom launches double petals', {
    petalMult: 2,
    seconds: 2,
    cooldownMult: 1.3,
  }),
  'solarBeam.fullCharge': generic('solarBeam', 'Full Charge', '1 s charge, then a huge beam', {
    chargeSeconds: 1,
    // P4f-6 tuning (doc: x2 width, +60%). The dummy ring overstates width: past ~31 px a beam catches
    // 4 ring dummies instead of 1, so this is judged on one target (~0.8x the plain beam) plus wider reach.
    widthMult: 1.5,
    damageMult: 1.2,
    cooldownMult: 1.25,
  }),
  'solarBeam.prism': generic('solarBeam', 'Prism', 'Splits into 3 beams behind the target', {
    beams: 3,
    fanDeg: 30,
    beamDamageFraction: 0.4,
    /** P4f-6 build value: the split beams are thinner than the main one. */
    widthMult: 0.5,
    damageMult: 0.85,
  }),
  'solarBeam.ingrain': bond('solarBeam', 'bulbasaur', 2, 'standingStill', 'Ingrain', 'Standing still: faster cooldown, −15% damage taken', {
    stillSeconds: 1,
    cooldownRate: 2,
    damageTakenMult: 0.85,
    damageMultMoving: 0.8,
  }),
  'vineWhip.longLash': signature('vineWhip', 'bulbasaur', 'bloom', 'Long Lash', 'Long reach; the tip always crits', {
    reachMult: 1.8,
    arcDeg: 50,
    tipFraction: 0.3,
    tipCritMult: 1.5,
    closeMult: 0.6,
    /** P4f-5 build value: "close" = inside this fraction of the reach. */
    closeFraction: 0.4,
    tier2: { rootFieldSizeMult: 0.6 },
  }),
  'vineWhip.thornGarden': signature('vineWhip', 'bulbasaur', 'bloom', 'Thorn Garden', 'Swings plant thorn sprouts', {
    maxSprouts: 4,
    sproutSeconds: 5,
    sproutRadius: 50,
    lashInterval: 1,
    lashDamageFraction: 0.3,
    damageMult: 0.7,
    bloomLashMult: 2,
    tier1: { sproutSlow: 0.2 },
    tier2: { expiringRootField: true },
  }),
  'vineWhip.sapLash': signature('vineWhip', 'bulbasaur', 'bloom', 'Sap Lash', 'Hits heal you', {
    healPerHit: 1,
    maxHealPerSwing: 4,
    damageMult: 0.75,
    bulbFillRateHurt: 0.5,
    tier1: { seedSeconds: 2, seedStrength: 0.5 },
    tier2: { rootHealPerSec: 2 },
  }),

  // ── Pikachu line moves ─────────────────────────────────────────────────
  'quickAttack.blink': generic('quickAttack', 'Blink Strike', 'Instant strike up to 140 px away', {
    range: 140,
    damageMult: 0.75,
  }),
  'quickAttack.doubleHit': generic('quickAttack', 'Double Hit', 'Hits twice', {
    secondHitDelay: 0.15,
    secondHitFraction: 0.6,
    cooldownMult: 1.3,
  }),
  'quickAttack.voltTackle': bond('quickAttack', 'pikachu', 0, 'chargeFull', 'Volt Tackle', 'Full Charge: a ×3 dash-strike, with recoil', {
    dashPx: 120,
    damageMult: 3,
    recoilMaxHpFraction: 0.05,
  }),
  'spark.arcPair': generic('spark', 'Arc Pair', 'A rotating line joins the sparks', {
    /** P4f-6 rule-4 tuning: 0.75 read 1.30. */
    damageMult: 0.6,
    /** P4f-6 build value: the crackling line's width. */
    lineWidth: 10,
  }),
  'spark.shower': generic('spark', 'Spark Shower', 'Sparks burst into 6 bolts', {
    bolts: 6,
    /** P4f-6 rule-4 tuning: 0.35 read 0.81, 0.55 read 0.85 (the spin dominates; the burst adds little). */
    boltDamageFraction: 0.65,
    cooldownMult: 1.2,
    // P4f-6 build values: bolt flight.
    boltSpeed: 350,
    boltRange: 140,
    boltRadius: 5,
  }),
  'spark.staticSpark': bond('spark', 'pikachu', 0, 'staticProc', 'Static Spark', 'Static paralysis adds sparks', {
    sparkSeconds: 2,
    maxExtraSparks: 3,
    cooldownMult: 1.2,
  }),
  'electroBall.ricochet': generic('electroBall', 'Ricochet', 'Bounces enemy to enemy (max 2)', {
    maxBounces: 2,
    /** P4f-6 rule-4 tuning (new value): read 2.61 on the 16 ring, 1.30 on the dense ring; the sparse ring undersells pierce 2. */
    damageMult: 0.8,
  }),
  'electroBall.plasma': generic('electroBall', 'Plasma Orb', 'Grows as it rolls', {
    maxRadiusMult: 2.5,
    maxDamageBonus: 0.4,
    speedMult: 0.7,
  }),
  'electroBall.velocityBall': bond('electroBall', 'pikachu', 0, 'moveSpeed', 'Velocity Ball', 'Damage scales with how much faster you are', {
    bonusPerSpeedRatio: 1,
    maxBonus: 0.8,
    damageMult: 0.6,
  }),
  'thunderWave.pulse': generic('thunderWave', 'Static Pulse', 'A paralysing ring expands from you', {
    ringRadius: 150,
    ringSeconds: 0.5,
    paralyseSeconds: 0.4,
  }),
  'thunderWave.terrain': generic('thunderWave', 'Electric Terrain', '+25% Electric damage field', {
    fieldSeconds: 5,
    electricBonus: 0.25,
    /** P4f-6 rule-4 tuning (new value): the field's own ticks; the longer, boosted field read 2.90 at full damage. */
    fieldDamageMult: 0.35,
  }),
  'thunderWave.conductor': bond('thunderWave', 'pikachu', 0, 'chainJump', 'Conductor', 'Your chain prefers Thunder Wave fields', {
    jumpRangeMult: 1.6,
    paralyseSeconds: 0.4,
  }),
  'ironTail.spin': generic('ironTail', 'Iron Spin', 'A 360° tail spin', {
    reachMult: 0.8,
    damageMult: 0.8,
  }),
  'ironTail.slam': generic('ironTail', 'Iron Slam', 'Telegraphed slam at the target; stuns', {
    radius: 60,
    telegraphSeconds: 0.3,
    stunSeconds: 0.5,
    /** P4f-6 rule-4 tuning: 1.3 read 1.39. */
    cooldownMult: 1.6,
  }),
  'ironTail.shockShatter': bond('ironTail', 'pikachu', 0, 'targetParalysed', 'Shock Shatter', 'Shatters paralysis for ×1.8', {
    shatterMult: 1.8,
    leapRadius: 100,
    /** P4f-6 build value: the leaping shock deals this fraction of the shattering hit. */
    leapDamageFraction: 0.5,
    damageMultNotParalysed: 0.8,
  }),
  'thunder.storm': generic('thunder', 'Storm Call', '3 smaller strikes', {
    strikes: 3,
    strikeRadius: 30,
    /** P4f-6 rule-4 tuning: 0.5 read 0.47 (0.61 on the dense ring); 0.8 reads 0.75 here, about 0.98 on the dense ring. */
    strikeDamageFraction: 0.8,
    paralyseSeconds: 0.3,
  }),
  'thunder.afterglow': generic('thunder', 'Afterglow', 'Electrified ground after the strike', {
    fieldSeconds: 2,
    paralysePerTick: 0.2,
    damageMult: 0.8,
  }),
  'thunder.thunderstorm': bond('thunder', 'pikachu', 1, 'discharge', 'Thunderstorm', 'Each Discharge calls a Thunder strike', {
    cooldownMult: 1.3,
  }),
  'thunderShock.liveWire': signature('thunderShock', 'pikachu', 'chargeLevel', 'Live Wire', 'Chain jumps leave live wires', {
    wireSeconds: 1,
    wireDamageFraction: 0.2,
    jumpDamageMult: 0.7,
    /** P4f-5 build values: wire hit width and check interval. */
    wireWidth: 8,
    wireTickInterval: 0.25,
    chargeThreshold: 0.5,
    chargeWireMult: 2,
    tier1: { wireSeconds: 1.5, paralyseSeconds: 0.2 },
  }),
  'thunderShock.ballLightning': signature('thunderShock', 'pikachu', 'chargeLevel', 'Ball Lightning', 'A slow orb that zaps nearby enemies', {
    orbSpeed: 200,
    orbSeconds: 1.6,
    zapRadius: 90,
    zapInterval: 0.3,
    zapDamageFraction: 0.65, // P4f-5 rule-4 tuning (doc: 0.25, 0.34× vs the chaining bolt)
    chargeMaxBonus: 0.5,
    tier1: { endChain: true },
  }),
  'thunderShock.returnArc': signature('thunderShock', 'pikachu', 'chargeLevel', 'Return Arc', 'The last jump arcs back to you: +Charge', {
    chargePerJump: 4,
    damageMult: 0.8,
    tier1: { returnLineFraction: 0.5, returnLineWidth: 8 },
  }),

  // ── Lapras moves ───────────────────────────────────────────────────────
  'bodySlam.bellyFlop': generic('bodySlam', 'Belly Flop', 'Hop, then a 360° slam', {
    radius: 90,
    delaySeconds: 0.3,
    /** P4f-6 rule-4 tuning: 1.25 read 1.74; 2 reads 1.16, ~1.04 at the steady cast rate (the 10 s window fits 4 slams). */
    cooldownMult: 2,
  }),
  'bodySlam.shockwave': generic('bodySlam', 'Shockwave', 'A ground wave 150 px forward', {
    waveLength: 150,
    waveDamageFraction: 0.4,
    /** P4f-6 rule-4 tuning: 0.85 read 1.23. */
    damageMult: 0.75,
    // P4f-6 build values: the wave front.
    waveSpeed: 450,
    waveRadius: 30,
  }),
  'bodySlam.surge': {
    ...bond('bodySlam', 'lapras', 0, 'levelUp', 'Surging Slam', 'Level-ups empower the next slams', {
      paralyseSeconds: 0.5,
      damageMult: 0.85,
    }),
    tide: { flood: { empoweredSlams: 3 }, ebb: { empoweredSlams: 1 } },
  },
  'iceBeam.iceWall': generic('iceBeam', 'Ice Wall', 'A wall enemies must walk around', {
    wallWidth: 80,
    wallSeconds: 2,
    damageMult: 0.7,
    /** P4f-6 build values: how thick the wall is, and how many can stand at once. */
    wallThickness: 12,
    maxWalls: 3,
  }),
  'iceBeam.aurora': generic('iceBeam', 'Aurora Beam', 'Hit enemies deal −20% contact damage', {
    contactDamageMult: 0.8,
    debuffSeconds: 3,
    damageMult: 0.8,
    slow: 0.3,
  }),
  'iceBeam.flashFreeze': {
    ...bond('iceBeam', 'lapras', 0, 'levelBelow', 'Flash Freeze', 'Before Lv 30 Ice Beam freezes', {
      damageMult: 0.8,
    }),
    tide: { flood: { freezeSeconds: 0.6 }, ebb: { slow: 0.6, widthMult: 1.2 } },
  },
  'surf.ferryWave': {
    ...bond('surf', 'lapras', 0, 'xpGem', 'Ferry Wave', 'Surf pulls XP gems to you', {
      damageMult: 0.8,
    }),
    tide: {
      flood: { gemRadiusMult: 1.5, moveSpeedPct: 0.3, speedSeconds: 1.5 },
      ebb: { gemRadiusMult: 1, moveSpeedPct: 0, speedSeconds: 0 },
    },
  },
  'hydroPump.pressureShell': {
    ...bond('hydroPump', 'lapras', 0, 'armorAbsorb', 'Pressure Shell', 'Armor-blocked damage charges the pump', {
      cooldownMult: 1.2,
    }),
    tide: { flood: { storeCap: 60 }, ebb: { storeCap: 30 } },
  },
  'iceShard.hail': signature('iceShard', 'lapras', undefined, 'Hail', 'Shards fall on the 2 nearest enemies', {
    targets: 2,
    range: 200,
    shadowSeconds: 0.25,
    damageFraction: 0.6,
    /** P4f-5 build value: each shard hits this radius. */
    impactRadius: 20,
    tier1: { fieldSizeMult: 0.4 },
  }),
  'iceShard.frostLance': signature('iceShard', 'lapras', undefined, 'Frost Lance', 'A lance that pierces every enemy', {
    slow: 0.3,
    cooldownMult: 1.4,
    tier1: { stripSeconds: 2, stripRadius: 30, stripPatches: 4 },
  }),
  'iceShard.song': signature('iceShard', 'lapras', undefined, 'Song of the Sea', 'Every 4th cast is a sleep song', {
    everyN: 4,
    ringRadius: 160,
    sleepSeconds: 1,
    tier1: { fieldRadius: 160, fieldSeconds: 3, slow: 0.3 },
  }),
} as const satisfies Record<string, MutationDef>;

export type MutationId = keyof typeof MUTATIONS;

export const MUTATION_IDS = Object.keys(MUTATIONS) as MutationId[];

/** What meets each requirement (INDEX.md RequirementId table): owning any of these Mutations or traits. */
export const REQUIREMENTS: Readonly<
  Record<RequirementId, { readonly mutations: readonly MutationId[]; readonly abilities: readonly AbilityId[] }>
> = {
  scorchSource: { mutations: ['ember.kindle', 'ember.flamethrower', 'fireSpin.flameTrail'], abilities: ['solarPower'] },
};

export function mutationDef(id: MutationId): MutationDef {
  return MUTATIONS[id];
}

/** A Mutation's values with the literal number and boolean types widened (ranks change them). */
export type RankedValues<I extends MutationId> = Widen<(typeof MUTATIONS)[I]['values']>;
type Widen<T> = { readonly [K in keyof T]: T[K] extends number ? number : T[K] extends boolean ? boolean : Widen<T[K]> };

const rankCache = new Map<MutationId, MutationValues[]>();

/** A Mutation's values at `rank` (D24): rank I, then the rank II and III overrides on top. Cached. */
export function rankedValues<I extends MutationId>(id: I, rank: number): RankedValues<I> {
  const def: MutationDef = MUTATIONS[id];
  let byRank = rankCache.get(id);
  if (!byRank) {
    const two = def.ranks ? { ...def.values, ...def.ranks[0] } : def.values;
    const three = def.ranks ? { ...two, ...def.ranks[1] } : def.values;
    byRank = [def.values, def.values, two, three];
    rankCache.set(id, byRank);
  }
  return byRank[Math.min(MUTATION_RANKS.max, Math.max(1, rank))] as RankedValues<I>;
}
