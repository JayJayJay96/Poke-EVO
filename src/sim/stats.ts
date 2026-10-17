import { AUGMENTS } from '../data/augments';
import { POKEMON, TUNING } from '../data/content';
import { MOVES, type MoveDef, type MoveId } from '../data/moves';
import {
  BIG_BOOST,
  BOOST_IDS,
  BOOSTS,
  ITEMS,
  type BoostId,
  type ItemId,
  type ModifierDelta,
} from '../data/upgrades';
import type { AugmentSocket, Modifiers, MoveSlot, MoveStats, World } from './types';

/** Floors so stacked trade-offs can never zero out a move. */
const MIN_DAMAGE_FACTOR = 0.1;
const MIN_AREA_FACTOR = 0.2;

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

/** Effective numbers for one move: base × build-wide modifiers × its own augments. */
export function computeMoveStats(def: MoveDef, m: Modifiers, sockets: readonly AugmentSocket[] = []): MoveStats {
  let damagePct = 0;
  let cooldownMult = 1;
  let areaPct = 0;
  let durationPct = 0;
  let critChance = 0;
  let extraCount = 0;
  let speedPct = 0;
  for (const socket of sockets) {
    const e = AUGMENTS[socket.augmentId].ranks[socket.rank - 1].effect;
    damagePct += e.damagePct ?? 0;
    cooldownMult *= e.cooldownMult ?? 1;
    areaPct += e.areaPct ?? 0;
    durationPct += e.durationPct ?? 0;
    critChance += e.critChance ?? 0;
    extraCount += e.extraCount ?? 0;
    speedPct += e.projectileSpeedPct ?? 0;
  }
  return {
    damage: def.damage * m.damageMult * Math.max(MIN_DAMAGE_FACTOR, 1 + damagePct),
    cooldown: def.cooldown * m.cooldownMult * cooldownMult,
    area: m.areaMult * Math.max(MIN_AREA_FACTOR, 1 + areaPct),
    duration: m.durationMult * (1 + durationPct),
    critChance: Math.min(1, m.critChance + critChance),
    extraCount,
    speedMult: 1 + speedPct,
  };
}

export function createSlot(moveId: MoveId): MoveSlot {
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
    stats: computeMoveStats(MOVES[moveId], emptyModifiers()),
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
  world.mods = m;
  const def = POKEMON[world.player.pokemonId];
  const p = world.player;
  const newMax = def.maxHp + m.maxHpBonus;
  // Gaining max HP also heals by the same amount.
  p.hp = Math.min(newMax, p.hp + Math.max(0, newMax - p.maxHp));
  p.maxHp = newMax;
  p.speed = def.speed * m.moveSpeedMult;
  p.pickupRadius = TUNING.player.baseMagnetRadius * m.pickupMult;
  for (const slot of world.moves) slot.stats = computeMoveStats(MOVES[slot.moveId], m, slot.sockets);
}
