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

/** Snorlax's phase 1 kit (BOSSES.md §4, B1-3). Rubble, Rest, Yawn, Belly Drum, Snore and Hyper Beam are B2. */
export const SNORLAX_KIT = {
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
    windup: 0.8,
    lead: 0.5,
    /** × contact damage. */
    damageFactor: 2,
    /** Seconds Snorlax stays put after landing: the punish window. */
    recover: 0.7,
  },
  /** Oran Berries drop in the arena; Snorlax walks to the nearest and eats it, unless the player grabs it first. */
  gluttony: { interval: 15, maxBerries: 3, healPct: 0.08 },
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
