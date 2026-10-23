import type { EnemyId } from './content';

// Arena boss events (D28): Mewtwo is the only main-map boss; every other boss is drawn at random for
// an arena event. Every number is provisional.

export type ArenaBossId = 'snorlax' | 'zapdos' | 'machamp';
/** Themed entrance on the main map; its entry animation is presentation (enemy design team). */
export type ArenaEntranceKind = 'mountainHole' | 'pool' | 'whirlwind' | 'dojo';

export interface ArenaBossDef {
  readonly id: ArenaBossId;
  /** The boss's enemy entry: stats, types and the boss flag. */
  readonly enemy: EnemyId;
  readonly entrance: ArenaEntranceKind;
  /** Seconds to win once the fight starts (BOSSES.md: Snorlax's target fight is 60–90 s). */
  readonly timeLimit: number;
  /**
   * Boss tier (owner 2026-10-23): event N draws from tier N. Tier 1 are strong regulars (Snorlax); tier 2 are the
   * legendary birds, one tier below Mewtwo.
   */
  readonly tier: 1 | 2;
}

export const ARENA_BOSSES: Readonly<Record<ArenaBossId, ArenaBossDef>> = {
  // Owner 2026-10-23: 6 min to win, and arena time doesn't count on the run clock (was 120 / 150 s).
  snorlax: { id: 'snorlax', enemy: 'snorlax', entrance: 'mountainHole', timeLimit: 360, tier: 1 },
  zapdos: { id: 'zapdos', enemy: 'zapdos', entrance: 'whirlwind', timeLimit: 360, tier: 2 },
  machamp: { id: 'machamp', enemy: 'machamp', entrance: 'dojo', timeLimit: 360, tier: 1 },
};

/**
 * Machamp's kit (BOSSES.md §4, D42). Rhythm: 2–3 attacks, then a Bulk Up pose (the opening). Its signature is the
 * rock in hand: grab or rip a rock (a shield with HP), then throw it, charge with it (Strength) or, rarely, pose
 * behind it (Iron Pose). Phase 2 (below 66%, after an immune Focus Energy) adds Bullet Punch, Dynamic Punch and
 * Focus Blast; phase 3 (below 33%, after an immune No Guard) adds Focus Punch and Close Combat. Cones follow the
 * fairness rule (BOSSES.md §2): a cone's `trigger` (centre distance) leaves a standing player fully inside its
 * `reach`. Every number provisional.
 */
export const MACHAMP_KIT = {
  phaseAt: [0.66, 0.33],
  /** Seconds of each phase-change animation (Focus Energy, No Guard): immune. */
  transitionSeconds: 1.5,
  moveGap: 0.5,
  /** Guts (its ability): while it carries a status you put on it, it hits this much harder. */
  guts: 1.3,
  /**
   * Bulk Up pose (owner 2026-10-23: "the opening maybe will come from the constant flex"): after `every` attacks
   * (rolled), it poses. Deal `interruptPct` of its max HP during the pose to throw it off; otherwise it gains a
   * stack (+`stackDamage` each, max `maxStacks`) for the rest of the fight.
   */
  pose: { every: [2, 3], seconds: 1.2, secondsPhase3: 0.8, interruptPct: 0.04, stackDamage: 0.15, maxStacks: 3 },
  /** Relative odds of each move when several are ready. */
  weights: {
    karateChop: 4,
    crossChop: 3,
    lowSweep: 3,
    rockTomb: 2,
    seismicToss: 3,
    rock: 3,
    bulletPunch: 3,
    dynamicPunch: 2,
    focusBlast: 2,
    focusPunch: 2,
    closeCombat: 3,
  },
  /** Karate Chop: a string of cone chops, each re-aimed (lead 0) with a step forward; 4 chops from phase 2. */
  karateChop: { cooldown: 4, firstAfter: 1, trigger: 95, reach: 130, arcDeg: 70, chops: 3, chopsPhase2: 4, gaps: [0.7, 0.55, 0.4, 0.4], step: 30, damageFactor: 1, recover: 0.6 },
  /** Cross Chop: crouch, leap to a lead-aimed spot, an X of two crossing lines, land; a long recover. */
  crossChop: { cooldown: 7, firstAfter: 2, range: 320, crouch: 0.3, telegraph: 0.9, lead: 0.5, arm: 180, width: 36, damageFactor: 2, recover: 0.9 },
  /** Low Sweep: a ring around itself when you hug it; slows you. `trigger` is measured from its edge. */
  lowSweep: { cooldown: 6, firstAfter: 2, trigger: 60, radius: 130, telegraph: 0.6, damageFactor: 0.8, slowSeconds: 2, recover: 0.4 },
  /** Rock Tomb: boulders on rings (one lead-aimed, the rest scattered round it); they stay as rocks. */
  rockTomb: { cooldown: 9, firstAfter: 4, telegraph: 0.9, boulders: 3, scatter: 110, radius: 36, damageFactor: 1, slowSeconds: 2, stay: 8 },
  /**
   * Seismic Toss: a grab ring around it; caught, you're thrown `throwDistance` px away from it (a push, never a
   * stun) for `hpPct` of your max HP (lore: fixed damage; your damage-taken modifiers still apply).
   */
  seismicToss: { cooldown: 8, firstAfter: 3, trigger: 50, radius: 120, telegraph: 0.7, throwDistance: 220, hpPct: 0.06, recover: 0.6 },
  /**
   * The rock in hand (owner 2026-10-23: "a big element of surprise"): it takes a rubble rock within `grabRange`
   * (`grab` s) or rips one from the ground (`rip` s). The held rock is a shield in front of it: it blocks your shots
   * (D41) and has `shieldHpPct` of its max HP; breaking it staggers it for `stagger` s. After a `tell` it picks a
   * follow-up by weight, never the same twice in a row.
   */
  rock: {
    cooldown: 7,
    firstAfter: 5,
    grabRange: 150,
    grab: 0.5,
    rip: 0.8,
    tell: 0.4,
    radius: 26,
    shieldHpPct: 0.03,
    stagger: 1.5,
    /** Rocks it leaves (Rock Tomb, Strength, Rock Throw) never push the rubble past this; held rocks never crumble. */
    maxRocks: 9,
    weights: { throw: 45, strength: 40, iron: 15 },
    ironWeightPhase3: 25,
  },
  /** Rock Throw: a lob onto a lead-aimed ring; it cracks into rocks around the landing spot. */
  rockThrow: { telegraph: 0.9, lead: 1, radius: 70, damageFactor: 1.5, cracks: 3, crackSpread: 60, stay: 10 },
  /**
   * Strength: it walks at you behind its rock with momentum (speed ramps from `startMult` to `endMult` over
   * `rampSeconds`, turning at most `turnRate` rad/s), plants within `plantWithin` px or after `maxCharge` s, shows a
   * locked line, then the rock breaks into boulders rolling along it; at the wall they stay as rocks.
   */
  strength: {
    startMult: 0.6,
    endMult: 1.6,
    rampSeconds: 2,
    turnRate: 1.2,
    plantWithin: 220,
    maxCharge: 2.5,
    telegraph: 0.5,
    boulders: 3,
    bouldersPhase3: 5,
    gap: 0.15,
    speed: 380,
    radius: 20,
    damageFactor: 1.2,
    stay: 12,
    recover: 0.8,
  },
  /** Iron Pose: the pose behind its planted rock; completed, it gives this many stacks. */
  ironPose: { stacks: 2 },
  /** Bullet Punch (phase 2+): a priority dash when you stand just outside melee. */
  bulletPunch: { cooldown: 6, firstAfter: 0, minDistance: 120, maxDistance: 260, telegraph: 0.35, length: 260, speed: 420, width: 40, damageFactor: 1.2, recover: 0.5 },
  /** Dynamic Punch (phase 2+): a big, slow, lead-aimed ring; it leaps onto it; confuses. */
  dynamicPunch: { cooldown: 10, firstAfter: 2, range: 320, lead: 0.5, telegraph: 1.2, radius: 110, damageFactor: 2.2, confusion: 2, recover: 0.6 },
  /** Focus Blast (phase 2+): a slow orb (an enemy your shots can kill) homing for `homing` s, then straight. */
  focusBlast: { cooldown: 9, firstAfter: 1, cast: 0.5, speed: 140, turnRate: 2, homing: 2.5, life: 6, hpPct: 0.015, radius: 18, blastRadius: 70, damageFactor: 1.6 },
  /**
   * Focus Punch (phase 3): a focus channel with an interrupt bar (deal `interruptPct` of max HP to break it and
   * stagger it), then a locked line across the arena (lead 0), then the punch.
   */
  focusPunch: { cooldown: 14, firstAfter: 2, channel: 2, interruptPct: 0.05, stagger: 1.2, telegraph: 0.5, width: 70, length: 900, damageFactor: 3, recover: 1 },
  /** Close Combat (phase 3): a flurry of cone hits; afterwards it takes ×`weakMult` for `weakSeconds`. */
  closeCombat: { cooldown: 12, firstAfter: 2, trigger: 95, reach: 130, arcDeg: 90, hits: 5, gap: 0.35, damageFactor: 0.8, weakSeconds: 3, weakMult: 1.5, recover: 0.4 },
} as const;

/**
 * Zapdos's kit (BOSSES.md §4, D32; owner 2026-10-22: special animations are immune, at least 10 kinds of attack).
 * Phase 1: Thunder, Drill Peck, Shock Wave, Thunderbolt, Roost, generators. Phase 2 (below 66%, after an immune
 * Charge-up) adds Thunderstorm, Zap Cannon, Electric Fence, Agility. Phase 3 (below 33%, after an immune Rain Dance)
 * adds Discharge and rain: Thunder conducts through puddles. Every number provisional.
 */
export const ZAPDOS_KIT = {
  /** HP fractions where the next phase starts; the phase gate holds HP there until its animation starts. */
  phaseAt: [0.66, 0.33],
  /** Seconds of each phase-change animation (Charge-up, Rain Dance): immune. */
  transitionSeconds: 1.5,
  /** Zapdos flies at about this distance from you, drifting sideways, instead of chasing to contact. */
  hover: { distance: 260, strafeDeg: 35 },
  moveGap: 0.6,
  /** Relative odds of each move when several are ready. */
  weights: {
    thunder: 3,
    drillPeck: 3,
    shockWave: 2,
    thunderbolt: 3,
    roost: 1,
    thunderstorm: 2,
    zapCannon: 2,
    fence: 2,
    agility: 1,
    discharge: 2,
  },
  /** Pressure (its ability; lore: drains PP): your move cooldowns run this much slower during the fight. */
  pressure: 0.15,
  /**
   * Generators (Power Plant lore): pylons on a ring around the arena centre; while any stands, Zapdos takes
   * ×`shieldMult`. A broken one is rebuilt `recharge` s later. Pylon HP = Zapdos's max HP × `hpFraction`.
   */
  pylons: { count: 3, ringFraction: 0.65, hpFraction: 0.04, recharge: 35, shieldMult: 0.25 }, // owner 2026-10-23: rebuilt too fast at 20 s
  /**
   * Overload (owner 2026-10-23): when all generators are down at once, Zapdos crashes for `seconds` (no moves, takes
   * ×`damageTakenMult`), then stays Weakened for `weakSeconds` (×`weakSpeedMult` speed; its telegraphs, casts and
   * cooldowns run ×`weakTimeMult` slower). All generators then rebuild together, `pylons.recharge` s after the crash,
   * so a single rebuilt pylon can't be broken for a cheap second Overload.
   */
  overload: { seconds: 5, damageTakenMult: 1.5, weakSeconds: 5, weakSpeedMult: 0.6, weakTimeMult: 1.5 },
  /** Thunder: two rings at once, one on you and one where you're heading (bracket). */
  thunder: { cooldown: 4, firstAfter: 2, radius: 55, telegraph: 0.9, lead: 1, damageFactor: 1.4 },
  /** Thunderstorm (phase 2+): three strikes on you, the gaps shrinking (rhythm). */
  thunderstorm: { cooldown: 10, firstAfter: 0, gaps: [0.8, 0.6, 0.4], radius: 55, damageFactor: 1.2 },
  /** Drill Peck: a lead-aimed line, then a dash along it. */
  drillPeck: { cooldown: 6, firstAfter: 3, telegraph: 0.7, lead: 1, speed: 650, length: 420, width: 40, damageFactor: 1.5, recover: 0.6 },
  /** Shock Wave (lore: never misses): homing bolts that give up after `homing` s and fly straight. */
  shockWave: { cooldown: 7, firstAfter: 4, cast: 0.5, bolts: 3, spreadDeg: 40, speed: 170, turnRate: 3, homing: 2.5, life: 4, radius: 9, damageFactor: 0.8 },
  /** Thunderbolt: a 3-way fan of zigzag bolts. */
  thunderbolt: { cooldown: 5, firstAfter: 1, cast: 0.6, bolts: 3, spreadDeg: 30, speed: 260, amplitude: 40, frequency: 2.5, life: 3, radius: 8, damageFactor: 1 },
  /** Zap Cannon (phase 2+): a slow, lazily homing ball that paralyses. */
  zapCannon: { cooldown: 12, firstAfter: 0, cast: 0.8, speed: 110, turnRate: 1, life: 6, radius: 26, damageFactor: 2, paralysis: 2 },
  /** Electric Fence (phase 2+): a line across the arena near you; Zapdos zips along it and it stays live. */
  fence: { cooldown: 11, firstAfter: 0, telegraph: 0.8, seconds: 4, width: 16, offset: 60, damageFactor: 0.7 },
  /** Agility (phase 2+): zips to the far side of the arena, then flies faster for a while. */
  agility: { cooldown: 12, firstAfter: 0, telegraph: 0.5, speedMult: 1.5, seconds: 4 },
  /**
   * Roost (once per phase, after losing `afterPct` of max HP in it): lands and heals, and loses its Flying type
   * while roosting (pure Electric: Ice and Electric hits change). The damage window.
   */
  roost: { seconds: 3, healPct: 0.15, afterPct: 0.12 },
  /**
   * Discharge (phase 3): channels with an interrupt bar (deal `interruptPct` of max HP to cancel it), then shocks
   * the whole arena except one safe ring shown during the channel.
   */
  discharge: { cooldown: 16, firstAfter: 2, channel: 2, interruptPct: 0.05, safeRadius: 80, damageFactor: 2, paralysis: 1.5, recover: 1 },
  /** Rain Dance (phase 3, arena only): puddles keep appearing; a Thunder landing while you stand in one hits and paralyses. */
  rain: { puddleEvery: 1.5, puddleSeconds: 6, paralysis: 2 },
  /** Lightning Rod (player trait): Thunder strikes you directly, and each hit fills this much Charge. */
  lightningRodCharge: 25,
} as const;
export const ARENA_BOSS_IDS = Object.keys(ARENA_BOSSES) as ArenaBossId[];

/**
 * Snorlax's kit (BOSSES.md §4): phase 1 Body Slam + Gluttony (B1-3); Rest at 66% and 33%, phase 2 Yawn and
 * double slams, phase 3 Belly Drum and Hyper Beam (B2). Every number provisional.
 */
export const SNORLAX_KIT = {
  /** HP fractions where Snorlax uses Rest; each Rest ends by moving to the next phase (phases never go back). */
  restAt: [0.66, 0.33],
  /**
   * Leaps onto a ring telegraph. The landing point is lead-aimed: player position + velocity × windup × lead,
   * locked when the telegraph appears (BOSSES.md §2 fairness rules), kept inside the arena.
   */
  bodySlam: {
    cooldown: 6,
    /** Seconds after the fight starts before the first slam. */
    firstAfter: 2,
    /** Max leap distance: farther away, Snorlax walks closer first, so kiting delays slams (owner 2026-10-21). */
    range: 350,
    radius: 90,
    windup: 1.1, // owner 2026-10-21: longer telegraphs (was 0.8)
    lead: 0.5,
    /** × contact damage. */
    damageFactor: 2,
    /** Seconds Snorlax stays put after landing: the punish window. */
    recover: 0.7,
    /** From phase 2 the slams come this many in a row (rhythm). */
    chainFromPhase2: 2,
    /** Each landing leaves rocks on the ring's edge that block the player (not Snorlax) for a while. */
    rubble: { count: 2, radius: 26, seconds: 20, max: 6 },
  },
  /**
   * Gluttony: Oran Berries drop in the arena; Snorlax eats the nearest unless the player grabs it first.
   * Every `interval` s (once Snorlax is free) it stops and shakes the ground for `shakeSeconds` (no damage); the
   * berry pops up `dropAt` s in, so the player always sees it first, then Snorlax rushes it at `rushMult` speed
   * (hangry). Owner 2026-10-21.
   */
  gluttony: {
    interval: 15,
    maxBerries: 3,
    healPct: 0.08,
    shakeSeconds: 3,
    dropAt: 2,
    rushMult: 2.2,
    /** Rare surprise (owner 2026-10-21): instead of running, it Body Slams onto the berry (normal telegraph). */
    leapChance: 0.2,
  },
  /**
   * Rest: falls asleep and heals over a few seconds, taking more damage. Damage dealt while asleep fills a wake
   * meter; filling it cancels the heal and Snorlax wakes straight into a quick Body Slam (interrupt bar).
   */
  rest: { seconds: 5, healPct: 0.25, damageTakenMult: 1.5, wakeAtPct: 0.1, wakeSlamWindup: 0.6 },
  /**
   * Snore (while asleep): expanding rings with one gap that rotates between rings; run through the gap, or hide
   * behind a rubble rock, which shelters its "shadow" seen from Snorlax (owner 2026-10-21; speed 240 → 170).
   */
  snore: { interval: 1.5, speed: 170, thickness: 18, gapDeg: 70, gapTurnDeg: 75, maxRadius: 480, damageFactor: 0.6 },
  /** Yawn (phase 2+): a cone telegraph, then a drowsy cloud that slows the player inside it (no sleep, §10). */
  /** Yawn: the cloud reaches `range`; it's only used when you're within `trigger` (well inside the cloud). */
  yawn: { cooldown: 9, telegraph: 0.9, cloudSeconds: 4, range: 240, trigger: 180, arcDeg: 90, slow: 0.4 },
  /**
   * Belly Drum (start of phase 3): halves its current HP, doubles its contact (so slams and beams too), then drums
   * its belly for `seconds`, immune (owner 2026-10-22: special animations can't be burst through).
   */
  bellyDrum: { hpMult: 0.5, contactMult: 2, seconds: 1.5 },
  /** Hyper Beam (phase 3): a line telegraph aimed where you stand (lead 0), then 2 s of recharge: the punish window. */
  hyperBeam: { cooldown: 10, firstAfter: 3, telegraph: 1.1, width: 50, length: 900, damageFactor: 3, recharge: 2 },

  // Variety (owner 2026-10-22: at least 10 kinds of attack). The picker draws by weight among the moves that are
  // ready, in range and unlocked for the phase, never the same move twice in a row, with `moveGap` s between moves.
  moveGap: 0.5,
  /** Relative odds of each move when several are ready. */
  weights: { bodySlam: 3, crunch: 4, rockSlide: 2, yawn: 2, fling: 2, heavySlam: 2, block: 2, hyperBeam: 3, earthquake: 2 },
  /**
   * Crunch (phase 1+): a quick bite cone when you hug it. `range` is measured from its edge; `reach` from its centre.
   * It starts only when you're well inside the bite (owner 2026-10-23: it used to end just short of a standing player).
   */
  crunch: { cooldown: 5, firstAfter: 3, range: 70, reach: 160, arcDeg: 100, telegraph: 0.6, damageFactor: 1.5, recover: 0.5 },
  /**
   * Rock Slide (phase 1+): a short roar, then rocks fall on ring telegraphs: one where you are, one lead-aimed, the
   * rest scattered near you. `keep` of them stay as rubble (more Snore cover, more Fling ammo).
   */
  rockSlide: { cooldown: 9, firstAfter: 5, cast: 0.5, rocks: 5, scatter: 160, radius: 42, telegraph: 1, damageFactor: 1, keep: 1 },
  /**
   * Fling (phase 2+, needs rubble): picks up the rock nearest to it and throws it at your lead-aimed spot (line
   * telegraph). The rock is used up, so your Snore cover goes; at the wall it bursts into shards flying back in.
   */
  fling: {
    cooldown: 7,
    firstAfter: 0,
    telegraph: 0.7,
    lead: 0.5,
    speed: 420,
    radius: 24,
    damageFactor: 1.5,
    shards: 3,
    shardSpreadDeg: 25,
    shardSpeed: 300,
    shardRadius: 10,
    shardFactor: 0.5,
  },
  /**
   * Heavy Slam (phase 2+): crouches, leaps out of reach (immune) while its shadow chases you slower than any
   * player can run, locks the shadow (red) and lands: big ring, rubble. Answers kiting from far away.
   */
  heavySlam: { cooldown: 14, firstAfter: 0, crouch: 0.4, air: 1.2, lock: 0.6, shadowSpeed: 120, radius: 120, damageFactor: 2.5, recover: 1, rubble: 3 },
  /** Block (phase 2+): when you're far, a chain holds you within `leash` px of Snorlax for `seconds`. */
  block: { cooldown: 16, firstAfter: 0, minDistance: 300, telegraph: 0.6, seconds: 5, leash: 260 },
  /** Belch (any phase, only as the next move after eating a berry): a cone of gas puffs at mixed speeds. */
  belch: { telegraph: 0.6, arcDeg: 70, puffs: 7, speedMin: 140, speedMax: 260, radius: 14, life: 2.2, damageFactor: 0.8, recover: 0.4 },
  /**
   * Earthquake (phase 3): stomps; the inner and outer bands around the stomp hit, then the band between them
   * (`bands` are the band edges in px). Move between bands in rhythm.
   */
  earthquake: { cooldown: 13, firstAfter: 3, bands: [150, 300], telegraph: 0.9, damageFactor: 1.2, recover: 0.6 },
} as const;

export const ARENA_TUNING = {
  /**
   * Arena events per run, before jitter; on the run clock, which fights don't count (owner 2026-10-23).
   * Owner 2026-10-23: 2 bosses, the 1st at ~6–7 min and the 2nd at ~12–13 min, until the run gets longer
   * (was 4 events at 3:00 / 6:30 / 10:00 / 11:20). Each open window must end before 15:00.
   */
  eventTimes: [390, 750],
  /** ± seconds of seeded jitter per event. */
  jitter: 20,
  /** Seconds an entrance stays open before it closes and the event is missed. */
  openSeconds: 60,
  /** px from the player where an entrance opens. */
  entranceDistance: { min: 600, max: 900 },
  /** Step this close to the entrance's centre to enter. */
  entranceRadius: 50,
  /** Closed arena radius in px; the player can't leave it. */
  arenaRadius: 450,
  /** The fight and its timer start when the player walks this close to the boss, or after `engageAfter` s. */
  engageDistance: 250,
  engageAfter: 6,
  /** Invulnerability on returning to the map. */
  returnInvulnSeconds: 2,
  /** Knocked out in the arena: back on the map with this share of max HP, no reward (owner 2026-10-21). */
  knockoutHpPct: 0.25,
  rewardCards: 5,
} as const;
