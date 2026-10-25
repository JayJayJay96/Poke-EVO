import { POKEMON } from '../data/content';
import { MUTATION_IDS, MUTATIONS, type MutationDef } from '../data/mutations';
import { SITE_TUNING } from '../data/sites';
import { ITEM_IDS, MAX_ITEMS, MAX_LEARNSET_SLOTS } from '../data/upgrades';
import { grantMutation, isBuilt, mutationOffers, mutationRankUps, requirementMet, type GrantResult } from './mutations';
import { learnsetSlotsUsed } from './combo';
import { clearSpot, siteSlot } from './map';
import { healPlayer } from './hooks';
import { createSeededRng, type Rng } from './rng';
import { refreshStats } from './stats';
import type { MutationSite, SiteCard, World } from './types';

// Mutation Sites (D16, D23): the only source of Mutations and held items.
// The endless map is split into chunks; each chunk's site is decided (seeded by the run's map
// seed) when the player first comes near, so exploring further finds more. Standing in a site
// rolls its cards once; it opens after 5 s, or 8 s when the roll holds a Pokémon-bound Mutation.

/** Chunk index for a world coordinate; chunk (0, 0) is centred on the start. */
function chunkOf(v: number): number {
  return Math.floor(v / SITE_TUNING.chunkSize + 0.5);
}

/** Deterministic per-chunk RNG: the same map seed always lays out the same sites. */
function chunkRng(mapSeed: number, cx: number, cy: number): Rng {
  return createSeededRng((Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ mapSeed) >>> 0);
}

/** Which of the 8 chunks around the start always holds a site. */
function guaranteedChunk(mapSeed: number): [number, number] {
  const ring: [number, number][] = [
    [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];
  const pick = Math.floor(createSeededRng((mapSeed ^ 0x9e3779b9) >>> 0).next() * ring.length);
  return ring[pick]!;
}

/** Decides one chunk's site the first time it comes into range. */
function generateChunk(world: World, cx: number, cy: number): void {
  const key = `${cx},${cy}`;
  if (world.siteChunks.has(key)) return;
  world.siteChunks.add(key);
  if (cx === 0 && cy === 0) return; // never right on the start
  const rng = chunkRng(world.mapSeed, cx, cy);
  const [gx, gy] = guaranteedChunk(world.mapSeed);
  const guaranteed = SITE_TUNING.guaranteeNearStart && cx === gx && cy === gy;
  if (rng.next() >= SITE_TUNING.chance && !guaranteed) return;
  const { chunkSize, edgeMargin } = SITE_TUNING;
  const span = chunkSize - 2 * edgeMargin;
  const rx = (cx - 0.5) * chunkSize + edgeMargin + rng.next() * span;
  const ry = (cy - 0.5) * chunkSize + edgeMargin + rng.next() * span;
  // The chunk's set piece may reserve the spot (D47 M2); otherwise a random one, nudged clear of obstacles.
  const { x, y } = siteSlot(world, cx, cy) ?? clearSpot(world, rx, ry, SITE_TUNING.radius);
  world.sites.push({
    id: world.nextId++,
    x,
    y,
    radius: SITE_TUNING.radius,
    progress: 0,
    required: SITE_TUNING.captureSeconds,
    cards: null,
    bound: false,
  });
}

function generateAround(world: World): void {
  const px = chunkOf(world.player.x);
  const py = chunkOf(world.player.y);
  const r = SITE_TUNING.generateChunks;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) generateChunk(world, px + dx, py + dy);
}

/** Mutations for learnset moves not owned yet; taking one learns the move (needs a free slot). */
function learnableMutations(world: World): SiteCard[] {
  if (learnsetSlotsUsed(world) >= MAX_LEARNSET_SLOTS) return [];
  const { pokemonId, stage } = world.player;
  const cards: SiteCard[] = [];
  for (const { move, fromStage } of POKEMON[pokemonId].learnset) {
    if (fromStage > stage || world.moves.some((slot) => slot.moveId === move)) continue;
    for (const id of MUTATION_IDS) {
      const def: MutationDef = MUTATIONS[id];
      if (def.move !== move || def.kind === 'signature' || !isBuilt(id)) continue;
      if (def.line && def.line !== pokemonId) continue;
      if (stage < def.fromStage) continue;
      if (def.requires?.some((req) => !requirementMet(world, req))) continue;
      cards.push({ kind: 'mutation', mutationId: id, learn: true });
    }
  }
  return cards;
}

/** Up to `count` distinct random entries, removed from `pool`. */
function take<T>(rng: Rng, pool: T[], count: number): T[] {
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) picked.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!);
  return picked;
}

/**
 * A site's cards: Mutations for owned moves, rank-ups for the Mutations held (D24), Mutations that
 * teach a learnset move, and held items not owned. At least one Mutation and one item when available;
 * a heal and a timed Power Surge if nothing is eligible (D25).
 */
export function rollSiteCards(world: World): SiteCard[] {
  const { rng } = world;
  const mutations: SiteCard[] = [
    ...mutationOffers(world).map((mutationId): SiteCard => ({ kind: 'mutation', mutationId, learn: false })),
    ...mutationRankUps(world).map(({ mutationId, rank }): SiteCard => ({ kind: 'mutationRank', mutationId, rank })),
    ...learnableMutations(world),
  ];
  const items: SiteCard[] =
    world.items.length < MAX_ITEMS
      ? ITEM_IDS.filter((id) => !world.items.includes(id)).map((itemId): SiteCard => ({ kind: 'item', itemId }))
      : [];
  const cards = [...take(rng, mutations, 1), ...take(rng, items, 1)];
  cards.push(...take(rng, [...mutations, ...items], SITE_TUNING.cards - cards.length));
  if (cards.length === 0) return [{ kind: 'surge' }];
  return take(rng, cards, cards.length); // shuffle so the guaranteed cards aren't always first
}

/** A Bond or signature Mutation (or its rank-up): bound to the player's Pokémon (D23: longer capture). */
export function isBoundCard(card: SiteCard): boolean {
  return (card.kind === 'mutation' || card.kind === 'mutationRank') && MUTATIONS[card.mutationId].kind !== 'generic';
}

function isInside(world: World, site: MutationSite): boolean {
  const dx = world.player.x - site.x;
  const dy = world.player.y - site.y;
  return dx * dx + dy * dy <= site.radius * site.radius;
}

/**
 * Generates sites near the player and advances capture. The first step inside rolls the cards;
 * a full capture opens the site window (pauses the sim like level-up cards).
 */
export function updateSites(world: World, dt: number): void {
  generateAround(world);
  for (const site of world.sites) {
    if (!isInside(world, site)) {
      site.progress = Math.max(0, site.progress - SITE_TUNING.drainPerSecond * dt);
      continue;
    }
    if (!site.cards) {
      site.cards = rollSiteCards(world);
      site.bound = site.cards.some(isBoundCard);
      site.required = SITE_TUNING.captureSeconds + (site.bound ? SITE_TUNING.boundExtraSeconds : 0);
    }
    site.progress += dt;
    if (site.progress >= site.required && !world.offer) {
      world.offer = { kind: 'site', siteId: site.id, cards: site.cards };
      return;
    }
  }
}

function closeSite(world: World): SiteCard[] | null {
  const offer = world.offer;
  if (offer?.kind !== 'site') return null;
  world.sites = world.sites.filter((s) => s.id !== offer.siteId);
  world.offer = null;
  return [...offer.cards];
}

/** Takes a site card; the site is used up. Mutations never touch augment sockets (D24). */
export function chooseSiteCard(world: World, index: number): GrantResult | 'item' | 'surge' | null {
  const offer = world.offer;
  if (offer?.kind !== 'site' || !offer.cards[index]) return null;
  return applySiteCard(world, closeSite(world)![index]!);
}

/** Applies a site card (also used by arena rewards, D28). */
export function applySiteCard(world: World, card: SiteCard): GrantResult | 'item' | 'surge' {
  switch (card.kind) {
    case 'mutation':
    case 'mutationRank':
      return grantMutation(world, card.mutationId);
    case 'item':
      world.items.push(card.itemId);
      refreshStats(world);
      return 'item';
    case 'surge':
      healPlayer(world, SITE_TUNING.surge.heal);
      world.surgeLeft = SITE_TUNING.surge.seconds;
      refreshStats(world);
      return 'surge';
  }
}

/** Leaves the site's cards; the site is used up. */
export function skipSite(world: World): void {
  closeSite(world);
}
