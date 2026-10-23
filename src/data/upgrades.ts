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

/** Natures (D40) plus the two filler boosts. */
export type BoostId = 'brave' | 'timid' | 'bold' | 'hasty' | 'hp' | 'pickup';
export type ItemId = 'leftovers' | 'quickClaw' | 'wideLens' | 'expShare';

export interface BoostDef extends UpgradeDef<BoostId> {
  /** Picks allowed per run; filler is uncapped. */
  readonly maxPicks: number;
  /** Filler shows up only when the normal-level pool is short (D40). */
  readonly filler: boolean;
}

/** D40: each Nature can be picked 3 times. */
export const NATURE_MAX_PICKS = 3;
export const MAX_ITEMS = 3;
/** Learnset moves on top of the signature move. */
export const MAX_LEARNSET_SLOTS = 4;
export const CARDS_PER_OFFER = 3;
/** Fallback card when nothing else can be offered. */
export const POTION_HEAL = 30;
export const CRIT_MULTIPLIER = 1.5;

const nature = (id: BoostId, name: string, description: string, effect: ModifierDelta): BoostDef => ({
  id,
  name,
  description,
  effect,
  maxPicks: NATURE_MAX_PICKS,
  filler: false,
});

/** Natures trade one stat for another (D40); Vitality and Magnet are filler. */
export const BOOSTS: Readonly<Record<BoostId, BoostDef>> = {
  brave: nature('brave', 'Brave', '+25% damage, −10% move speed', { damagePct: 0.25, moveSpeedPct: -0.1 }),
  timid: nature('timid', 'Timid', '+15% move speed, +25% pickup, −10% damage', { moveSpeedPct: 0.15, pickupPct: 0.25, damagePct: -0.1 }),
  bold: nature('bold', 'Bold', '+40 max HP, −10% damage', { maxHp: 40, damagePct: -0.1 }),
  hasty: nature('hasty', 'Hasty', '−15% cooldown, −20 max HP', { cooldownPct: 0.15, maxHp: -20 }),
  hp: { id: 'hp', name: 'Vitality', description: '+20 max HP', effect: { maxHp: 20 }, maxPicks: Infinity, filler: true },
  pickup: { id: 'pickup', name: 'Magnet', description: '+25% pickup radius', effect: { pickupPct: 0.25 }, maxPicks: Infinity, filler: true },
};

export const ITEMS: Readonly<Record<ItemId, UpgradeDef<ItemId>>> = {
  leftovers: { id: 'leftovers', name: 'Leftovers', description: 'Regenerate 1 HP/s', effect: { regenPerSec: 1 } },
  quickClaw: { id: 'quickClaw', name: 'Quick Claw', description: '−15% cooldown', effect: { cooldownPct: 0.15 } },
  wideLens: { id: 'wideLens', name: 'Wide Lens', description: '+25% area', effect: { areaPct: 0.25 } },
  expShare: { id: 'expShare', name: 'Exp. Share', description: '+50% pickup radius', effect: { pickupPct: 0.5 } },
};

/** Augment-level fallback when every socket is full and every augment is maxed. Not capped. */
export const BIG_BOOST: UpgradeDef<'bigBoost'> = {
  id: 'bigBoost',
  name: 'Power Surge',
  description: '+15% damage, +20 max HP',
  effect: { damagePct: 0.15, maxHp: 20 },
};

export const BOOST_IDS = Object.keys(BOOSTS) as BoostId[];
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
