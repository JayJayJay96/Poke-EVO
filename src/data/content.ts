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
export type EnemyId = 'rattata' | 'pidgey' | 'raticate';
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
  | 'shellArmor';

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
    // P2 subset (D9) + Charizard-only Flying moves (D11). Smokescreen, Wing Attack and Slash come later.
    learnset: [
      { move: 'scratch', fromStage: 0 },
      { move: 'fireSpin', fromStage: 0 },
      { move: 'dragonRage', fromStage: 0 },
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
        damageMult: 1.3,
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

export const ABILITIES: Readonly<Record<AbilityId, AbilityDef>> = {
  blaze: {
    id: 'blaze',
    name: 'Blaze',
    description: 'Below 30% HP: +50% damage',
    lowHpThreshold: 0.3,
    lowHpDamageBonus: 0.5,
  },
  // Charizard trait choice (D11).
  blazePlus: {
    id: 'blazePlus',
    name: 'Blaze+',
    description: 'Below 40% HP: +70% damage',
    lowHpThreshold: 0.4,
    lowHpDamageBonus: 0.7,
  },
  solarPower: {
    id: 'solarPower',
    name: 'Solar Power',
    description: 'Fire moves +30% damage, but lose 1 HP/s (never below 1)',
    typeBoost: { type: 'Fire', damagePct: 0.3 },
    hpDrainPerSec: 1,
  },
  // P4 lines (D13). Final-stage traits keep the base ability and add to it.
  shell: { id: 'shell', name: 'Shell', description: 'Blocks one hit every 8 s', blockEvery: 8 },
  torrentPlus: {
    id: 'torrentPlus',
    name: 'Torrent+',
    description: 'Shell, and below 40% HP: +70% damage',
    blockEvery: 8,
    lowHpThreshold: 0.4,
    lowHpDamageBonus: 0.7,
  },
  rainDish: {
    id: 'rainDish',
    name: 'Rain Dish',
    description: 'Shell, and regenerate 1.5 HP/s',
    blockEvery: 8,
    regenPerSec: 1.5,
  },
  leech: { id: 'leech', name: 'Leech', description: 'Heal 3% of all damage dealt', lifesteal: 0.03 },
  overgrowPlus: {
    id: 'overgrowPlus',
    name: 'Overgrow+',
    description: 'Leech, and below 40% HP: +70% damage',
    lifesteal: 0.03,
    lowHpThreshold: 0.4,
    lowHpDamageBonus: 0.7,
  },
  chlorophyll: {
    id: 'chlorophyll',
    name: 'Chlorophyll',
    description: 'Leech, +15% move speed, −10% cooldown',
    lifesteal: 0.03,
    moveSpeedPct: 0.15,
    cooldownPct: 0.1,
  },
  static: { id: 'static', name: 'Static', description: 'Enemies touching you are paralysed for 1 s', contactStun: 1 },
  staticPlus: {
    id: 'staticPlus',
    name: 'Static+',
    description: 'Enemies touching you are paralysed for 2 s',
    contactStun: 2,
  },
  lightningRod: {
    id: 'lightningRod',
    name: 'Lightning Rod',
    description: 'Static, and Electric moves +30% damage',
    contactStun: 1,
    typeBoost: { type: 'Electric', damagePct: 0.3 },
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
