import { POKEMON, TUNING } from '../data/content';
import { MOVES, type MoveDef, type MoveId } from '../data/moves';
import { BOOST_IDS, BOOSTS, ITEMS, type BoostId, type ItemId, type ModifierDelta } from '../data/upgrades';
import type { Modifiers, MoveSlot, MoveStats, World } from './types';

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
  };
}

/** Sums boosts (per pick) and held items into one set of modifiers. */
export function computeModifiers(boosts: Readonly<Record<BoostId, number>>, items: readonly ItemId[]): Modifiers {
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
  return m;
}

/** Effective numbers for one move. Augments plug in here in P2c. */
export function computeMoveStats(def: MoveDef, m: Modifiers): MoveStats {
  return {
    damage: def.damage * m.damageMult,
    cooldown: def.cooldown * m.cooldownMult,
    area: m.areaMult,
    duration: m.durationMult,
    critChance: Math.min(1, m.critChance),
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
    stats: computeMoveStats(MOVES[moveId], emptyModifiers()),
  };
}

/** Recomputes cached modifiers, player stats and every move's stats. Call after any build change. */
export function refreshStats(world: World): void {
  const m = computeModifiers(world.boosts, world.items);
  world.mods = m;
  const def = POKEMON[world.player.pokemonId];
  const p = world.player;
  const newMax = def.maxHp + m.maxHpBonus;
  // Gaining max HP also heals by the same amount.
  p.hp = Math.min(newMax, p.hp + Math.max(0, newMax - p.maxHp));
  p.maxHp = newMax;
  p.speed = def.speed * m.moveSpeedMult;
  p.pickupRadius = TUNING.player.baseMagnetRadius * m.pickupMult;
  for (const slot of world.moves) slot.stats = computeMoveStats(MOVES[slot.moveId], m);
}
