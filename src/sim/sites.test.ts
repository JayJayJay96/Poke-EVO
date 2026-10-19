import { describe, expect, it } from 'vitest';
import { POKEMON, TUNING } from '../data/content';
import { MUTATION_IDS, MUTATION_RANKS, MUTATIONS, type MutationDef } from '../data/mutations';
import { SITE_TUNING } from '../data/sites';
import { ITEM_IDS, MAX_ITEMS, MAX_LEARNSET_SLOTS } from '../data/upgrades';
import { restoreBuild, snapshotBuild } from './buildSnapshot';
import { isBuilt } from './mutations';
import { createSeededRng } from './rng';
import { chooseSiteCard, isBoundCard, rollSiteCards, skipSite, updateSites } from './sites';
import { createSlot, refreshStats } from './stats';
import type { MutationSite, World } from './types';
import { createWorld, step } from './world';

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };

function makeWorld(mapSeed = 1, seed = 1): World {
  return createWorld({ rng: createSeededRng(seed), spawnEnabled: false, mapSeed });
}

function standOn(world: World, site: MutationSite): void {
  world.player.x = site.x;
  world.player.y = site.y;
}

/** Steps until the site window opens (or the time runs out); returns seconds stood. */
function capture(world: World, seconds: number): number {
  let t = 0;
  while (t < seconds && !world.offer) {
    step(world, IDLE, DT);
    t += DT;
  }
  return t;
}

describe('Mutation Sites: placement (D23)', () => {
  it('the same map seed lays out the same sites; another seed lays out different ones', () => {
    const layout = (mapSeed: number) => {
      const world = makeWorld(mapSeed);
      updateSites(world, DT);
      return world.sites.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`).sort();
    };
    expect(layout(7)).toEqual(layout(7));
    expect(layout(7)).not.toEqual(layout(8));
  });

  it('always puts one site in the chunks around the start, never on the start itself', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const world = makeWorld(seed);
      updateSites(world, DT);
      const size = SITE_TUNING.chunkSize;
      const near = world.sites.filter((s) => Math.max(Math.abs(s.x), Math.abs(s.y)) < 1.5 * size);
      expect(near.length).toBeGreaterThanOrEqual(1);
      expect(world.sites.every((s) => Math.max(Math.abs(s.x), Math.abs(s.y)) >= size / 2)).toBe(true);
    }
  });

  it('decides chunks only as the player comes near, so exploring finds more', () => {
    const world = makeWorld(3);
    updateSites(world, DT);
    const chunksAtStart = world.siteChunks.size;
    expect(chunksAtStart).toBe((2 * SITE_TUNING.generateChunks + 1) ** 2);
    world.player.x = 10 * SITE_TUNING.chunkSize;
    updateSites(world, DT);
    expect(world.siteChunks.size).toBeGreaterThan(chunksAtStart);
    // Roughly `chance` of the decided chunks hold a site (plus the guaranteed one).
    const ratio = world.sites.length / world.siteChunks.size;
    expect(ratio).toBeGreaterThan(0.1);
    expect(ratio).toBeLessThan(0.7);
  });
});

describe('Mutation Sites: capture (D23)', () => {
  it('rolls on the first step inside, opens after 5 s (8 s if Pokémon-bound), and keeps the roll', () => {
    let sawBound = false;
    let sawPlain = false;
    for (let seed = 1; seed <= 30 && !(sawBound && sawPlain); seed++) {
      const world = makeWorld(seed, seed);
      updateSites(world, DT);
      const site = world.sites[0]!;
      expect(site.cards).toBeNull();
      standOn(world, site);
      step(world, IDLE, DT);
      const cards = site.cards!;
      expect(cards.length).toBeGreaterThan(0);
      expect(site.bound).toBe(cards.some(isBoundCard));
      expect(site.required).toBe(SITE_TUNING.captureSeconds + (site.bound ? SITE_TUNING.boundExtraSeconds : 0));
      if (site.bound) sawBound = true;
      else sawPlain = true;
      const stood = capture(world, 10);
      expect(world.offer?.kind).toBe('site');
      expect(stood).toBeCloseTo(site.required - DT, 1);
      if (world.offer?.kind === 'site') expect(world.offer.cards).toBe(cards);
    }
    expect(sawBound).toBe(true);
    expect(sawPlain).toBe(true);
  });

  it('progress drains outside the ring; the roll stays the same when you come back', () => {
    const world = makeWorld(2);
    updateSites(world, DT);
    const site = world.sites[0]!;
    standOn(world, site);
    capture(world, 2);
    const cards = site.cards;
    expect(site.progress).toBeCloseTo(2, 1);
    world.player.x += 500;
    for (let i = 0; i < 60; i++) step(world, IDLE, DT);
    expect(site.progress).toBeCloseTo(1, 1);
    standOn(world, site);
    step(world, IDLE, DT);
    expect(site.cards).toBe(cards);
  });

  it('the run pauses while the site window is open; picking or skipping uses the site up', () => {
    const world = makeWorld(4);
    updateSites(world, DT);
    const site = world.sites[0]!;
    standOn(world, site);
    capture(world, 10);
    const time = world.time;
    step(world, IDLE, DT);
    expect(world.time).toBe(time);
    skipSite(world);
    expect(world.offer).toBeNull();
    expect(world.sites.some((s) => s.id === site.id)).toBe(false);
  });
});

describe('Mutation Sites: cards (D23)', () => {
  it('5 distinct cards with at least one Mutation and one item, all eligible', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const world = makeWorld(1, seed);
      const cards = rollSiteCards(world);
      expect(cards).toHaveLength(SITE_TUNING.cards);
      expect(new Set(cards.map((c) => JSON.stringify(c))).size).toBe(cards.length);
      expect(cards.some((c) => c.kind === 'mutation')).toBe(true);
      expect(cards.some((c) => c.kind === 'item')).toBe(true);
      for (const card of cards) {
        if (card.kind !== 'mutation') continue;
        const def: MutationDef = MUTATIONS[card.mutationId];
        expect(isBuilt(card.mutationId)).toBe(true);
        if (def.line) expect(def.line).toBe('charmander');
        expect(def.fromStage).toBeLessThanOrEqual(world.player.stage);
        // Learn cards are for learnset moves not owned yet; the rest sit on owned moves.
        const owned = world.moves.some((s) => s.moveId === def.move) || def.kind === 'signature';
        expect(card.learn).toBe(!owned);
      }
    }
  });

  it('no item cards once all 3 item slots are full', () => {
    const world = makeWorld();
    world.items = ITEM_IDS.slice(0, MAX_ITEMS);
    for (let i = 0; i < 10; i++) expect(rollSiteCards(world).some((c) => c.kind === 'item')).toBe(false);
  });

  it('falls back to a heal and a timed Power Surge when nothing is eligible (D25)', () => {
    const world = makeWorld();
    const mutationFor = (move: string, signature: boolean) =>
      MUTATION_IDS.find((id) => {
        const def: MutationDef = MUTATIONS[id];
        return def.move === move && (def.kind === 'signature') === signature && (!def.line || def.line === 'charmander');
      })!;
    // Every Mutation at the top rank (D24), or the site would offer rank-ups.
    world.moves[0]!.mutation = mutationFor(world.moves[0]!.moveId, true);
    world.moves[0]!.mutationRank = MUTATION_RANKS.max;
    for (const { move } of POKEMON.charmander.learnset.filter((e) => e.fromStage === 0).slice(0, MAX_LEARNSET_SLOTS)) {
      const slot = createSlot(move);
      slot.mutation = mutationFor(move, false);
      slot.mutationRank = MUTATION_RANKS.max;
      world.moves.push(slot);
    }
    world.items = ITEM_IDS.slice(0, MAX_ITEMS);
    refreshStats(world);
    expect(rollSiteCards(world)).toEqual([{ kind: 'surge' }]);
    // Taking it: heal, +15% damage for 30 s, a second one refreshes rather than stacks; then it wears off.
    world.player.hp = 10;
    const base = world.mods.damageMult;
    const surge = SITE_TUNING.surge;
    for (const _ of [1, 2]) {
      world.offer = { kind: 'site', siteId: 999, cards: [{ kind: 'surge' }] };
      expect(chooseSiteCard(world, 0)).toBe('surge');
      expect(world.mods.damageMult).toBeCloseTo(base + surge.damagePct);
    }
    expect(world.player.hp).toBe(10 + 2 * surge.heal);
    expect(world.bigBoosts).toBe(0);
    world.spawnEnabled = false;
    for (let t = 0; t < surge.seconds + 0.1; t += TUNING.stepSeconds) step(world, { moveX: 0, moveY: 0 }, TUNING.stepSeconds);
    expect(world.surgeLeft).toBe(0);
    expect(world.mods.damageMult).toBeCloseTo(base);
  });

  it('a learn card teaches the move with its Mutation; an item card fills a slot', () => {
    const world = makeWorld();
    const learn = MUTATION_IDS.find((id) => {
      const def: MutationDef = MUTATIONS[id];
      return isBuilt(id) && def.kind === 'generic' && def.move === 'scratch';
    })!;
    world.offer = {
      kind: 'site',
      siteId: 999,
      cards: [{ kind: 'mutation', mutationId: learn, learn: true }, { kind: 'item', itemId: 'leftovers' }],
    };
    expect(chooseSiteCard(world, 0)).toBe('granted');
    expect(world.moves.find((s) => s.moveId === 'scratch')?.mutation).toBe(learn);
    world.offer = { kind: 'site', siteId: 998, cards: [{ kind: 'item', itemId: 'leftovers' }] };
    expect(chooseSiteCard(world, 0)).toBe('item');
    expect(world.items).toEqual(['leftovers']);
  });
});

describe('build snapshot (D23)', () => {
  it('round-trips a build through JSON onto a fresh world of the same line', () => {
    const world = createWorld({ rng: createSeededRng(5), spawnEnabled: false, pokemonId: 'squirtle' });
    world.level = 12;
    world.player.stage = 1;
    world.moves[0]!.sockets.push({ augmentId: 'powerUp', rank: 2 });
    world.moves.push(createSlot('waterGun'));
    const mutation = MUTATION_IDS.find((id) => MUTATIONS[id].move === 'waterGun' && isBuilt(id))!;
    world.moves[1]!.mutation = mutation;
    world.moves[1]!.mutationRank = 2;
    world.items = ['leftovers'];
    world.boosts.damage = 3;
    refreshStats(world);
    const json = JSON.stringify(snapshotBuild(world));

    const next = createWorld({ rng: createSeededRng(6), spawnEnabled: false, pokemonId: 'squirtle' });
    restoreBuild(next, JSON.parse(json));
    expect(snapshotBuild(next)).toEqual(JSON.parse(json));
    expect(next.player.hp).toBe(next.player.maxHp);
    expect(next.mods.damageMult).toBeCloseTo(world.mods.damageMult);
  });

  it('refuses a snapshot from another line', () => {
    const snap = snapshotBuild(makeWorld());
    const other = createWorld({ rng: createSeededRng(1), spawnEnabled: false, pokemonId: 'lapras' });
    expect(() => restoreBuild(other, snap)).toThrow(/charmander/);
  });
});
