// Game content as typed data. Every number here is provisional tuning (PROJECT.md).
import type { MoveId } from './moves';

export type PokemonType =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Grass'
  | 'Flying'
  | 'Dragon'
  | 'Poison'
  | 'Electric'
  | 'Ice'
  | 'Dark'
  | 'Steel';
export type FormTag = 'Projectile' | 'Area' | 'Beam' | 'Melee' | 'Aura' | 'Zone' | 'Orbit';
export type FlagTag = 'Slicing' | 'Punch' | 'Bite' | 'Pulse' | 'Sound' | 'Wind' | 'Ball' | 'Contact';
export type MoveTag = PokemonType | FormTag | FlagTag;

/** An evolution line, named after its first stage. */
export type PokemonId = 'charmander' | 'squirtle' | 'bulbasaur' | 'pikachu' | 'lapras';
export type EnemyId = 'rattata' | 'pidgey' | 'raticate' | 'spearow' | 'fearow' | 'tauros' | 'snorlax';
export type AbilityId =
  | 'blaze'
  | 'blazePlus'
  | 'solarPower'
  | 'shell'
  | 'torrentPlus'
  | 'rainDish'
  | 'leech'
  | 'overgrowPlus'
  | 'chlorophyll'
  | 'static'
  | 'staticPlus'
  | 'lightningRod'
  | 'shellArmor'
  // Evolved ability tiers (docs/moveset, D21): granted automatically at the line's middle stage.
  | 'shell.tidalGuard'
  | 'blaze.flareUp'
  | 'leech.bloom'
  | 'static.discharge';

/** One form of an evolution line. Later stages: bigger and stronger (D3 early-vs-late gamble). */
export interface EvolutionStage {
  readonly name: string;
  /** Level at which the run evolves into this stage (1 for the first stage). */
  readonly level: number;
  /** Pokémon types at this stage; moves matching one get STAB (D11). */
  readonly types: readonly PokemonType[];
  readonly maxHp: number;
  /** px per second. */
  readonly speed: number;
  readonly radius: number;
  /** Multiplies all of the player's damage. */
  readonly damageMult: number;
  /** Signature tier at this stage; replaces the previous tier in slot 0, keeping its augments. */
  readonly signatureMove: MoveId;
  /** If set, evolving into this stage asks the player to pick one of these traits (D11). */
  readonly abilityChoices?: readonly AbilityId[];
  /** Evolved ability tier this stage grants automatically (before any trait choice). */
  readonly ability?: AbilityId;
}

/** Non-evolver signature tier (§4): replaces the signature at this level, keeping its augments. */
export interface SignatureTier {
  readonly level: number;
  readonly move: MoveId;
}

/** A learnset move and the stage from which it can appear on cards. */
export interface LearnsetEntry {
  readonly move: MoveId;
  readonly fromStage: number;
}

export interface PokemonDef {
  readonly id: PokemonId;
  /** One line for the starter select screen. */
  readonly role: string;
  readonly stages: readonly EvolutionStage[];
  /** Starting trait. */
  readonly ability: AbilityId;
  /** Moves that can be offered on level-up cards. */
  readonly learnset: readonly LearnsetEntry[];
  /** Non-evolvers only (Lapras): signature tiers unlocked by level instead of by evolving. */
  readonly signatureTiers?: readonly SignatureTier[];
}

export interface AbilityDef {
  readonly id: AbilityId;
  readonly name: string;
  readonly description: string;
  /** Low-HP boost: active below this fraction of max HP. */
  readonly lowHpThreshold?: number;
  /** Extra damage while the low-HP boost is active, as a fraction. */
  readonly lowHpDamageBonus?: number;
  /** Always-on bonus for moves of one type. */
  readonly typeBoost?: { readonly type: PokemonType; readonly damagePct: number };
  /** HP lost per second; never drops the player below 1 HP. */
  readonly hpDrainPerSec?: number;
  /** Shell: blocks one contact hit, then recharges for this many seconds. */
  readonly blockEvery?: number;
  /** Change to damage taken (negative = less), e.g. Shell Armor −0.15. */
  readonly damageTakenPct?: number;
  /** Static: enemies touching the player are stunned for this many seconds. */
  readonly contactStun?: number;
  /** Leech: heal this fraction of all damage dealt. */
  readonly lifesteal?: number;
  readonly regenPerSec?: number;
  readonly moveSpeedPct?: number;
  /** Multiplicative cooldown cut, like a boost. */
  readonly cooldownPct?: number;
  /** Shell rework (Squirtle line): recharge cut by hits, pop ring, Shell Burst from Wartortle. */
  readonly shell?: ShellDef;
  /** Flare Up (Charmeleon+): a panic nova when a hit drops you low. */
  readonly flareUp?: FlareUpDef;
  /** The Bulb (Ivysaur+): overheal fills it; full, it Blooms. */
  readonly bulb?: BulbDef;
  /** Charge (Pikachu line): running fills it; full, a Charged shot or (Raichu) a Discharge. */
  readonly charge?: ChargeDef;
}

export interface ShellDef {
  /** Each hit taken while Shell is down cuts the recharge by this many seconds. */
  readonly rechargeCutPerHit: number;
  /** A block pops a ring that staggers (no damage). */
  readonly popRadius: number;
  readonly popStagger: number;
  /** Shell Burst every Nth block (Wartortle+): Water damage = max HP × fraction, stagger, Soak. */
  readonly burst?: {
    readonly every: number;
    readonly radius: number;
    readonly maxHpFraction: number;
    readonly stagger: number;
  };
  /** Rain Dish twist: each block heals this fraction of max HP. */
  readonly blockHealMaxHpFraction?: number;
}

export interface FlareUpDef {
  /** A hit that takes HP from at/above this fraction to below it erupts. */
  readonly threshold: number;
  readonly radius: number;
  /** Nova damage = the signature's hit damage × this. */
  readonly signatureHitMult: number;
  /** Burn per second as a fraction of the nova hit. */
  readonly burnFraction: number;
  readonly invulnSeconds: number;
  readonly cooldown: number;
  /** Solar Power twist: Scorch patches left in a ring. */
  readonly scorchRing?: number;
}

export interface BulbDef {
  readonly capacityMaxHpFraction: number;
  readonly bloomRadius: number;
  /** Bloom damage = stored amount × this. */
  readonly bloomMult: number;
  readonly bloomSlow: number;
  readonly bloomSlowSeconds: number;
  /** At most one Bloom per this many seconds. */
  readonly minInterval: number;
  /** Overgrow+ twist: dropping below `hpBelow` with the Bulb at least `minFill` full heals you with it. */
  readonly emergency?: { readonly hpBelow: number; readonly minFill: number; readonly cooldown: number };
}

export interface ChargeDef {
  readonly pxPerCharge: number;
  readonly perParalysis: number;
  readonly max: number;
  /** Pikachu: full Charge makes the next signature shot deal × this. */
  readonly chargedShotMult?: number;
  /** Raichu: full Charge releases a Discharge instead. */
  readonly discharge?: { readonly radius: number; readonly signatureHitMult: number; readonly paralyseSeconds: number };
}

export interface EnemyDef {
  readonly id: EnemyId;
  readonly name: string;
  readonly types: readonly PokemonType[];
  readonly maxHp: number;
  /** px per second. */
  readonly speed: number;
  readonly radius: number;
  readonly contactDamage: number;
  /** XP value of the gem it drops. */
  readonly xp: number;
  /** Chance to drop an Oran Berry on death (D12). */
  readonly berryChance: number;
  /** Real Pokédex weight; heavier enemies resist knockback (D14). */
  readonly weightKg: number;
  /** Bosses (P5): immune to trap / slip / drag and Blinded, half stagger (docs/moveset guard rails). */
  readonly boss?: boolean;
}

export const POKEMON: Readonly<Record<PokemonId, PokemonDef>> = {
  charmander: {
    id: 'charmander',
    role: 'Aggressive glass cannon: big fire blasts, risky low-HP power',
    // Stage numbers are provisional (D10, D11).
    stages: [
      {
        name: 'Charmander',
        level: 1,
        types: ['Fire'],
        maxHp: 100,
        speed: 153,
        radius: 12,
        damageMult: 1,
        signatureMove: 'ember',
      },
      {
        name: 'Charmeleon',
        ability: 'blaze.flareUp',
        level: 10,
        types: ['Fire'],
        maxHp: 140,
        speed: 160,
        radius: 15,
        damageMult: 1.15,
        signatureMove: 'flameBurst',
      },
      {
        name: 'Charizard',
        level: 25,
        types: ['Fire', 'Flying'],
        maxHp: 200,
        speed: 170,
        radius: 19,
        damageMult: 1.35,
        signatureMove: 'blastBurn',
        abilityChoices: ['blazePlus', 'solarPower'],
      },
    ],
    ability: 'blaze',
    // P2 subset (D9) + Charizard-only Flying moves (D11) + Smokescreen, Wing Attack and Slash (P4f-7, D15).
    learnset: [
      { move: 'scratch', fromStage: 0 },
      { move: 'fireSpin', fromStage: 0 },
      { move: 'dragonRage', fromStage: 0 },
      { move: 'smokescreen', fromStage: 0 },
      { move: 'wingAttack', fromStage: 0 },
      // Charmeleon grows real claws (D15: the kit rule 2 exception).
      { move: 'slash', fromStage: 1 },
      { move: 'airSlash', fromStage: 2 },
      { move: 'hurricane', fromStage: 2 },
    ],
  },
  // P4b (D13): tankier start than Charmander, lower damage, control tools. Numbers provisional.
  squirtle: {
    id: 'squirtle',
    role: 'Tank / control: slows, knockback, blocks hits',
    stages: [
      {
        name: 'Squirtle',
        level: 1,
        types: ['Water'],
        maxHp: 120,
        speed: 142,
        radius: 12,
        damageMult: 0.95,
        signatureMove: 'bubble',
      },
      {
        name: 'Wartortle',
        ability: 'shell.tidalGuard',
        level: 10,
        types: ['Water'],
        maxHp: 170,
        speed: 149,
        radius: 15,
        damageMult: 1.1,
        signatureMove: 'waterPulse',
      },
      {
        name: 'Blastoise',
        level: 25,
        types: ['Water'],
        maxHp: 250,
        speed: 159,
        radius: 20,
        damageMult: 1.7, // D19: 3-stage final forms out-damage Raichu and Lapras (was 1.3)
        signatureMove: 'hydroCannon',
        abilityChoices: ['torrentPlus', 'rainDish'],
      },
    ],
    ability: 'shell',
    // Redesigned to the kit rules (D14): mostly Water; Blastoise unlocks its cannons.
    learnset: [
      { move: 'withdraw', fromStage: 0 },
      { move: 'rapidSpin', fromStage: 0 },
      { move: 'waterGun', fromStage: 0 },
      { move: 'whirlpool', fromStage: 0 },
      { move: 'surf', fromStage: 0 },
      { move: 'hydroPump', fromStage: 2 },
      { move: 'flashCannon', fromStage: 2 },
    ],
  },
  // P4c (D13): sustain / zones / damage over time. Numbers provisional.
  bulbasaur: {
    id: 'bulbasaur',
    role: 'Sustain / zones: poison, sleep, roots, and healing',
    stages: [
      {
        name: 'Bulbasaur',
        level: 1,
        types: ['Grass', 'Poison'],
        maxHp: 110,
        speed: 143,
        radius: 12,
        damageMult: 0.95,
        signatureMove: 'vineWhip',
      },
      {
        name: 'Ivysaur',
        ability: 'leech.bloom',
        level: 10,
        types: ['Grass', 'Poison'],
        maxHp: 150,
        speed: 150,
        radius: 15,
        damageMult: 1.1,
        signatureMove: 'powerWhip',
      },
      {
        name: 'Venusaur',
        level: 25,
        types: ['Grass', 'Poison'],
        maxHp: 220,
        speed: 160,
        radius: 20,
        damageMult: 1.3,
        signatureMove: 'frenzyPlant',
        abilityChoices: ['overgrowPlus', 'chlorophyll'],
      },
    ],
    ability: 'leech',
    learnset: [
      { move: 'tackle', fromStage: 0 },
      { move: 'razorLeaf', fromStage: 0 },
      { move: 'leechSeed', fromStage: 0 },
      { move: 'poisonPowder', fromStage: 0 },
      { move: 'sleepPowder', fromStage: 0 },
      { move: 'sludge', fromStage: 0 },
      { move: 'petalDance', fromStage: 0 },
      { move: 'solarBeam', fromStage: 2 },
    ],
  },
  // P4d (D13): 2-stage gamble line. Medium start, evolves once at Lv 16. Numbers provisional.
  pikachu: {
    id: 'pikachu',
    role: 'Speed / chain: lightning that jumps, paralysis on touch',
    stages: [
      {
        name: 'Pikachu',
        level: 1,
        types: ['Electric'],
        maxHp: 105,
        speed: 165,
        radius: 11,
        damageMult: 1.05,
        signatureMove: 'thunderShock',
      },
      {
        name: 'Raichu',
        ability: 'static.discharge',
        level: 16,
        types: ['Electric'],
        maxHp: 170,
        speed: 175,
        radius: 15,
        damageMult: 1.25,
        signatureMove: 'thunderbolt',
        abilityChoices: ['staticPlus', 'lightningRod'],
      },
    ],
    ability: 'static',
    learnset: [
      { move: 'quickAttack', fromStage: 0 },
      { move: 'spark', fromStage: 0 },
      { move: 'electroBall', fromStage: 0 },
      { move: 'thunderWave', fromStage: 0 },
      { move: 'ironTail', fromStage: 0 },
      { move: 'thunder', fromStage: 1 },
    ],
  },
  // P4d (D13): non-evolver. Strongest from minute 1, no stat growth; the signature tiers up by level (D17).
  lapras: {
    id: 'lapras',
    role: 'Early bulldozer: strong and tough from the start, no evolution',
    stages: [
      {
        name: 'Lapras',
        level: 1,
        types: ['Water', 'Ice'],
        maxHp: 170,
        speed: 150,
        radius: 18,
        damageMult: 1.2,
        signatureMove: 'iceShard',
      },
    ],
    ability: 'shellArmor',
    // One signature step at Lv 25 (D17/D18): Ice Shard → Sheer Cold.
    signatureTiers: [{ level: 25, move: 'sheerCold' }],
    learnset: [
      { move: 'bodySlam', fromStage: 0 },
      { move: 'surf', fromStage: 0 },
      { move: 'iceBeam', fromStage: 0 },
      { move: 'hydroPump', fromStage: 0 },
    ],
  },
};

// Line mechanics and evolved tiers (docs/moveset/<line>/README.md, D21). Final traits keep the
// base ability and its evolved tier, and add their twist.
const SHELL: ShellDef = { rechargeCutPerHit: 1, popRadius: 50, popStagger: 20 };
const SHELL_BURST = { every: 3, radius: 120, maxHpFraction: 0.1, stagger: 25 } as const;
const TIDAL_GUARD: ShellDef = { ...SHELL, burst: SHELL_BURST };
const FLARE_UP: FlareUpDef = {
  threshold: 0.3,
  radius: 140,
  signatureHitMult: 3,
  burnFraction: 0.2,
  invulnSeconds: 1,
  cooldown: 25,
};
const BULB: BulbDef = {
  capacityMaxHpFraction: 0.4,
  bloomRadius: 140,
  // P4f-4 tuning: 1.5× / 3 s was +46% Venusaur DPS on the balance bot (the burst hits a crowd).
  bloomMult: 0.5,
  bloomSlow: 0.3,
  bloomSlowSeconds: 2,
  minInterval: 4,
};
const CHARGE: ChargeDef = { pxPerCharge: 20, perParalysis: 15, max: 100, chargedShotMult: 2 };
const DISCHARGE = { radius: 150, signatureHitMult: 3, paralyseSeconds: 0.4 } as const;
const RAICHU_CHARGE: ChargeDef = { pxPerCharge: 20, perParalysis: 15, max: 100, discharge: DISCHARGE };

export const ABILITIES: Readonly<Record<AbilityId, AbilityDef>> = {
  blaze: {
    id: 'blaze',
    name: 'Blaze',
    description: 'Below 30% HP: +50% damage',
    lowHpThreshold: 0.3,
    lowHpDamageBonus: 0.5,
  },
  'blaze.flareUp': {
    id: 'blaze.flareUp',
    name: 'Blaze — Flare Up',
    description: 'Blaze; a hit that drops you below 30% HP erupts a fire nova, 1 s invulnerable (every 25 s)',
    lowHpThreshold: 0.3,
    lowHpDamageBonus: 0.5,
    flareUp: FLARE_UP,
  },
  // Charizard trait choice (D11), each with a Flare Up twist.
  blazePlus: {
    id: 'blazePlus',
    name: 'Blaze+',
    description: 'Below 40% HP: +70% damage; Flare Up every 15 s',
    lowHpThreshold: 0.4,
    lowHpDamageBonus: 0.7,
    flareUp: { ...FLARE_UP, threshold: 0.4, cooldown: 15 },
  },
  solarPower: {
    id: 'solarPower',
    name: 'Solar Power',
    description: 'Fire moves +30% damage, lose 1 HP/s (never below 1); Flare Up +50% wider, leaves Scorch',
    typeBoost: { type: 'Fire', damagePct: 0.3 },
    hpDrainPerSec: 1,
    flareUp: { ...FLARE_UP, radius: FLARE_UP.radius * 1.5, scorchRing: 6 },
  },
  // P4 lines (D13). Final-stage traits keep the base ability and add to it.
  shell: {
    id: 'shell',
    name: 'Shell',
    description: 'Blocks one hit every 8 s (hits while down speed it up); a block pops a stagger ring',
    blockEvery: 8,
    shell: SHELL,
  },
  'shell.tidalGuard': {
    id: 'shell.tidalGuard',
    name: 'Shell — Tidal Guard',
    description: 'Shell; every 3rd block releases a Shell Burst',
    blockEvery: 8,
    shell: TIDAL_GUARD,
  },
  torrentPlus: {
    id: 'torrentPlus',
    name: 'Torrent+',
    description: 'Shell, below 40% HP: +70% damage; Shell Burst every 2nd block',
    blockEvery: 8,
    lowHpThreshold: 0.4,
    lowHpDamageBonus: 0.7,
    shell: { ...SHELL, burst: { ...SHELL_BURST, every: 2 } },
  },
  rainDish: {
    id: 'rainDish',
    name: 'Rain Dish',
    description: 'Shell, regenerate 1.5 HP/s; each block heals 3% of max HP',
    blockEvery: 8,
    regenPerSec: 1.5,
    shell: { ...TIDAL_GUARD, blockHealMaxHpFraction: 0.03 },
  },
  leech: { id: 'leech', name: 'Leech', description: 'Heal 3% of all damage dealt', lifesteal: 0.03 },
  'leech.bloom': {
    id: 'leech.bloom',
    name: 'Leech — Bulb Bloom',
    description: 'Leech; overheal fills the Bulb, which Blooms when full',
    lifesteal: 0.03,
    bulb: BULB,
  },
  overgrowPlus: {
    id: 'overgrowPlus',
    name: 'Overgrow+',
    description: 'Leech + Bulb, below 40% HP: +70% damage; a half-full Bulb heals you when you drop low (20 s)',
    lifesteal: 0.03,
    lowHpThreshold: 0.4,
    lowHpDamageBonus: 0.7,
    bulb: { ...BULB, emergency: { hpBelow: 0.4, minFill: 0.5, cooldown: 20 } },
  },
  chlorophyll: {
    id: 'chlorophyll',
    name: 'Chlorophyll',
    description: 'Leech + Bulb, +15% move speed, −10% cooldown; smaller Bulb (more Blooms)',
    lifesteal: 0.03,
    moveSpeedPct: 0.15,
    cooldownPct: 0.1,
    bulb: { ...BULB, capacityMaxHpFraction: BULB.capacityMaxHpFraction * 0.7 },
  },
  static: {
    id: 'static',
    name: 'Static',
    description: 'Touchers are paralysed 1 s; running fills Charge for a ×2 shot',
    contactStun: 1,
    charge: CHARGE,
  },
  'static.discharge': {
    id: 'static.discharge',
    name: 'Static — Discharge',
    description: 'Static; full Charge releases a Discharge around you',
    contactStun: 1,
    charge: RAICHU_CHARGE,
  },
  staticPlus: {
    id: 'staticPlus',
    name: 'Static+',
    description: 'Touchers are paralysed 2 s; each paralysis +30 Charge; Discharge',
    contactStun: 2,
    charge: { ...RAICHU_CHARGE, perParalysis: 30 },
  },
  lightningRod: {
    id: 'lightningRod',
    name: 'Lightning Rod',
    description: 'Static, Electric moves +30% damage; Discharge +40% wider',
    contactStun: 1,
    typeBoost: { type: 'Electric', damagePct: 0.3 },
    charge: { ...RAICHU_CHARGE, discharge: { ...DISCHARGE, radius: DISCHARGE.radius * 1.4 } },
  },
  shellArmor: { id: 'shellArmor', name: 'Shell Armor', description: 'Take 15% less damage', damageTakenPct: -0.15 },
};

export const ENEMIES: Readonly<Record<EnemyId, EnemyDef>> = {
  rattata: {
    id: 'rattata',
    name: 'Rattata',
    types: ['Normal'],
    maxHp: 20,
    speed: 75,
    radius: 10,
    contactDamage: 10,
    xp: 1,
    berryChance: 0.004,
    weightKg: 3.5,
  },
  // Stat-only variants until real archetype behaviours arrive in P5 (D9).
  pidgey: {
    id: 'pidgey',
    name: 'Pidgey',
    types: ['Normal', 'Flying'],
    maxHp: 12,
    speed: 115,
    radius: 9,
    contactDamage: 8,
    xp: 1,
    berryChance: 0.004,
    weightKg: 1.8,
  },
  raticate: {
    id: 'raticate',
    name: 'Raticate',
    types: ['Normal'],
    maxHp: 70,
    speed: 62,
    radius: 14,
    contactDamage: 16,
    xp: 6,
    berryChance: 0.3,
    weightKg: 18.5,
  },
  // Owner request 2026-10-20: tougher mobs that hit harder or run faster and pay more XP.
  // Stat-only like the others; capped below player speeds even after the wave speed scale.
  spearow: {
    id: 'spearow',
    name: 'Spearow',
    types: ['Normal', 'Flying'],
    maxHp: 22,
    speed: 120,
    radius: 10,
    contactDamage: 13,
    xp: 3,
    berryChance: 0.01,
    weightKg: 2,
  },
  fearow: {
    id: 'fearow',
    name: 'Fearow',
    types: ['Normal', 'Flying'],
    maxHp: 75,
    speed: 120,
    radius: 15,
    contactDamage: 24,
    xp: 12,
    berryChance: 0.25,
    weightKg: 38,
  },
  tauros: {
    id: 'tauros',
    name: 'Tauros',
    types: ['Normal'],
    maxHp: 180,
    speed: 88,
    radius: 17,
    contactDamage: 32,
    xp: 22,
    berryChance: 0.4,
    weightKg: 88.4,
  },
  // Arena boss (D28). Hand-set base, scaled by the wave curve when the fight starts; HP is a first guess
  // to tune toward BOSSES.md's 60–90 s fight. B1-1 is a plain chaser; its kit comes in B1-3 / B2.
  snorlax: {
    id: 'snorlax',
    name: 'Snorlax',
    types: ['Normal'],
    maxHp: 3000,
    speed: 75, // owner 2026-10-21: a little faster (was 55)
    radius: 40,
    contactDamage: 30,
    xp: 60,
    berryChance: 0,
    weightKg: 460,
    boss: true,
  },
};

export const TUNING = {
  stepSeconds: 1 / 60,
  /** Run length; reaching it is a victory until the final boss exists (D9). */
  runSeconds: 15 * 60,
  player: {
    invulnSeconds: 0.6,
    hurtFlashSeconds: 0.15,
    /** XP gems inside this radius get pulled in. */
    baseMagnetRadius: 64,
  },
  xp: {
    /** XP needed for level L → L+1 = base + linear·(L−1) + quadratic·(L−1)²; ~3.9k XP to reach Lv 40. */
    curve: { base: 5, linear: 3, quadratic: 0.08 },
    /** px per second for gems flying to the player; must beat player speed. */
    gemPullSpeed: 420,
    /** Extra reach beyond the player radius for collecting a gem. */
    collectPadding: 4,
    /** Budget: past this, new gem value merges into the oldest gem. */
    maxGems: 400,
    /** Uncollected gems vanish after this long, so the budget is rarely hit (owner 2026-10-20). */
    gemLifetimeSeconds: 60,
  },
  /** Magnet drop (owner 2026-10-20): walking over it pulls every gem within screen range once. */
  magnet: {
    dropChance: 0.01,
  },
  enemy: {
    hitFlashSeconds: 0.08,
    /** px per second of push when two enemies fully overlap. */
    separationStrength: 120,
  },
  spawn: {
    // Spawn rate and enemy mix live in waves.ts.
    maxEnemies: 300,
    /** Extra distance beyond the screen corner so spawns are never visible. */
    ringPadding: 48,
    /** Enemies farther than this × the spawn ring distance are moved ahead of the player. */
    recycleFactor: 1.5,
    /** Radians of spread around the facing direction when moving them (±60°). */
    recycleSpread: (2 * Math.PI) / 3,
  },
  spatialCellSize: 64,
  /** Same-type attack bonus: moves matching one of the Pokémon's types (D11). */
  stabBonus: 0.2,
  /** Knockback resistance = weight ÷ (weight + this many kg) (D14). */
  knockbackWeightK: 25,
  /** Oran Berry heal drops (D12): no flat regen; walk over a berry to heal. */
  heal: {
    berryHeal: 25,
    /** Extra reach beyond the player radius for picking a berry up. */
    pickupPadding: 6,
    /** Budget: new drops are skipped past this. */
    maxBerries: 12,
  },
  chain: {
    /** px from the last enemy hit to the next chain target. */
    range: 140,
  },
  status: {
    /** Slow and poison durations (the strength comes from the move). */
    slowSeconds: 1.5,
    poisonSeconds: 3,
    /** Leech Seed lasts this long; each tick heals the player this share of the damage dealt. */
    seedSeconds: 4,
    seedHealFraction: 0.5,
    burnSeconds: 3,
    /** DoT tick (budget §11.1: not every frame). */
    burnTick: 0.25,
    /** Knockback velocity decays by e^(−decay·t); total push ≈ the knockback distance. */
    knockbackDecay: 10,
    /** Blinded (D20): contact damage factor, and how far away the random point a blinded enemy wanders to is. */
    blindContactMult: 0.7,
    blindWanderPx: 150,
  },
  homing: {
    /** px around a projectile searched for a homing target. */
    range: 250,
    /** Max turn in radians per second. */
    turnRate: 6,
  },
  /** Performance budgets (PROJECT.md §11.1). */
  budget: {
    /** Past this, a cast spawns fewer projectiles that carry the missing damage. */
    maxProjectiles: 500,
    /** Lingering zones (craters); new ones are skipped past this. */
    maxZones: 40,
  },
} as const;
