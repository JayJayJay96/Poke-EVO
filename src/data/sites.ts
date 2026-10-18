// Mutation Sites (D16, D23): the only source of Mutations and held items. All numbers provisional.

export const SITE_TUNING = {
  /** The endless map is split into square chunks; each may hold one site (seeded per run). */
  chunkSize: 1000,
  /** Chance that a chunk holds a site. */
  chance: 0.35,
  /** Sites stay this far inside their chunk's edges. */
  edgeMargin: 150,
  /** Chunks this many steps around the player get their site decided as they come near. */
  generateChunks: 2,
  /** One of the 8 chunks around the start always holds a site, so the mechanic shows up early. */
  guaranteeNearStart: true,
  /** Capture ring radius in px; the player's centre must be inside. */
  radius: 55,
  /** Seconds standing inside to open it (D23). */
  captureSeconds: 5,
  /** Extra seconds when the roll holds a Pokémon-bound Mutation (Bond or signature, D23). */
  boundExtraSeconds: 3,
  /** Capture progress lost per second while outside the ring. */
  drainPerSecond: 1,
  /** Cards per site. */
  cards: 5,
  /** px: the HUD points at sites within this distance when they're off-screen. */
  arrowRange: 1500,
} as const;
