// Legendary Boons (D49): beating an arena boss offers 3 boons themed on it; ★ (`clears`) is always one of them.
// All numbers provisional. "Signature damage" = the signature move's current damage, so boons grow with the build.
/** The boss a boon comes from. Its own union, so boons can be written for bosses still being built. */
export type BoonBoss = 'snorlax' | 'zapdos' | 'machamp' | 'articuno';

export type BoonId =
  | 'bodySlamQuake'
  | 'thickFat'
  | 'gluttony'
  | 'dynamicPunch'
  | 'bulkUp'
  | 'guts'
  | 'thunderCall'
  | 'tailwind'
  | 'chargeBeam'
  | 'blizzardAura'
  | 'mist'
  | 'sheerCold';

export interface BoonDef {
  readonly id: BoonId;
  readonly name: string;
  readonly boss: BoonBoss;
  /** Display name of that boss ("from Articuno"). */
  readonly bossName: string;
  /** The boss's horde-clearer: always one of its 3 cards. */
  readonly clears: boolean;
  readonly description: string;
}

export const BOON_TUNING = {
  bodySlamQuake: { every: 8, radius: 180, damage: 1.5, push: 70 },
  thickFat: { maxHpPct: 0.4, restAfterSeconds: 2 },
  gluttony: { dropMult: 2, healMult: 2 },
  dynamicPunch: { everyCasts: 5, radius: 120, damage: 1, range: 420 },
  bulkUp: { kills: 25, seconds: 6, damagePct: 0.6 },
  guts: { belowHp: 0.4, damagePct: 0.35, speedPct: 0.2 },
  thunderCall: { every: 8, strikes: 3, radius: 90, damage: 2, stun: 0.5, searchRadius: 700 },
  tailwind: { moveSpeedPct: 0.2, pickupPct: 0.25, cooldownPct: 0.08 },
  chargeBeam: { casts: 20, mult: 3 },
  blizzardAura: { radius: 160, slow: 0.35, dpsFactor: 0.4, tick: 0.5 },
  mist: { every: 30, invulnSeconds: 0.6 },
  sheerCold: { belowHp: 0.15 },
} as const;

const BOSS_NAMES: Readonly<Record<BoonBoss, string>> = { snorlax: 'Snorlax', zapdos: 'Zapdos', machamp: 'Machamp', articuno: 'Articuno' };

const boon = (id: BoonId, name: string, boss: BoonBoss, clears: boolean, description: string): BoonDef => ({
  id,
  name,
  boss,
  bossName: BOSS_NAMES[boss],
  clears,
  description,
});

export const BOONS: Readonly<Record<BoonId, BoonDef>> = {
  bodySlamQuake: boon('bodySlamQuake', 'Body Slam Quake', 'snorlax', true, 'Every 8 s, a shockwave around you (180 px) deals 150% signature damage and knocks enemies back'),
  thickFat: boon('thickFat', 'Thick Fat', 'snorlax', false, '+40% max HP; rest regen starts after 2 s instead of 5'),
  gluttony: boon('gluttony', 'Gluttony', 'snorlax', false, 'Oran Berries drop twice as often and heal twice as much'),
  dynamicPunch: boon('dynamicPunch', 'Dynamic Punch', 'machamp', true, "Every 5th cast of each move also slams the nearest enemy's area (120 px) for 100% of that move's damage"),
  bulkUp: boon('bulkUp', 'Bulk Up', 'machamp', false, 'Every 25 KOs: 6 s of +60% damage'),
  guts: boon('guts', 'Guts', 'machamp', false, 'Below 40% HP: +35% damage and +20% move speed'),
  thunderCall: boon('thunderCall', 'Thunder Call', 'zapdos', true, 'Every 8 s, lightning hits the 3 densest enemy clusters (90 px) for 200% signature damage and a 0.5 s paralysis (bosses immune)'),
  tailwind: boon('tailwind', 'Tailwind', 'zapdos', false, '+20% move speed, +25% pickup range, −8% cooldowns'),
  chargeBeam: boon('chargeBeam', 'Charge Beam', 'zapdos', false, 'Every cast adds a charge; at 20, your next cast deals ×3'),
  blizzardAura: boon('blizzardAura', 'Blizzard Aura', 'articuno', true, 'A 160 px ring around you slows enemies 35% and deals 40% signature damage per second'),
  mist: boon('mist', 'Mist', 'articuno', false, 'Once every 30 s, a hit on you is ignored'),
  sheerCold: boon('sheerCold', 'Sheer Cold', 'articuno', false, 'Your hits instantly KO slowed non-boss enemies below 15% HP'),
};

export const BOON_IDS = Object.keys(BOONS) as BoonId[];

/** The boss's boons, ★ first. */
export function boonsOf(boss: string): BoonId[] {
  return BOON_IDS.filter((id) => BOONS[id].boss === boss).sort((a, b) => Number(BOONS[b].clears) - Number(BOONS[a].clears));
}
