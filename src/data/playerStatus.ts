// Statuses on the player (docs/enemies/README.md §10, owner asked to document 2026-10-21; built D36). Rules: the
// player never loses control for more than ~0.3 s (no sleep, no freeze, no reversed controls); after a status ends
// the same one can't land again for `fatigue` s; the starter's types resist them like an enemy's (statusResist.ts).
// Every number provisional.

export type PlayerStatusId = 'poison' | 'burn' | 'slow' | 'paralysis' | 'confusion' | 'soaked';

export const PLAYER_STATUS = {
  fatigue: 2,
  /** DoTs: `dpsFraction` of the hit that applied it, per second (×resistance), ticking every `tick` s. */
  poison: { seconds: 3, dpsFraction: 0.2, tick: 0.25 },
  burn: { seconds: 3, dpsFraction: 0.2, tick: 0.25 },
  slow: { seconds: 2, slow: 0.3 },
  /** −35% speed, with a heavier 0.2 s stutter when it lands; never a stun. */
  paralysis: { seconds: 2, slow: 0.35, stutter: 0.2, stutterSlow: 0.9 },
  /** Your moves aim at a random enemy in range instead of the nearest; movement is never touched. */
  confusion: { seconds: 2 },
  soaked: { seconds: 2, slow: 0.15 },
  /** Status slows never stack past this (the paralysis stutter is the one short exception). */
  slowCap: 0.5,
} as const;
