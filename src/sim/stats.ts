import { AUGMENTS } from '../data/augments';
import { ABILITIES, POKEMON, TUNING, type AbilityId, type EvolutionStage, type PokemonType } from '../data/content';
import { MOVES, type MoveDef, type MoveId } from '../data/moves';
import { moveType } from '../data/typeChart';
import {
  BIG_BOOST,
  BOOST_IDS,
  BOOSTS,
  ITEMS,
  type BoostId,
  type ItemId,
  type ModifierDelta,
} from '../data/upgrades';
import { MUTATION_RANKS, MUTATIONS, type MutationDef } from '../data/mutations';
import { hooksOf } from './hooks';
import type { AugmentSocket, Modifiers, MoveSlot, MoveStats, World } from './types';

/** Floors so stacked trade-offs can never zero out a move. */
const MIN_DAMAGE_FACTOR = 0.1;
const MIN_AREA_FACTOR = 0.2;

export function currentStage(world: World): EvolutionStage {
  return POKEMON[world.player.pokemonId].stages[world.player.stage]!;
}

export function emptyModifiers(): Modifiers {
  return {
    damageMult: 1,
    cooldownMult: 1,
    areaMult: 1,
    durationMult: 1,
    critChance: 0,
    moveSpeedMult: 1,
    pickupMult: 1,
    maxHpBonus: 0,
    regenPerSec: 0,
    damageTakenMult: 1,
  };
}

/** Sums boosts (per pick), held items and Power Surges into one set of modifiers. */
export function computeModifiers(
  boosts: Readonly<Record<BoostId, number>>,
  items: readonly ItemId[],
  bigBoosts = 0,
): Modifiers {
  const m = emptyModifiers();
  const add = (d: ModifierDelta, times: number): void => {
    if (times <= 0) return;
    m.damageMult += (d.damagePct ?? 0) * times;
    m.cooldownMult *= Math.pow(1 - (d.cooldownPct ?? 0), times);
    m.areaMult += (d.areaPct ?? 0) * times;
    m.durationMult += (d.durationPct ?? 0) * times;
    m.critChance += (d.critChance ?? 0) * times;
    m.moveSpeedMult += (d.moveSpeedPct ?? 0) * times;
    m.pickupMult += (d.pickupPct ?? 0) * times;
    m.maxHpBonus += (d.maxHp ?? 0) * times;
    m.regenPerSec += (d.regenPerSec ?? 0) * times;
  };
  for (const id of BOOST_IDS) add(BOOSTS[id].effect, boosts[id]);
  for (const id of items) add(ITEMS[id].effect, 1);
  add(BIG_BOOST.effect, bigBoosts);
  return m;
}

/** Who is using the move: Pokémon types for STAB and the current trait (D11). */
export interface UserContext {
  readonly types: readonly PokemonType[];
  readonly ability: AbilityId;
}

/** Damage factor from STAB and type-based traits (Solar Power) for this move. */
export function typeDamageFactor(def: MoveDef, user: UserContext | undefined): number {
  if (!user) return 1;
  let factor = 1;
  if (user.types.some((type) => def.tags.includes(type))) factor += TUNING.stabBonus;
  const boost = ABILITIES[user.ability].typeBoost;
  if (boost && def.tags.includes(boost.type)) factor += boost.damagePct;
  return factor;
}

/** Effective numbers for one move: base × build-wide modifiers × its own augments × type factors. */
export function computeMoveStats(
  def: MoveDef,
  m: Modifiers,
  sockets: readonly AugmentSocket[] = [],
  user?: UserContext,
): MoveStats {
  let damagePct = 0;
  let cooldownMult = 1;
  let areaPct = 0;
  let durationPct = 0;
  let critChance = 0;
  let extraCount = 0;
  let speedPct = 0;
  let blastRadiusPct = 0;
  let zoneDurationPct = 0;
  let zoneDamagePct = 0;
  let missingHpBonus = 0;
  let pierce = 0;
  let homing = false;
  let returns = false;
  let knockback = 0;
  let burnPct = 0;
  let lifesteal = 0;
  for (const socket of sockets) {
    const e = AUGMENTS[socket.augmentId].ranks[socket.rank - 1].effect;
    damagePct += e.damagePct ?? 0;
    cooldownMult *= e.cooldownMult ?? 1;
    areaPct += e.areaPct ?? 0;
    durationPct += e.durationPct ?? 0;
    critChance += e.critChance ?? 0;
    extraCount += e.extraCount ?? 0;
    speedPct += e.projectileSpeedPct ?? 0;
    blastRadiusPct += e.blastRadiusPct ?? 0;
    zoneDurationPct += e.zoneDurationPct ?? 0;
    zoneDamagePct += e.zoneDamagePct ?? 0;
    missingHpBonus += e.missingHpDamagePct ?? 0;
    pierce += e.pierce ?? 0;
    homing ||= e.homing ?? false;
    returns ||= e.returns ?? false;
    knockback += e.knockback ?? 0;
    burnPct += e.burnPct ?? 0;
    lifesteal += e.lifestealPct ?? 0;
  }
  return {
    damage: def.damage * m.damageMult * Math.max(MIN_DAMAGE_FACTOR, 1 + damagePct) * typeDamageFactor(def, user),
    cooldown: def.cooldown * m.cooldownMult * cooldownMult,
    area: m.areaMult * Math.max(MIN_AREA_FACTOR, 1 + areaPct),
    duration: m.durationMult * (1 + durationPct),
    critChance: Math.min(1, m.critChance + critChance + (def.critChance ?? 0)),
    extraCount,
    speedMult: 1 + speedPct,
    blastRadiusMult: 1 + blastRadiusPct,
    zoneDurationMult: 1 + zoneDurationPct,
    zoneDamageMult: 1 + zoneDamagePct,
    missingHpBonus,
    pierce,
    homing,
    returns,
    burnPct,
    lifesteal,
    // Innate knockback (Squirtle line) stacks with the Knockback augment.
    knockback: knockback + (def.onHit?.knockback ?? 0),
    slow: def.onHit?.slow ?? 0,
    stun: def.onHit?.stun ?? 0,
    stunKind: def.onHit?.stunKind ?? null,
    poisonPct: def.onHit?.poisonPct ?? 0,
    seedPct: def.onHit?.seedPct ?? 0,
    attackType: moveType(def.tags),
    reachMult: 1,
    orbitRadiusMult: 1,
    arcMult: 1,
    spinMult: 1,
    widthMult: 1,
  };
}

export function createSlot(moveId: MoveId): MoveSlot {
  const stats = computeMoveStats(MOVES[moveId], emptyModifiers());
  return {
    moveId,
    cooldownLeft: 0,
    activeLeft: 0,
    angle: 0,
    dirX: 1,
    dirY: 0,
    tickLeft: 0,
    hitCooldowns: new Map(),
    sockets: [],
    mutation: null,
    mutationRank: 0,
    anchored: false,
    anchorX: 0,
    anchorY: 0,
    mutState: {},
    stats,
    baseStats: { ...stats },
  };
}

/** Recomputes cached modifiers, player stats and every move's stats. Call after any build change. */
export function refreshStats(world: World): void {
  const m = computeModifiers(world.boosts, world.items, world.bigBoosts);
  // Glass is a move augment with a player-wide cost.
  for (const slot of world.moves) {
    for (const socket of slot.sockets) {
      m.damageTakenMult += AUGMENTS[socket.augmentId].ranks[socket.rank - 1].effect.damageTakenPct ?? 0;
    }
  }
  const p = world.player;
  const stage = currentStage(world);
  m.damageMult *= stage.damageMult;
  // Ability effects that act like build-wide modifiers (P4a).
  const ability = ABILITIES[p.ability];
  m.damageTakenMult = Math.max(0.1, m.damageTakenMult + (ability.damageTakenPct ?? 0));
  m.regenPerSec += ability.regenPerSec ?? 0;
  m.moveSpeedMult += ability.moveSpeedPct ?? 0;
  m.cooldownMult *= 1 - (ability.cooldownPct ?? 0);
  world.mods = m;
  const newMax = stage.maxHp + m.maxHpBonus;
  // Gaining max HP (boosts or evolving) also heals by the same amount.
  p.hp = Math.min(newMax, p.hp + Math.max(0, newMax - p.maxHp));
  p.maxHp = newMax;
  p.speed = stage.speed * m.moveSpeedMult;
  p.radius = stage.radius;
  p.pickupRadius = TUNING.player.baseMagnetRadius * m.pickupMult;
  const user: UserContext = { types: stage.types, ability: p.ability };
  for (const slot of world.moves) {
    slot.stats = computeMoveStats(MOVES[slot.moveId], m, slot.sockets, user);
    // Leech: the ability's lifesteal applies to every move.
    slot.stats.lifesteal += ability.lifesteal ?? 0;
    hooksOf(slot)?.stats?.(slot.stats, world, slot);
    // D24 placeholder for Mutations without their own rank values yet.
    if (slot.mutation && !(MUTATIONS[slot.mutation] as MutationDef).ranks) {
      slot.stats.damage *= MUTATION_RANKS.placeholderDamageMult[slot.mutationRank - 1] ?? 1;
    }
    slot.baseStats = { ...slot.stats };
  }
}
