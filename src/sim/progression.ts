import {
  AUGMENT_EVERY_N_LEVELS,
  AUGMENT_IDS,
  AUGMENTS,
  MAX_SOCKETS,
  isSpecialAugment,
  maxRankOf,
} from '../data/augments';
import { POKEMON, TUNING } from '../data/content';
import { MOVES } from '../data/moves';
import { MUTATION_RANKS, MUTATIONS, type MutationDef } from '../data/mutations';
import {
  BOOST_IDS,
  BOOST_MAX_PICKS,
  CARDS_PER_OFFER,
  MAX_LEARNSET_SLOTS,
  POTION_HEAL,
} from '../data/upgrades';
import { learnsetSlotsUsed } from './combo';
import { emit, healPlayer } from './hooks';
import { socketsUsed } from './mutations';
import type { Rng } from './rng';
import { createSlot, refreshStats } from './stats';
import type { AugmentCard, Card, DrawnAugments, LevelUpOffer, World } from './types';

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
    emit(world, 'levelUp', 1);
  }
}

export function isAugmentLevel(level: number): boolean {
  return level % AUGMENT_EVERY_N_LEVELS === 0;
}

/** The level whose reward is being chosen right now (several can be queued). */
export function resolvingLevel(world: World): number {
  return world.level - world.pendingLevelUps + 1;
}

/** Every normal-level card the player could be offered right now: learnset moves and boosts (D23). */
export function buildCardPool(world: World): Card[] {
  const pool: Card[] = [];
  const learnsetOwned = learnsetSlotsUsed(world); // slot 0 is the signature move; combo members free theirs
  if (learnsetOwned < MAX_LEARNSET_SLOTS) {
    for (const { move, fromStage } of POKEMON[world.player.pokemonId].learnset) {
      // Stage-gated moves (Charizard's Flying moves, D11) appear only from their stage.
      if (fromStage > world.player.stage) continue;
      if (!world.moves.some((slot) => slot.moveId === move)) pool.push({ kind: 'move', moveId: move });
    }
  }
  for (const boostId of BOOST_IDS) {
    if (world.boosts[boostId] < BOOST_MAX_PICKS) pool.push({ kind: 'boost', boostId });
  }
  // Held items come only from Mutation Sites now (D23).
  return pool;
}

/**
 * Augments a move could take now: the next rank of each socketed augment below its
 * max rank, plus every unowned augment its tags allow. When all sockets are full, picking
 * a new one replaces a socket (D11).
 */
export function augmentPool(world: World, slotIndex: number): AugmentCard[] {
  const slot = world.moves[slotIndex];
  if (!slot) return [];
  const tags = MOVES[slot.moveId].tags;
  const pool: AugmentCard[] = [];
  for (const socket of slot.sockets) {
    if (socket.rank < maxRankOf(socket.augmentId)) pool.push({ augmentId: socket.augmentId, rank: socket.rank + 1 });
  }
  const excluded = slot.mutation ? (MUTATIONS[slot.mutation] as MutationDef).excludesAugments : undefined;
  for (const id of AUGMENT_IDS) {
    if (slot.sockets.some((s) => s.augmentId === id) || excluded?.includes(id)) continue;
    const { requiresAny, exclusiveTo } = AUGMENTS[id];
    if (requiresAny.length > 0 && !requiresAny.some((tag) => tags.includes(tag))) continue;
    if (exclusiveTo && !exclusiveTo.includes(slot.moveId)) continue;
    pool.push({ augmentId: id, rank: 1 });
  }
  return pool;
}

/** True when choosing this card needs a socket to be replaced. */
export function needsReplace(world: World, slotIndex: number, card: AugmentCard): boolean {
  const slot = world.moves[slotIndex];
  if (!slot) return false;
  const owned = slot.sockets.some((s) => s.augmentId === card.augmentId);
  return !owned && socketsUsed(slot) >= MAX_SOCKETS;
}

/** Up to `count` distinct random entries; `weight` biases the draw (uniform without it). */
function draw<T>(rng: Rng, items: readonly T[], count: number, weight?: (item: T) => number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    let i = 0;
    if (weight) {
      let roll = rng.next() * pool.reduce((sum, item) => sum + weight(item), 0);
      for (; i < pool.length - 1 && roll >= weight(pool[i]!); i++) roll -= weight(pool[i]!);
    } else {
      i = Math.floor(rng.next() * pool.length);
    }
    picked.push(pool.splice(i, 1)[0]!);
  }
  return picked;
}

/** True when `augmentId` is one of the favoured augments of the Mutation on this move (D24). */
export function isFavoured(world: World, slotIndex: number, augmentId: AugmentCard['augmentId']): boolean {
  const mutation = world.moves[slotIndex]?.mutation;
  return Boolean(mutation && (MUTATIONS[mutation] as MutationDef).favoured?.includes(augmentId));
}

/**
 * The offer for the next queued level-up. Every 3rd level is an augment level
 * (pick a move first); otherwise 3 normal cards. Fallbacks: Power Surge on an augment
 * level with nothing left to augment, Potion on a normal level with nothing left.
 */
export function makeOffer(world: World): LevelUpOffer {
  if (isAugmentLevel(resolvingLevel(world))) {
    const slots = world.moves.map((_, i) => i).filter((i) => augmentPool(world, i).length > 0);
    if (slots.length > 0) return { kind: 'pickSkill', slots, drawn: {} };
    return { kind: 'cards', cards: [{ kind: 'bigBoost' }] };
  }
  const pool = buildCardPool(world);
  if (pool.length === 0) return { kind: 'cards', cards: [{ kind: 'potion' }] };
  return { kind: 'cards', cards: draw(world.rng, pool, CARDS_PER_OFFER) };
}

/**
 * 3 distinct augment cards for a move. At least one is a behaviour/exclusive augment
 * (new or rank-up) whenever the pool has one (D11), so those builds actually show up.
 */
export function drawAugmentCards(world: World, slotIndex: number): AugmentCard[] {
  const pool = augmentPool(world, slotIndex);
  // Favoured augments (new or rank-up) are drawn ×3 as often (D24).
  const weight = (card: AugmentCard) =>
    isFavoured(world, slotIndex, card.augmentId) ? MUTATION_RANKS.favouredOfferWeight : 1;
  const special = pool.filter((card) => isSpecialAugment(card.augmentId));
  const cards: AugmentCard[] = [];
  if (special.length > 0) cards.push(...draw(world.rng, special, 1, weight));
  const rest = pool.filter((card) => !cards.includes(card));
  cards.push(...draw(world.rng, rest, CARDS_PER_OFFER - cards.length, weight));
  // Shuffle so the guaranteed card isn't always in the first position.
  return draw(world.rng, cards, cards.length);
}

/** Window 2 for a move, reusing the cards already dealt to it this level (D12). */
export function makeAugmentOffer(
  world: World,
  slotIndex: number,
  skills: readonly number[] = [slotIndex],
  drawn: DrawnAugments = {},
): LevelUpOffer {
  const cards = drawn[slotIndex] ?? drawAugmentCards(world, slotIndex);
  drawn[slotIndex] = cards;
  return { kind: 'augment', slot: slotIndex, cards, skills, drawn };
}

/** Normal level: applies the chosen card. */
export function chooseCard(world: World, index: number): void {
  const offer = world.offer;
  if (offer?.kind !== 'cards') return;
  const card = offer.cards[index];
  if (!card) return;
  applyCard(world, card);
  completeLevelUp(world);
}

/** Applies a normal-level card (also used by arena rewards, D28). */
export function applyCard(world: World, card: Card): void {
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
      healPlayer(world, POTION_HEAL);
      break;
    case 'bigBoost':
      world.bigBoosts++;
      break;
  }
}

/** Augment level, window 1: picks the move and opens its augment cards. */
export function chooseSkill(world: World, index: number): void {
  const offer = world.offer;
  if (offer?.kind !== 'pickSkill') return;
  const slotIndex = offer.slots[index];
  if (slotIndex === undefined) return;
  world.offer = makeAugmentOffer(world, slotIndex, offer.slots, offer.drawn);
}

/** Augment level, window 2: Back to choosing a move (D12). */
export function backToSkills(world: World): void {
  const offer = world.offer;
  if (offer?.kind !== 'augment') return;
  world.offer = { kind: 'pickSkill', slots: offer.skills, drawn: offer.drawn };
}

export function canReroll(world: World): boolean {
  const offer = world.offer;
  if (offer?.kind !== 'augment' || world.rerollsLeft <= 0) return false;
  // Pointless when every possible card is already on screen.
  return augmentPool(world, offer.slot).length > offer.cards.length;
}

export function rerollAugments(world: World): boolean {
  const offer = world.offer;
  if (offer?.kind !== 'augment' || !canReroll(world)) return false;
  world.rerollsLeft--;
  const cards = drawAugmentCards(world, offer.slot);
  offer.drawn[offer.slot] = cards; // Back + re-pick shows the rerolled cards, not the old ones
  world.offer = { ...offer, cards };
  return true;
}

/**
 * Augment level, window 2: ranks up an owned augment in place or sockets a new one.
 * A new augment on a full move opens the replace window instead (D11).
 */
export function chooseAugment(world: World, index: number): void {
  const offer = world.offer;
  if (offer?.kind !== 'augment') return;
  const card = offer.cards[index];
  const slot = world.moves[offer.slot];
  if (!card || !slot) return;
  const owned = slot.sockets.find((s) => s.augmentId === card.augmentId);
  if (owned) {
    owned.rank = card.rank;
  } else if (needsReplace(world, offer.slot, card)) {
    world.offer = {
      kind: 'replace',
      slot: offer.slot,
      card,
      cards: offer.cards,
      skills: offer.skills,
      drawn: offer.drawn,
    };
    return;
  } else {
    slot.sockets.push({ augmentId: card.augmentId, rank: 1 });
  }
  completeLevelUp(world);
}

/** Ranks up an owned augment or sockets a new one in a free socket; never replaces (arena rewards, D28). */
export function applyAugmentCard(world: World, slotIndex: number, card: AugmentCard): void {
  const slot = world.moves[slotIndex];
  if (!slot) return;
  const owned = slot.sockets.find((s) => s.augmentId === card.augmentId);
  if (owned) owned.rank = card.rank;
  else if (!needsReplace(world, slotIndex, card)) slot.sockets.push({ augmentId: card.augmentId, rank: 1 });
}

/** Replace window: the new augment takes this socket at rank I; the old one is gone. */
export function chooseReplace(world: World, socketIndex: number): void {
  const offer = world.offer;
  if (offer?.kind !== 'replace') return;
  const slot = world.moves[offer.slot];
  if (!slot) return;
  if (!slot.sockets[socketIndex]) return;
  slot.sockets[socketIndex] = { augmentId: offer.card.augmentId, rank: 1 };
  completeLevelUp(world);
}

/** Replace window: back to the same augment cards (no reroll spent). */
export function backFromReplace(world: World): void {
  const offer = world.offer;
  if (offer?.kind !== 'replace') return;
  world.offer = { kind: 'augment', slot: offer.slot, cards: offer.cards, skills: offer.skills, drawn: offer.drawn };
}

function completeLevelUp(world: World): void {
  refreshStats(world);
  world.pendingLevelUps = Math.max(0, world.pendingLevelUps - 1);
  world.offer = world.pendingLevelUps > 0 ? makeOffer(world) : null;
}
