import { POKEMON, TUNING } from '../data/content';
import {
  BOOST_IDS,
  BOOST_MAX_PICKS,
  CARDS_PER_OFFER,
  ITEM_IDS,
  MAX_ITEMS,
  MAX_LEARNSET_SLOTS,
  POTION_HEAL,
} from '../data/upgrades';
import { createSlot, refreshStats } from './stats';
import type { Card, LevelUpOffer, World } from './types';

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  const n = level - 1;
  const { base, linear, quadratic } = TUNING.xp.curve;
  return Math.round(base + linear * n + quadratic * n * n);
}

export function gainXp(world: World, amount: number): void {
  world.xp += amount;
  while (world.xp >= xpToNext(world.level)) {
    world.xp -= xpToNext(world.level);
    world.level++;
    world.pendingLevelUps++;
  }
}

/** Every card the player could be offered right now. */
export function buildCardPool(world: World): Card[] {
  const pool: Card[] = [];
  const learnsetOwned = world.moves.length - 1; // slot 0 is the signature move
  if (learnsetOwned < MAX_LEARNSET_SLOTS) {
    for (const moveId of POKEMON[world.player.pokemonId].learnset) {
      if (!world.moves.some((slot) => slot.moveId === moveId)) pool.push({ kind: 'move', moveId });
    }
  }
  for (const boostId of BOOST_IDS) {
    if (world.boosts[boostId] < BOOST_MAX_PICKS) pool.push({ kind: 'boost', boostId });
  }
  if (world.items.length < MAX_ITEMS) {
    for (const itemId of ITEM_IDS) {
      if (!world.items.includes(itemId)) pool.push({ kind: 'item', itemId });
    }
  }
  return pool;
}

/** Up to 3 distinct random cards; a Potion when nothing is left to offer. */
export function makeOffer(world: World): LevelUpOffer {
  const pool = buildCardPool(world);
  if (pool.length === 0) return { cards: [{ kind: 'potion' }] };
  const cards: Card[] = [];
  while (cards.length < CARDS_PER_OFFER && pool.length > 0) {
    const index = Math.floor(world.rng.next() * pool.length);
    cards.push(pool.splice(index, 1)[0]!);
  }
  return { cards };
}

/** Applies the chosen card, then queues the next offer if more level-ups are waiting. */
export function chooseCard(world: World, index: number): void {
  const card = world.offer?.cards[index];
  if (!card) return;
  switch (card.kind) {
    case 'move':
      world.moves.push(createSlot(card.moveId));
      break;
    case 'boost':
      world.boosts[card.boostId]++;
      break;
    case 'item':
      world.items.push(card.itemId);
      break;
    case 'potion':
      world.player.hp = Math.min(world.player.maxHp, world.player.hp + POTION_HEAL);
      break;
  }
  refreshStats(world);
  world.pendingLevelUps = Math.max(0, world.pendingLevelUps - 1);
  world.offer = world.pendingLevelUps > 0 ? makeOffer(world) : null;
}
