import type { MoveTag } from './content';
import type { MoveId } from './moves';

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
  | 'velocity'
  | 'wideBlast'
  | 'linger'
  | 'blazeCore'
  | 'megaFlare'
  | 'pierce'
  | 'homing'
  | 'boomerang'
  | 'knockback'
  | 'burn'
  | 'lifesteal';

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
  /** Explosion and crater radius only. */
  readonly blastRadiusPct?: number;
  readonly zoneDurationPct?: number;
  readonly zoneDamagePct?: number;
  /** Extra damage at 0 HP, scaling linearly with missing HP (applied when the hit lands). */
  readonly missingHpDamagePct?: number;
  // Behaviour (🟡, §11.2): each changes how one projectile or hit behaves.
  /** Extra enemies a projectile passes through. */
  readonly pierce?: number;
  readonly homing?: boolean;
  /** Projectile flies out and back to the player, passing through enemies both ways. */
  readonly returns?: boolean;
  /** Push distance in px. */
  readonly knockback?: number;
  /** Burn damage per second as a fraction of the hit. */
  readonly burnPct?: number;
  /** Heal as a fraction of damage dealt. */
  readonly lifestealPct?: number;
}

export interface AugmentRank {
  readonly effect: AugmentEffect;
  readonly text: string;
}

export interface AugmentDef {
  readonly id: AugmentId;
  readonly name: string;
  /** 'behaviour' (and exclusives) count for the guaranteed card in each augment window (D11). */
  readonly kind: 'stat' | 'tradeoff' | 'behaviour';
  /** The move needs at least one of these tags; empty means any move. */
  readonly requiresAny: readonly MoveTag[];
  /** Signature-exclusive: only these moves can roll it (§8.2). */
  readonly exclusiveTo?: readonly MoveId[];
  /** 1–3 entries; the length is the augment's max rank (single-rank augments: §8.2a). */
  readonly ranks: readonly [AugmentRank, ...AugmentRank[]];
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
  wideBlast: {
    id: 'wideBlast',
    name: 'Wide Blast',
    kind: 'stat',
    requiresAny: ['Area'],
    ranks: [
      { effect: { blastRadiusPct: 0.25 }, text: '+25% blast radius' },
      { effect: { blastRadiusPct: 0.5 }, text: '+50% blast radius' },
      { effect: { blastRadiusPct: 0.8 }, text: '+80% blast radius' },
    ],
  },
  linger: {
    id: 'linger',
    name: 'Linger',
    kind: 'stat',
    requiresAny: ['Zone'],
    ranks: [
      { effect: { zoneDurationPct: 0.4 }, text: '+40% zone duration' },
      { effect: { zoneDurationPct: 0.8 }, text: '+80% zone duration' },
      { effect: { zoneDurationPct: 1.2 }, text: '+120% zone duration' },
    ],
  },
  // Charmander-line exclusives (D10).
  blazeCore: {
    id: 'blazeCore',
    name: 'Blaze Core',
    kind: 'stat',
    requiresAny: [],
    exclusiveTo: ['ember', 'flameBurst', 'blastBurn'],
    ranks: [
      { effect: { missingHpDamagePct: 0.3 }, text: 'Up to +30% damage as your HP drops' },
      { effect: { missingHpDamagePct: 0.5 }, text: 'Up to +50% damage as your HP drops' },
      { effect: { missingHpDamagePct: 0.8 }, text: 'Up to +80% damage as your HP drops' },
    ],
  },
  megaFlare: {
    id: 'megaFlare',
    name: 'Mega Flare',
    kind: 'stat',
    requiresAny: ['Zone'],
    exclusiveTo: ['blastBurn'],
    ranks: [
      {
        effect: { blastRadiusPct: 0.2, zoneDurationPct: 0.3, zoneDamagePct: 0.3 },
        text: 'Crater +20% size, +30% duration, +30% damage',
      },
      {
        effect: { blastRadiusPct: 0.35, zoneDurationPct: 0.5, zoneDamagePct: 0.5 },
        text: 'Crater +35% size, +50% duration, +50% damage',
      },
      {
        effect: { blastRadiusPct: 0.5, zoneDurationPct: 0.8, zoneDamagePct: 0.8 },
        text: 'Crater +50% size, +80% duration, +80% damage',
      },
    ],
  },
  // Behaviour augments (P3c, D10).
  pierce: {
    id: 'pierce',
    name: 'Pierce',
    kind: 'behaviour',
    requiresAny: ['Projectile'],
    ranks: [
      { effect: { pierce: 1 }, text: 'Passes through 1 enemy' },
      { effect: { pierce: 2 }, text: 'Passes through 2 enemies' },
      { effect: { pierce: 4 }, text: 'Passes through 4 enemies' },
    ],
  },
  homing: {
    id: 'homing',
    name: 'Homing',
    kind: 'behaviour',
    requiresAny: ['Projectile'],
    ranks: [{ effect: { homing: true }, text: 'Projectiles curve toward enemies' }],
  },
  boomerang: {
    id: 'boomerang',
    name: 'Return',
    kind: 'behaviour',
    requiresAny: ['Projectile'],
    // Hitting every enemy twice is strong, so it costs damage (D12, provisional).
    ranks: [
      {
        effect: { returns: true, damagePct: -0.3 },
        text: 'Flies out and back, passing through enemies both ways; −30% damage',
      },
    ],
  },
  knockback: {
    id: 'knockback',
    name: 'Knockback',
    kind: 'behaviour',
    requiresAny: ['Melee', 'Projectile'],
    ranks: [
      { effect: { knockback: 40 }, text: 'Knocks enemies back 40 px' },
      { effect: { knockback: 70 }, text: 'Knocks enemies back 70 px' },
      { effect: { knockback: 110 }, text: 'Knocks enemies back 110 px' },
    ],
  },
  burn: {
    id: 'burn',
    name: 'Burn',
    kind: 'behaviour',
    requiresAny: ['Fire'],
    ranks: [
      { effect: { burnPct: 0.2 }, text: 'Burns: 20% of the hit per second for 3 s' },
      { effect: { burnPct: 0.35 }, text: 'Burns: 35% of the hit per second for 3 s' },
      { effect: { burnPct: 0.5 }, text: 'Burns: 50% of the hit per second for 3 s' },
    ],
  },
  lifesteal: {
    id: 'lifesteal',
    name: 'Lifesteal',
    kind: 'behaviour',
    requiresAny: [],
    ranks: [
      { effect: { lifestealPct: 0.02 }, text: 'Heal 2% of damage dealt' },
      { effect: { lifestealPct: 0.04 }, text: 'Heal 4% of damage dealt' },
      { effect: { lifestealPct: 0.06 }, text: 'Heal 6% of damage dealt' },
    ],
  },
};

export const AUGMENT_IDS = Object.keys(AUGMENTS) as AugmentId[];

export function maxRankOf(id: AugmentId): number {
  return AUGMENTS[id].ranks.length;
}

/** Behaviour augments and signature exclusives: the cards each augment window guarantees. */
export function isSpecialAugment(id: AugmentId): boolean {
  const def = AUGMENTS[id];
  return def.kind === 'behaviour' || def.exclusiveTo !== undefined;
}
export const RANK_NUMERALS = ['I', 'II', 'III'] as const;
