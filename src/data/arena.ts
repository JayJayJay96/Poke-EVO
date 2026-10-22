import type { EnemyId } from './content';

// Arena boss events (D28): Mewtwo is the only main-map boss; every other boss is drawn at random for
// an arena event. Every number is provisional.

export type ArenaBossId = 'snorlax';
/** Themed entrance on the main map; its entry animation is presentation (enemy design team). */
export type ArenaEntranceKind = 'mountainHole' | 'pool' | 'whirlwind';

export interface ArenaBossDef {
  readonly id: ArenaBossId;
  /** The boss's enemy entry: stats, types and the boss flag. */
  readonly enemy: EnemyId;
  readonly entrance: ArenaEntranceKind;
  /** Seconds to win once the fight starts (BOSSES.md: Snorlax's target fight is 60–90 s). */
  readonly timeLimit: number;
}

export const ARENA_BOSSES: Readonly<Record<ArenaBossId, ArenaBossDef>> = {
  snorlax: { id: 'snorlax', enemy: 'snorlax', entrance: 'mountainHole', timeLimit: 120 },
};
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
  yawn: { cooldown: 9, telegraph: 0.9, cloudSeconds: 4, range: 240, arcDeg: 90, slow: 0.4 },
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
  /** Crunch (phase 1+): a quick bite cone when you hug it. `range` is measured from its edge. */
  crunch: { cooldown: 5, firstAfter: 3, range: 110, reach: 160, arcDeg: 100, telegraph: 0.6, damageFactor: 1.5, recover: 0.5 },
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
   * The 4 events per run (D2, D28), before jitter. The last one opens by 11:20 so jitter, a full open
   * window, the engage wait and a full fight still end before 15:00.
   */
  eventTimes: [180, 390, 600, 680],
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
