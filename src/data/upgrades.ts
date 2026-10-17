// Normal level-up rewards: generic boosts and held items. All numbers provisional.

/** Percentages are fractions: 0.1 = 10%. */
export interface ModifierDelta {
  readonly damagePct?: number;
  /** Multiplicative: each pick multiplies cooldown by (1 − cooldownPct). */
  readonly cooldownPct?: number;
  readonly areaPct?: number;
  readonly durationPct?: number;
  readonly critChance?: number;
  readonly moveSpeedPct?: number;
  readonly pickupPct?: number;
  readonly maxHp?: number;
  readonly regenPerSec?: number;
}

export interface UpgradeDef<Id extends string> {
  readonly id: Id;
  readonly name: string;
  readonly description: string;
  readonly effect: ModifierDelta;
}

export type BoostId = 'hp' | 'damage' | 'cooldown' | 'speed' | 'pickup' | 'crit';
export type ItemId = 'leftovers' | 'quickClaw' | 'wideLens' | 'expShare';

/** Owner decision D9: each generic boost can be picked at most 5 times. */
export const BOOST_MAX_PICKS = 5;
export const MAX_ITEMS = 3;
/** Learnset moves on top of the signature move. */
export const MAX_LEARNSET_SLOTS = 4;
export const CARDS_PER_OFFER = 3;
/** Fallback card when nothing else can be offered. */
export const POTION_HEAL = 30;
export const CRIT_MULTIPLIER = 1.5;

export const BOOSTS: Readonly<Record<BoostId, UpgradeDef<BoostId>>> = {
  hp: { id: 'hp', name: 'Vitality', description: '+20 max HP', effect: { maxHp: 20 } },
  damage: { id: 'damage', name: 'Power', description: '+10% damage', effect: { damagePct: 0.1 } },
  cooldown: { id: 'cooldown', name: 'Haste', description: '−8% cooldown', effect: { cooldownPct: 0.08 } },
  speed: { id: 'speed', name: 'Agility', description: '+8% move speed', effect: { moveSpeedPct: 0.08 } },
  pickup: { id: 'pickup', name: 'Magnet', description: '+25% pickup radius', effect: { pickupPct: 0.25 } },
  crit: { id: 'crit', name: 'Focus', description: '+5% crit chance (×1.5 damage)', effect: { critChance: 0.05 } },
};

export const ITEMS: Readonly<Record<ItemId, UpgradeDef<ItemId>>> = {
  leftovers: { id: 'leftovers', name: 'Leftovers', description: 'Regenerate 1 HP/s', effect: { regenPerSec: 1 } },
  quickClaw: { id: 'quickClaw', name: 'Quick Claw', description: '−15% cooldown', effect: { cooldownPct: 0.15 } },
  wideLens: { id: 'wideLens', name: 'Wide Lens', description: '+25% area', effect: { areaPct: 0.25 } },
  expShare: { id: 'expShare', name: 'Exp. Share', description: '+50% pickup radius', effect: { pickupPct: 0.5 } },
};

export const BOOST_IDS = Object.keys(BOOSTS) as BoostId[];
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
