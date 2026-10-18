import type { AbilityId, PokemonId } from './content';
import type { MoveId } from './moves';

// Mutations: move-specific rule changers (docs/moveset/, owner decisions D15–D21).
// IDs, kinds, lines, stages and hooks mirror docs/moveset/INDEX.md exactly; a unit test keeps
// them in sync. Every tuning number lives here; sim hook functions read `values` and hold none.
// All numbers provisional. Mutations come only from map sites (D16), never from augment levels.

export type MutationKind = 'generic' | 'bond' | 'signature';

/** Moves designed in docs/moveset but not built yet (P4f-7). Their Mutations can't be granted until then. */
export const PENDING_MOVE_IDS = ['smokescreen', 'slash', 'wingAttack'] as const;
export type PendingMoveId = (typeof PENDING_MOVE_IDS)[number];

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
  readonly move: MoveId | PendingMoveId;
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
}

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
  move: MoveId | PendingMoveId,
  name: string,
  text: string,
  values: V,
) => ({ name, text, kind: 'generic', move, fromStage: 0, pool: 'site', values }) as const;

const bond = <const V extends MutationValues>(
  move: MoveId | PendingMoveId,
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
  'withdraw.spikedShell': generic('withdraw', 'Spiked Shell', 'A 3 s contact-damage aura', {
    auraSeconds: 3,
    tickInterval: 0.5,
    moveSpeedMult: 0.8,
    cooldownMult: 1.6,
  }),
  'withdraw.hunkerDown': generic('withdraw', 'Hunker Down', '−40% damage taken for 1.5 s after a cast', {
    buffSeconds: 1.5,
    damageTakenMult: 0.6,
    moveSpeedMult: 0.5,
    damageMult: 0.8,
  }),
  'withdraw.counterShell': bond('withdraw', 'squirtle', 0, 'shellBlock', 'Counter Shell', 'Shell blocks reset Withdraw; stagger ×2', {
    staggerMult: 2,
    damageMult: 0.8,
  }),
  'rapidSpin.spiralSpin': generic('rapidSpin', 'Spiral Spin', 'Shells spiral out from 30 to 120 px', {
    innerRadius: 30,
    outerRadius: 120,
    damageMult: 0.85,
  }),
  'rapidSpin.deflector': generic('rapidSpin', 'Deflector', 'Shells eat enemy projectiles', {
    secondsPerDeflect: 0.3,
    damageMult: 0.7,
  }),
  'rapidSpin.shellSpin': bond('rapidSpin', 'squirtle', 0, 'shellRecharge', 'Shell Spin', 'Shell hits cut Shell recharge', {
    rechargeCutPerHit: 0.25,
    maxCutPerCast: 1.5,
    damageMult: 0.8,
  }),
  'waterGun.slick': generic('waterGun', 'Slick', 'Leaves a puddle line; light enemies slip', {
    puddleSeconds: 3,
    slipChancePerSec: 0.15,
    slipStun: 0.6,
    damageMult: 0.7,
  }),
  'waterGun.washDown': generic('waterGun', 'Wash Down', 'Soaks; +20% Water damage taken', {
    debuffSeconds: 3,
    waterDamageTakenPct: 0.2,
    damageMult: 0.5,
    pushMult: 0,
  }),
  'waterGun.steadyAim': bond('waterGun', 'squirtle', 0, 'shellReady', 'Steady Aim', 'Shell up: longer beam, push ×2', {
    lengthMult: 1.4,
    pushMult: 2,
    damageMultShellDown: 0.75,
  }),
  'whirlpool.maelstrom': generic('whirlpool', 'Maelstrom', 'Pulls in, then collapses into a burst', {
    pullSpeed: 30,
    collapseTickMult: 3,
    perEnemyPct: 0.15,
    maxEnemies: 10,
    cooldownMult: 1.4,
  }),
  'whirlpool.moat': generic('whirlpool', 'Moat', 'A slowing ring that follows you', {
    innerRadius: 40,
    outerRadius: 90,
    slow: 0.7,
    damageMult: 0.6,
  }),
  'whirlpool.eyeOfTheStorm': bond('whirlpool', 'squirtle', 1, 'shellBurst', 'Eye of the Storm', 'Shell Burst drops a whirlpool at your feet', {
    sizeMult: 0.5,
    seconds: 2,
    cooldownMult: 1.3,
  }),
  'surf.rideTheWave': generic('surf', 'Ride the Wave', 'A wall rolling the way you move', {
    wallLength: 250,
    moveSpeedPct: 0.3,
    speedSeconds: 1,
  }),
  'surf.backwash': generic('surf', 'Backwash', 'The wave rolls back in and pulls', {
    returnDamageFraction: 0.5,
    pullPx: 20,
    cooldownMult: 1.3,
  }),
  'surf.lastWave': bond('surf', 'squirtle', 0, 'hpBelow', 'Last Wave', 'Below 40% HP: faster, bigger Surf', {
    hpThreshold: 0.4,
    cooldownMult: 0.5,
    radiusMult: 1.3,
    damageMultAbove: 0.8,
  }),
  'hydroPump.splitStream': generic('hydroPump', 'Split Stream', 'Two beams at ±30°', {
    angleDeg: 30,
    beamDamageFraction: 0.6,
  }),
  'hydroPump.pressureBuild': generic('hydroPump', 'Pressure Build', 'Damage ramps each tick', {
    rampPerTick: 0.25,
    durationMult: 1.5,
    cooldownMult: 1.5,
  }),
  'hydroPump.rainCannon': bond('hydroPump', 'squirtle', 2, 'healing', 'Rain Cannon', 'Rains around you; heals per enemy hit', {
    radius: 130,
    healPerEnemy: 1,
    maxHealPerSec: 4,
    damageMult: 0.7,
    pushMult: 0,
  }),
  'flashCannon.shrapnel': generic('flashCannon', 'Shrapnel', 'Shatters into 6 shards', {
    shards: 6,
    shardDamageFraction: 0.35,
    cooldownMult: 1.3,
  }),
  'flashCannon.railgun': generic('flashCannon', 'Railgun', 'Fires where you move; infinite pierce', {
    speedMult: 1.8,
    damageMult: 1.3,
  }),
  'flashCannon.armorRounds': bond('flashCannon', 'squirtle', 2, 'hitTaken', 'Armor Rounds', 'Hit since last shot: a second round', {
    secondRoundFraction: 0.6,
    damageMult: 0.8,
  }),
  'bubble.trap': signature('bubble', 'squirtle', undefined, 'Bubble Trap', 'Traps a light enemy, then pops', {
    floatSeconds: 1.2,
    popRadius: 40,
    popStagger: 20,
    cooldownMult: 1.3,
    tier1: { pullRadius: 60, pullPx: 15 },
    tier2: { maxTrapped: 3, leavesPuddle: true },
  }),
  'bubble.froth': signature('bubble', 'squirtle', undefined, 'Froth Mines', 'Shots leave hovering bubble mines', {
    minesPerShot: 3,
    mineSeconds: 3,
    mineDamageFraction: 0.5,
    maxMines: 9,
    damageMult: 0.7,
    tier1: { mineStagger: 10 },
    tier2: { driftSpeed: 40 },
  }),
  'bubble.undertow': signature('bubble', 'squirtle', undefined, 'Undertow', 'Bubbles return to you, hitting twice', {
    damageMult: 0.75,
    rangeMult: 0.8,
    tier1: { dragPx: 25 },
    tier2: { soaks: true, puddleEvery: 0.2 },
  }),

  // ── Charmander line moves ──────────────────────────────────────────────
  'scratch.furySwipes': generic('scratch', 'Fury Swipes', 'Stacks damage on one target', {
    stackWindow: 2,
    stackPct: 0.15,
    maxStacks: 5,
    arcMult: 0.6,
  }),
  'scratch.crescent': generic('scratch', 'Crescent', '200° arc plus a slash wave', {
    arcDeg: 200,
    waveLength: 70,
    waveDamageFraction: 0.4,
    reachMult: 0.8,
    cooldownMult: 1.2,
  }),
  'scratch.blazeClaws': bond('scratch', 'charmander', 0, 'blazeActive', 'Blaze Claws', 'Blaze active: Fire-type, burns, longer reach', {
    burnPct: 0.3,
    reachMult: 1.3,
    damageMultOff: 0.85,
  }),
  'fireSpin.vortex': generic('fireSpin', 'Vortex', 'Collapses, then bursts out', {
    burstRadius: 110,
    burstDamageMult: 2,
    cooldownMult: 1.2,
  }),
  'fireSpin.flameTrail': generic('fireSpin', 'Flame Trail', 'Flames leave Scorch', {
    scorchEvery: 0.6,
    damageMult: 0.7,
  }),
  'fireSpin.tailFlame': bond('fireSpin', 'charmander', 0, 'missingHp', 'Tail Flame', 'More flames as HP drops', {
    hpOneFlame: 0.7,
    hpTwoFlames: 0.4,
    burnPct: 0.2,
    damageMult: 0.75,
  }),
  'dragonRage.fixedRage': generic('dragonRage', 'Fixed Rage', 'Fixed damage; ignores types and damage augments', {
    fixedDamage: 10,
    levelsPerPoint: 4,
  }),
  'dragonRage.dragonBreath': generic('dragonRage', 'Dragon Breath', 'Short cone; paralysis chance', {
    coneDeg: 60,
    coneLength: 140,
    paralyseChance: 0.1,
    paralyseSeconds: 0.5,
    rangeMult: 0.55,
  }),
  'dragonRage.corneredDragon': bond('dragonRage', 'charmander', 1, 'flareUp', 'Cornered Dragon', 'Flare Up fires Dragon Rage in a cross', {
    directions: 4,
    cooldownMult: 1.3,
  }),
  'airSlash.crosscut': generic('airSlash', 'Crosscut', 'Blades cross; the 2nd hit crits', {
    damageMult: 0.85,
  }),
  'airSlash.tailwind': generic('airSlash', 'Tailwind', 'Hits give move speed', {
    speedPctPerHit: 0.03,
    speedSeconds: 2,
    maxSpeedPct: 0.15,
    damageMult: 0.8,
  }),
  'airSlash.aerialAce': bond('airSlash', 'charmander', 2, 'moving', 'Aerial Ace', 'Moving: homing blades, +20% crit', {
    movingSeconds: 1,
    critBonus: 0.2,
    damageMultStill: 0.75,
  }),
  'hurricane.tornado': generic('hurricane', 'Tornado', 'The storm travels forward', {
    travelSpeed: 120,
    damageMult: 0.8,
  }),
  'hurricane.galeWall': generic('hurricane', 'Gale Wall', 'Shoves the crowd outward', {
    stagger: 30,
    damageMult: 0.65,
  }),
  'hurricane.infernoStorm': bond('hurricane', 'charmander', 2, 'kill', 'Inferno Storm', 'Kills extend it; 30 kills turn it Fire', {
    secondsPerKill: 0.25,
    maxBonusSeconds: 1.5,
    killsToIgnite: 30,
    burnPct: 0.2,
    damageMult: 0.85,
  }),
  'smokescreen.chokingSmoke': generic('smokescreen', 'Choking Smoke', 'The cloud also damages', {
    tickDamage: 4,
    tickInterval: 0.5,
    radiusMult: 0.7,
  }),
  'smokescreen.smokeTrail': generic('smokescreen', 'Smoke Trail', 'Smoke puffs behind you while kiting', {
    puffRadius: 40,
    puffEvery: 0.4,
    trailSeconds: 4,
    puffSeconds: 1.5,
    cooldownMult: 1.2,
  }),
  'smokescreen.hiddenFlame': bond('smokescreen', 'charmander', 0, 'inOwnSmoke', 'Hidden Flame', 'In your smoke, Blaze counts as active', {
    radiusMult: 0.6,
    cooldownMult: 1.4,
  }),
  'slash.afterimage': generic('slash', 'Afterimage', 'The X lingers and cuts again', {
    markSeconds: 0.6,
    recutFraction: 0.5,
    innateCrit: 0.15,
  }),
  'slash.flurry': generic('slash', 'Flurry', '3 cuts on 3 enemies', {
    targets: 3,
    cutDamageFraction: 0.5,
  }),
  'slash.searingSlash': bond('slash', 'charmander', 1, 'targetBurning', 'Searing Slash', 'Crits Burning enemies and cashes in the Burn', {
    damageMultNotBurning: 0.8,
  }),
  'wingAttack.updraft': generic('wingAttack', 'Updraft', 'Lifts light enemies off the ground', {
    liftSeconds: 0.6,
    landStagger: 10,
    damageMult: 0.75,
  }),
  'wingAttack.backdraft': generic('wingAttack', 'Backdraft', 'One rear gust guards your escape', {
    arcDeg: 160,
    stagger: 35,
  }),
  'wingAttack.fanTheFlames': {
    ...bond('wingAttack', 'charmander', 2, 'ownScorch', 'Fan the Flames', 'Gusts flare and push your Scorch', {
      refreshSeconds: 3,
      growPct: 0.5,
      driftPx: 40,
      damageMult: 0.8,
    }),
    requires: ['scorchSource'],
  },
  'ember.kindle': signature('ember', 'charmander', 'blazeActive', 'Kindle', 'Every 3rd shot is Kindled', {
    everyN: 3,
    everyNBlaze: 2,
    kindledMult: 2.2,
    kindledSizeMult: 1.5,
    otherMult: 0.6,
    tier1: { scorchRingPatches: 3 },
    tier2: { meteorTelegraph: 0.6, craterSizeMult: 1.5 },
  }),
  'ember.flamethrower': signature('ember', 'charmander', 'blazeActive', 'Flamethrower', 'A short cone of flames', {
    flames: 4,
    coneDeg: 40,
    reach: 130,
    flameDamageFraction: 0.35,
    blazeReachMult: 1.3,
    tier1: { burnPct: 0.2 },
    tier2: { scorchLine: true },
  }),
  'ember.wisp': signature('ember', 'charmander', 'blazeActive', 'Will-o-Wisp', 'Orbiting wisps launch at close enemies', {
    maxWisps: 3,
    maxWispsBlaze: 5,
    triggerRadius: 110,
    damageMult: 1.4,
    tier1: { splash: true },
    tier2: { craterSizeMult: 0.5 },
  }),

  // ── Bulbasaur line moves ───────────────────────────────────────────────
  'tackle.rollout': generic('tackle', 'Rollout', 'Stacks while it keeps hitting', {
    stackDamagePct: 0.2,
    stackReachPct: 0.1,
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
    ripFraction: 0.6,
    damageMult: 0.85,
  }),
  'razorLeaf.healthyGrowth': bond('razorLeaf', 'bulbasaur', 0, 'fullHp', 'Healthy Growth', 'Full HP: +1 leaf, pierce 1', {
    extraLeaves: 1,
    pierce: 1,
    damageMultHurt: 0.8,
  }),
  'leechSeed.spread': generic('leechSeed', 'Spreading Seed', 'Seed jumps on death (once)', {
    durationMult: 0.75,
    maxJumps: 1,
  }),
  'leechSeed.seedBomb': generic('leechSeed', 'Seed Bomb', 'Seeds a 50 px area', {
    radius: 50,
    seedStrength: 0.4,
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
    damageMultAbove: 0.85,
  }),
  'petalDance.frenzy': generic('petalDance', 'Frenzy Dance', 'Spins faster; petals fly out', {
    spinRampPerSec: 0.3,
    flyOutSeconds: 1,
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
    widthMult: 2,
    damageMult: 1.6,
    cooldownMult: 1.25,
  }),
  'solarBeam.prism': generic('solarBeam', 'Prism', 'Splits into 3 beams behind the target', {
    beams: 3,
    fanDeg: 30,
    beamDamageFraction: 0.4,
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
    damageMult: 0.75,
  }),
  'spark.shower': generic('spark', 'Spark Shower', 'Sparks burst into 6 bolts', {
    bolts: 6,
    boltDamageFraction: 0.35,
    cooldownMult: 1.2,
  }),
  'spark.staticSpark': bond('spark', 'pikachu', 0, 'staticProc', 'Static Spark', 'Static paralysis adds sparks', {
    sparkSeconds: 2,
    maxExtraSparks: 3,
    cooldownMult: 1.2,
  }),
  'electroBall.ricochet': generic('electroBall', 'Ricochet', 'Bounces enemy to enemy (max 2)', {
    maxBounces: 2,
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
    cooldownMult: 1.3,
  }),
  'ironTail.shockShatter': bond('ironTail', 'pikachu', 0, 'targetParalysed', 'Shock Shatter', 'Shatters paralysis for ×1.8', {
    shatterMult: 1.8,
    leapRadius: 100,
    damageMultNotParalysed: 0.8,
  }),
  'thunder.storm': generic('thunder', 'Storm Call', '3 smaller strikes', {
    strikes: 3,
    strikeRadius: 30,
    strikeDamageFraction: 0.5,
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
    chargeThreshold: 0.5,
    chargeWireMult: 2,
    tier1: { wireSeconds: 1.5, paralyseSeconds: 0.2 },
  }),
  'thunderShock.ballLightning': signature('thunderShock', 'pikachu', 'chargeLevel', 'Ball Lightning', 'A slow orb that zaps nearby enemies', {
    orbSpeed: 200,
    orbSeconds: 1.6,
    zapRadius: 90,
    zapInterval: 0.3,
    zapDamageFraction: 0.25,
    chargeMaxBonus: 0.5,
    tier1: { endChain: true },
  }),
  'thunderShock.returnArc': signature('thunderShock', 'pikachu', 'chargeLevel', 'Return Arc', 'The last jump arcs back to you: +Charge', {
    chargePerJump: 4,
    damageMult: 0.8,
    tier1: { returnLineFraction: 0.5 },
  }),

  // ── Lapras moves ───────────────────────────────────────────────────────
  'bodySlam.bellyFlop': generic('bodySlam', 'Belly Flop', 'Hop, then a 360° slam', {
    radius: 90,
    delaySeconds: 0.3,
    cooldownMult: 1.25,
  }),
  'bodySlam.shockwave': generic('bodySlam', 'Shockwave', 'A ground wave 150 px forward', {
    waveLength: 150,
    waveDamageFraction: 0.4,
    damageMult: 0.85,
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
    tier1: { fieldSizeMult: 0.4 },
  }),
  'iceShard.frostLance': signature('iceShard', 'lapras', undefined, 'Frost Lance', 'A lance that pierces every enemy', {
    slow: 0.3,
    cooldownMult: 1.4,
    tier1: { stripSeconds: 2 },
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
