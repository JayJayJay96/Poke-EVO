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
    range: 450,
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
  gluttony: { interval: 15, maxBerries: 3, healPct: 0.08, shakeSeconds: 3, dropAt: 2, rushMult: 2.2 },
  /**
   * Rest: falls asleep and heals over a few seconds, taking more damage. Damage dealt while asleep fills a wake
   * meter; filling it cancels the heal and Snorlax wakes straight into a quick Body Slam (interrupt bar).
   */
  rest: { seconds: 5, healPct: 0.25, damageTakenMult: 1.5, wakeAtPct: 0.1, wakeSlamWindup: 0.6 },
  /** Snore (while asleep): expanding rings with one gap that rotates between rings; run through the gap. */
  snore: { interval: 1.5, speed: 240, thickness: 18, gapDeg: 70, gapTurnDeg: 75, maxRadius: 480, damageFactor: 0.6 },
  /** Yawn (phase 2+): a cone telegraph, then a drowsy cloud that slows the player inside it (no sleep, §10). */
  yawn: { cooldown: 9, telegraph: 0.9, cloudSeconds: 4, range: 240, arcDeg: 90, slow: 0.4 },
  /** Belly Drum (start of phase 3): halves its current HP, doubles its contact (so slams and beams too). */
  bellyDrum: { hpMult: 0.5, contactMult: 2 },
  /** Hyper Beam (phase 3): a line telegraph aimed where you stand (lead 0), then 2 s of recharge: the punish window. */
  hyperBeam: { cooldown: 10, firstAfter: 3, telegraph: 1.1, width: 50, length: 900, damageFactor: 3, recharge: 2 },
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
  rewardCards: 5,
} as const;
