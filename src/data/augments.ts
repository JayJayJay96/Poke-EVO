import type { MoveTag } from './content';

// Move augments (PROJECT.md §8, owner decisions D7/D8). All values provisional.

export type AugmentId =
  | 'powerUp'
  | 'quickCast'
  | 'enlarge'
  | 'extend'
  | 'keenEdge'
  | 'concentrated'
  | 'glass'
  | 'multishot'
  | 'scatter'
  | 'velocity';

/** Values are the totals at that rank, not increments. Percentages are fractions. */
export interface AugmentEffect {
  readonly damagePct?: number;
  /** Multiplies the move's cooldown. */
  readonly cooldownMult?: number;
  readonly areaPct?: number;
  readonly durationPct?: number;
  readonly critChance?: number;
  /** Extra projectiles per cast. */
  readonly extraCount?: number;
  readonly projectileSpeedPct?: number;
  /** Player-wide: extra damage taken from every hit. */
  readonly damageTakenPct?: number;
}

export interface AugmentRank {
  readonly effect: AugmentEffect;
  readonly text: string;
}

export interface AugmentDef {
  readonly id: AugmentId;
  readonly name: string;
  readonly kind: 'stat' | 'tradeoff';
  /** The move needs at least one of these tags; empty means any move. */
  readonly requiresAny: readonly MoveTag[];
  readonly ranks: readonly [AugmentRank, AugmentRank, AugmentRank];
}

export const MAX_SOCKETS = 3;
export const MAX_RANK = 3;
/** Every Nth level is an augment level (D7). */
export const AUGMENT_EVERY_N_LEVELS = 3;
export const REROLLS_PER_RUN = 2;

export const AUGMENTS: Readonly<Record<AugmentId, AugmentDef>> = {
  powerUp: {
    id: 'powerUp',
    name: 'Power Up',
    kind: 'stat',
    requiresAny: [],
    ranks: [
      { effect: { damagePct: 0.15 }, text: '+15% damage' },
      { effect: { damagePct: 0.3 }, text: '+30% damage' },
      { effect: { damagePct: 0.5 }, text: '+50% damage' },
    ],
  },
  quickCast: {
    id: 'quickCast',
    name: 'Quick Cast',
    kind: 'stat',
    requiresAny: [],
    ranks: [
      { effect: { cooldownMult: 0.9 }, text: '−10% cooldown' },
      { effect: { cooldownMult: 0.8 }, text: '−20% cooldown' },
      { effect: { cooldownMult: 0.7 }, text: '−30% cooldown' },
    ],
  },
  enlarge: {
    id: 'enlarge',
    name: 'Enlarge',
    kind: 'stat',
    requiresAny: [],
    ranks: [
      { effect: { areaPct: 0.2 }, text: '+20% area' },
      { effect: { areaPct: 0.4 }, text: '+40% area' },
      { effect: { areaPct: 0.6 }, text: '+60% area' },
    ],
  },
  extend: {
    id: 'extend',
    name: 'Extend',
    kind: 'stat',
    requiresAny: ['Projectile', 'Orbit', 'Beam'],
    ranks: [
      { effect: { durationPct: 0.25 }, text: '+25% duration' },
      { effect: { durationPct: 0.5 }, text: '+50% duration' },
      { effect: { durationPct: 0.8 }, text: '+80% duration' },
    ],
  },
  keenEdge: {
    id: 'keenEdge',
    name: 'Keen Edge',
    kind: 'stat',
    requiresAny: [],
    ranks: [
      { effect: { critChance: 0.1 }, text: '+10% crit chance' },
      { effect: { critChance: 0.2 }, text: '+20% crit chance' },
      { effect: { critChance: 0.3 }, text: '+30% crit chance' },
    ],
  },
  concentrated: {
    id: 'concentrated',
    name: 'Concentrated',
    kind: 'tradeoff',
    requiresAny: [],
    ranks: [
      { effect: { areaPct: -0.3, damagePct: 0.35 }, text: '−30% area, +35% damage' },
      { effect: { areaPct: -0.35, damagePct: 0.55 }, text: '−35% area, +55% damage' },
      { effect: { areaPct: -0.4, damagePct: 0.8 }, text: '−40% area, +80% damage' },
    ],
  },
  glass: {
    id: 'glass',
    name: 'Glass',
    kind: 'tradeoff',
    requiresAny: [],
    ranks: [
      { effect: { damagePct: 0.4, damageTakenPct: 0.1 }, text: '+40% damage, you take +10% damage' },
      { effect: { damagePct: 0.65, damageTakenPct: 0.15 }, text: '+65% damage, you take +15% damage' },
      { effect: { damagePct: 0.9, damageTakenPct: 0.2 }, text: '+90% damage, you take +20% damage' },
    ],
  },
  // Projectile augments pay for extra projectiles with cooldown (projectiles-per-second budget, §8.6).
  multishot: {
    id: 'multishot',
    name: 'Multishot',
    kind: 'stat',
    requiresAny: ['Projectile'],
    ranks: [
      { effect: { extraCount: 1, cooldownMult: 1.2 }, text: '+1 projectile, cooldown ×1.2' },
      { effect: { extraCount: 2, cooldownMult: 1.4 }, text: '+2 projectiles, cooldown ×1.4' },
      { effect: { extraCount: 4, cooldownMult: 1.8 }, text: '+4 projectiles, cooldown ×1.8' },
    ],
  },
  scatter: {
    id: 'scatter',
    name: 'Scatter',
    kind: 'tradeoff',
    requiresAny: ['Projectile'],
    ranks: [
      { effect: { extraCount: 3, damagePct: -0.3, cooldownMult: 2 }, text: '+3 projectiles, −30% damage, cooldown ×2' },
      { effect: { extraCount: 4, damagePct: -0.3, cooldownMult: 1.8 }, text: '+4 projectiles, −30% damage, cooldown ×1.8' },
      { effect: { extraCount: 5, damagePct: -0.3, cooldownMult: 1.6 }, text: '+5 projectiles, −30% damage, cooldown ×1.6' },
    ],
  },
  velocity: {
    id: 'velocity',
    name: 'Velocity',
    kind: 'stat',
    requiresAny: ['Projectile'],
    ranks: [
      { effect: { projectileSpeedPct: 0.3, damagePct: 0.05 }, text: '+30% projectile speed, +5% damage' },
      { effect: { projectileSpeedPct: 0.6, damagePct: 0.1 }, text: '+60% projectile speed, +10% damage' },
      { effect: { projectileSpeedPct: 1, damagePct: 0.15 }, text: '+100% projectile speed, +15% damage' },
    ],
  },
};

export const AUGMENT_IDS = Object.keys(AUGMENTS) as AugmentId[];
export const RANK_NUMERALS = ['I', 'II', 'III'] as const;
