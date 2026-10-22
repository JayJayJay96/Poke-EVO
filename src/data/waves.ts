import type { EnemyId } from './content';

/**
 * Spawn director keyframes for the 15-minute run. All values provisional.
 * spawnInterval and hpScale interpolate linearly towards the next keyframe;
 * weights switch at each keyframe.
 */
export interface WaveKeyframe {
  /** Run time in seconds when this keyframe starts. */
  readonly at: number;
  /** Seconds between spawns. */
  readonly spawnInterval: number;
  /** Multiplier on enemy max HP. */
  readonly hpScale: number;
  /** Multipliers on contact damage and move speed (difficulty over time, owner 2026-10-20). */
  readonly damageScale: number;
  readonly speedScale: number;
  /** Relative spawn odds per enemy kind. */
  readonly weights: Readonly<Partial<Record<EnemyId, number>>>;
}

// Batch-2 species (ROSTER.md, D27) join by tier: tier 1 (Caterpie, Weedle, Zubat) early, tier 2 from 3:00, the
// healer Chansey rarely from 6:00. Every window holds a counter to each starter's type but never a majority
// (ROSTER counter table). Spawn variety (README §11) will replace these fixed mixes later.
export const WAVES: readonly WaveKeyframe[] = [
  { at: 0, spawnInterval: 1.2, hpScale: 1, damageScale: 1, speedScale: 1, weights: { rattata: 1, caterpie: 0.5 } },
  {
    at: 60,
    spawnInterval: 0.8,
    hpScale: 1.2,
    damageScale: 1.1,
    speedScale: 1,
    weights: { rattata: 3, pidgey: 1, caterpie: 1, weedle: 1, zubat: 0.5 },
  },
  {
    at: 180,
    spawnInterval: 0.5,
    hpScale: 1.6,
    damageScale: 1.2,
    speedScale: 1.03,
    weights: {
      rattata: 3,
      pidgey: 2,
      raticate: 0.4,
      spearow: 0.6,
      caterpie: 0.8,
      weedle: 0.8,
      zubat: 1,
      oddish: 0.6,
      psyduck: 0.6,
      geodude: 0.5,
      voltorb: 0.4,
      gastly: 0.4,
      abra: 0.3,
    },
  },
  {
    at: 360,
    spawnInterval: 0.35,
    hpScale: 2.5,
    damageScale: 1.4,
    speedScale: 1.06,
    weights: {
      rattata: 2,
      pidgey: 2,
      raticate: 1,
      spearow: 1.2,
      zubat: 1,
      oddish: 1,
      psyduck: 1,
      geodude: 1,
      voltorb: 0.8,
      gastly: 0.8,
      abra: 0.6,
      chansey: 0.15,
    },
  },
  {
    at: 600,
    spawnInterval: 0.25,
    hpScale: 4,
    damageScale: 1.7,
    speedScale: 1.1,
    // Fodder phases out (owner 2026-10-20): Rattata stops at 10:00, Pidgey at 13:00.
    weights: {
      pidgey: 1.5,
      raticate: 1.5,
      spearow: 2,
      fearow: 0.6,
      tauros: 0.4,
      zubat: 1,
      oddish: 1,
      psyduck: 1,
      geodude: 1.2,
      voltorb: 1,
      gastly: 1,
      abra: 0.8,
      chansey: 0.2,
    },
  },
  {
    at: 780,
    spawnInterval: 0.18,
    hpScale: 6,
    damageScale: 2,
    speedScale: 1.15,
    weights: {
      raticate: 2,
      spearow: 2.5,
      fearow: 1.5,
      tauros: 1,
      zubat: 0.8,
      oddish: 0.6,
      psyduck: 0.8,
      geodude: 1.2,
      voltorb: 1,
      gastly: 1,
      abra: 1,
      chansey: 0.2,
    },
  },
];
