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
  /** Relative spawn odds per enemy kind. */
  readonly weights: Readonly<Partial<Record<EnemyId, number>>>;
}

export const WAVES: readonly WaveKeyframe[] = [
  { at: 0, spawnInterval: 1.2, hpScale: 1, weights: { rattata: 1 } },
  { at: 60, spawnInterval: 0.8, hpScale: 1.2, weights: { rattata: 3, pidgey: 1 } },
  { at: 180, spawnInterval: 0.5, hpScale: 1.6, weights: { rattata: 3, pidgey: 2, raticate: 0.4 } },
  { at: 360, spawnInterval: 0.35, hpScale: 2.5, weights: { rattata: 2, pidgey: 2, raticate: 1 } },
  { at: 600, spawnInterval: 0.25, hpScale: 4, weights: { rattata: 2, pidgey: 3, raticate: 1.5 } },
  { at: 780, spawnInterval: 0.18, hpScale: 6, weights: { rattata: 1, pidgey: 3, raticate: 2 } },
];
