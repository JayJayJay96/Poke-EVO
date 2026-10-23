import type { EnemyId } from './content';
import type { PlayerStatusId } from './playerStatus';

// Telegraphed attacks of normal enemies (D35; docs/enemies/README.md §9.2, ROSTER.md). Every attack locks its aim
// when its line telegraph appears and never re-aims (fairness, BOSSES.md §2). Every number provisional.
// Owner playtest 2026-10-23 ("only avoidable if you're moving"): every telegraph +0.2 s, hazard areas ×0.85.

/** Ranged: keeps its distance, stops, shows a line, then fires a dart along it. */
export interface RangedAttack {
  readonly kind: 'ranged';
  /** It backs off (×`backOffMult` speed) when closer than `keepMin`, and holds still up to `keepMax`. */
  readonly keepMin: number;
  readonly keepMax: number;
  readonly backOffMult: number;
  /** Fires only when you're within this many px. */
  readonly range: number;
  readonly cooldown: number;
  readonly telegraph: number;
  readonly shotSpeed: number;
  readonly shotRadius: number;
  readonly shotLife: number;
  /** × its contact damage. */
  readonly damageFactor: number;
  /** A status the dart puts on you (Psyduck's Water Gun Soaks). */
  readonly status?: PlayerStatusId;
}

/** Charger: stops and paws the ground behind a line, then dashes along it; a short recover after. */
export interface ChargeAttack {
  readonly kind: 'charge';
  readonly range: number;
  readonly cooldown: number;
  readonly telegraph: number;
  readonly dashDistance: number;
  /** Dash speed = its speed × this (a burst, README §6.2: may outrun every player, always telegraphed). */
  readonly dashSpeedMult: number;
  /** Contact damage during the dash × this. */
  readonly damageFactor: number;
  readonly recover: number;
}

/** Diver: marks a ring on you (locked), then lands on it (a burst); a short recover after. */
export interface DiveAttack {
  readonly kind: 'dive';
  readonly range: number;
  readonly cooldown: number;
  readonly telegraph: number;
  readonly radius: number;
  /** × its contact damage, for the landing. */
  readonly damageFactor: number;
  readonly recover: number;
}

/** Web layer: a line to your spot (locked), then a sticky web patch there that slows you while you stand in it. */
export interface WebAttack {
  readonly kind: 'web';
  readonly range: number;
  readonly cooldown: number;
  readonly telegraph: number;
  readonly radius: number;
  readonly seconds: number;
}

/** Cone: a locked wedge in front of it, then a status for anyone inside (Supersonic). */
export interface ConeAttack {
  readonly kind: 'cone';
  readonly range: number;
  readonly cooldown: number;
  readonly telegraph: number;
  readonly reach: number;
  readonly arcDeg: number;
  readonly status: PlayerStatusId;
}

/** Pulse: a ring around itself (it stands still), then a status for anyone inside (Poison Powder cloud). */
export interface PulseAttack {
  readonly kind: 'pulse';
  readonly range: number;
  readonly cooldown: number;
  readonly telegraph: number;
  readonly radius: number;
  readonly status: PlayerStatusId;
  /** A powder: Grass starters shrug it off. */
  readonly powder: boolean;
}

/** Teleporter: a ring where it will appear (ahead of where you're walking), then it blinks there and pulses. */
export interface BlinkAttack {
  readonly kind: 'blink';
  readonly range: number;
  readonly cooldown: number;
  readonly telegraph: number;
  /** px ahead of your walking direction it lands (near you if you stand still). */
  readonly ahead: number;
  readonly radius: number;
  readonly damageFactor: number;
  readonly status: PlayerStatusId;
}

/** Exploder: close in, stop and fuse (ring; can't be stunned), then Self-Destruct. Killed while fusing: defused. */
export interface ExplodeAttack {
  readonly kind: 'explode';
  readonly range: number;
  readonly cooldown: number;
  readonly telegraph: number;
  readonly radius: number;
  readonly damageFactor: number;
}

/** Healer: keeps its distance behind the horde; a green ring, then it heals nearby enemies (not itself). */
export interface HealAttack {
  readonly kind: 'heal';
  readonly keepMin: number;
  readonly keepMax: number;
  readonly backOffMult: number;
  readonly range: number;
  readonly cooldown: number;
  readonly telegraph: number;
  readonly radius: number;
  readonly healPct: number;
}

export type EnemyAttack =
  | RangedAttack
  | ChargeAttack
  | DiveAttack
  | WebAttack
  | ConeAttack
  | PulseAttack
  | BlinkAttack
  | ExplodeAttack
  | HealAttack;

export const ENEMY_ATTACKS: Readonly<Partial<Record<EnemyId, EnemyAttack>>> = {
  // Spearow (ROSTER: P5 ranged, Peck dart).
  spearow: {
    kind: 'ranged',
    keepMin: 180,
    keepMax: 320,
    backOffMult: 0.7,
    range: 340,
    cooldown: 3,
    telegraph: 0.6,
    shotSpeed: 280,
    shotRadius: 6,
    shotLife: 2,
    damageFactor: 0.8,
  },
  // Tauros (ROSTER: bruiser, Take Down charge).
  tauros: {
    kind: 'charge',
    range: 320,
    cooldown: 5,
    telegraph: 0.9,
    dashDistance: 250,
    dashSpeedMult: 3,
    damageFactor: 1.5,
    recover: 0.4,
  },
  // Fearow (ROSTER: flanker + Diver, Drill Peck).
  fearow: { kind: 'dive', range: 350, cooldown: 6, telegraph: 1, radius: 38, damageFactor: 1.5, recover: 0.5 },

  // Batch 2 (ROSTER.md, owner-approved 2026-10-21; D37).
  caterpie: { kind: 'web', range: 280, cooldown: 6, telegraph: 0.7, radius: 34, seconds: 5 },
  zubat: { kind: 'cone', range: 150, cooldown: 6, telegraph: 0.7, reach: 102, arcDeg: 90, status: 'confusion' },
  oddish: { kind: 'pulse', range: 90, cooldown: 5, telegraph: 1, radius: 51, status: 'poison', powder: true },
  psyduck: {
    kind: 'ranged',
    keepMin: 180,
    keepMax: 320,
    backOffMult: 0.7,
    range: 340,
    cooldown: 3,
    telegraph: 0.6,
    shotSpeed: 260,
    shotRadius: 7,
    shotLife: 2,
    damageFactor: 0.8,
    status: 'soaked',
  },
  // Rollout: a long, fast roll (there are no walls on the map to bounce off).
  geodude: { kind: 'charge', range: 300, cooldown: 6, telegraph: 0.8, dashDistance: 300, dashSpeedMult: 4, damageFactor: 1.5, recover: 0.6 },
  abra: { kind: 'blink', range: 400, cooldown: 4, telegraph: 0.8, ahead: 180, radius: 51, damageFactor: 0.6, status: 'confusion' },
  voltorb: { kind: 'explode', range: 75, cooldown: 0, telegraph: 1.2, radius: 60, damageFactor: 3 },
  chansey: { kind: 'heal', keepMin: 200, keepMax: 300, backOffMult: 0.7, range: 1e9, cooldown: 5, telegraph: 0.8, radius: 140, healPct: 0.15 },
};

/** Budget for enemy darts in flight (README §9.3); past it, a shot is skipped. */
export const ENEMY_SHOT_CAP = 150;

/** Statuses an enemy's contact hit puts on you (Weedle's Poison Sting, Gastly's Lick). */
export const CONTACT_STATUS: Readonly<Partial<Record<EnemyId, PlayerStatusId>>> = { weedle: 'poison', gastly: 'paralysis' };

/** Phasers drift through other enemies: no push-apart (Gastly). */
export const PHASERS: ReadonlySet<EnemyId> = new Set<EnemyId>(['gastly']);

/** String Shot webs: how much they slow you while you stand in one, and how many can exist. */
export const WEB = { slow: 0.3, max: 8 } as const;
