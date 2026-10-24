// Main-map terrain (D47, docs/map/README.md). M1: tall obstacles only (boulders, trees), scattered per chunk.
// Biomes and set pieces come in M2; water, marsh and tall grass in M3. Every number is provisional.

export type ObstacleKind = 'boulder' | 'tree';

export const MAP_TUNING = {
  /** Same chunks as Mutation Sites (`SITE_TUNING.chunkSize`): chunk (0, 0) is centred on the start. */
  chunkSize: 1000,
  /** Obstacles tried per chunk at density 1; the start chunk and its 8 neighbours get `startPerChunk` (R7). */
  perChunk: 8,
  startPerChunk: 2,
  /** Nothing within this many px of the start, so the first seconds are open ground. */
  startClear: 300,
  /**
   * px of free ground between any two obstacles, and twice the gap to a chunk edge (R1). With every gap at least this
   * wide no lane can close, and a mover narrower than half of it only ever touches its own chunk's obstacles.
   */
  gap: 150,
  /** Share of tries that are boulders (the rest are trees). */
  boulderShare: 0.5,
  /** Radius ranges per kind (README §7.6–§7.7). */
  radius: { boulder: [30, 70], tree: [40, 60] } as Readonly<Record<ObstacleKind, readonly [number, number]>>,
  /** Density for `?stress=1`: as many obstacles as the gap rule allows. */
  stressDensity: 2.5,
  /** Stuck enemies (README §11.4): this long pressed against obstacles and this far from you, they're recycled. */
  stuck: { seconds: 3, recycleBeyond: 450 },
} as const;
