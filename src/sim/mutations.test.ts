import { describe, expect, it } from 'vitest';
import indexMd from '../../docs/moveset/INDEX.md?raw';
import ranksMd from '../../docs/moveset/RANKS.md?raw';
import { AUGMENT_IDS, AUGMENTS, type AugmentId } from '../data/augments';
import { ABILITIES, POKEMON, type AbilityId, type PokemonId } from '../data/content';
import { MOVES, type MoveId } from '../data/moves';
import {
  HOOK_IDS,
  MUTATION_IDS,
  MUTATION_RANKS,
  rankedValues,
  MUTATIONS,
  REQUIREMENT_IDS,
  type MutationDef,
  type MutationId,
} from '../data/mutations';
import { grantMutation, isBuilt, mutationOffers, mutationRankUps, registerBuilt, requirementMet, socketsUsed } from './mutations';
import { chooseSiteCard, rollSiteCards } from './sites';
import { chooseAugment, chooseReplace, chooseSkill, drawAugmentCards, makeOffer, needsReplace } from './progression';
import { createSeededRng } from './rng';
import { createSlot, refreshStats } from './stats';
import type { World } from './types';
import { createWorld } from './world';

// Registry and socket plumbing for Mutations (P4f-1). Behaviour tests live with each Mutation's sim code.

/** Rows of the markdown table that follows `heading` in INDEX.md, as trimmed cells. */
function tableRows(heading: string): string[][] {
  const section = indexMd.split(heading)[1]!.split('\n## ')[0]!;
  return section
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

const code = (cell: string): string => /`([^`]+)`/.exec(cell)?.[1] ?? cell;

function world(pokemonId: PokemonId = 'squirtle', seed = 1): World {
  return createWorld({ rng: createSeededRng(seed), pokemonId, spawnEnabled: false });
}

describe('Mutation ranks doc (docs/moveset/RANKS.md, D24)', () => {
  // | `id` Name | rank II | rank III | `aug`, `aug` |
  const rows = ranksMd
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));

  it('lists every Mutation exactly once, with rank II and III', () => {
    const ids = rows.map((r) => /^`([\w.]+)`/.exec(r[0]!)![1]);
    expect([...ids].sort()).toEqual([...MUTATION_IDS].sort());
    for (const r of rows) expect(r[1] && r[2], r[0]).toBeTruthy();
  });

  it('favoured augments: 2–3 distinct, legal for the move (or a later signature tier), not excluded', () => {
    for (const r of rows) {
      const id = /^`([\w.]+)`/.exec(r[0]!)![1] as MutationId;
      const def: MutationDef = MUTATIONS[id];
      const favoured = [...r[3]!.matchAll(/`(\w+)`/g)].map((m) => m[1]!);
      expect(favoured.length, id).toBeGreaterThanOrEqual(2);
      expect(favoured.length, id).toBeLessThanOrEqual(3);
      expect(new Set(favoured).size, id).toBe(favoured.length);
      // Signature Mutations ride every tier of the line's signature move.
      const line = def.line ? POKEMON[def.line] : null;
      const moves: MoveId[] =
        def.kind === 'signature' && line
          ? [...line.stages.map((s) => s.signatureMove), ...(line.signatureTiers ?? []).map((t) => t.move)]
          : [def.move];
      const tags = new Set(moves.flatMap((m) => MOVES[m].tags));
      for (const aug of favoured) {
        expect(AUGMENT_IDS as readonly string[], `${id}: ${aug}`).toContain(aug);
        const a = AUGMENTS[aug as AugmentId];
        expect(a.requiresAny.length === 0 || a.requiresAny.some((t) => tags.has(t)), `${id}: ${aug} tags`).toBe(true);
        expect(!a.exclusiveTo || a.exclusiveTo.some((m) => moves.includes(m)), `${id}: ${aug} exclusive`).toBe(true);
        expect(def.excludesAugments ?? [], `${id}: ${aug} excluded`).not.toContain(aug);
      }
    }
  });
});

describe('Mutation rank values (D24)', () => {
  it('rank II/III override keys exist at rank I with the same type (twists start "off")', () => {
    for (const id of MUTATION_IDS) {
      const def: MutationDef = MUTATIONS[id];
      for (const override of def.ranks ?? []) {
        for (const [key, value] of Object.entries(override)) {
          expect(key in def.values, `${id}.${key}`).toBe(true);
          expect(typeof value, `${id}.${key}`).toBe(typeof def.values[key]);
        }
      }
    }
  });

  it('rank card text exists exactly for the Mutations with their own ranks', () => {
    for (const id of MUTATION_IDS) {
      const def: MutationDef = MUTATIONS[id];
      expect(Boolean(def.rankText), id).toBe(Boolean(def.ranks));
    }
  });

  it('rank III builds on rank II; rank I is the plain values', () => {
    expect(rankedValues('withdraw.hunkerDown', 1)).toBe(MUTATIONS['withdraw.hunkerDown'].values);
    expect(rankedValues('withdraw.hunkerDown', 2).buffSeconds).toBe(1.75);
    expect(rankedValues('withdraw.hunkerDown', 3)).toMatchObject({ buffSeconds: 2, hitStagger: 15, damageMult: 1.04 });
    expect(rankedValues('rapidSpin.shellSpin', 3).rechargeCutPerHit).toBe(0.35);
  });

  it('Mutations without their own ranks still get the placeholder damage scaling', () => {
    const w = world('bulbasaur');
    expect((MUTATIONS['vineWhip.longLash'] as MutationDef).ranks).toBeUndefined();
    expect(grantMutation(w, 'vineWhip.longLash')).toBe('granted');
    const rankI = w.moves[0]!.stats.damage;
    grantMutation(w, 'vineWhip.longLash');
    expect(w.moves[0]!.stats.damage).toBeCloseTo(rankI * MUTATION_RANKS.placeholderDamageMult[1]);
  });
});

describe('Mutation registry (docs/moveset/INDEX.md ↔ src/data/mutations.ts)', () => {
  const rows = tableRows('## Mutations');

  it('every INDEX.md Mutation ID exists in mutations.ts and vice versa', () => {
    const docIds = rows.map((r) => code(r[0]!));
    expect(docIds.length).toBe(110);
    expect(new Set(docIds).size).toBe(docIds.length);
    expect([...docIds].sort()).toEqual([...MUTATION_IDS].sort());
  });

  it('every row matches its entry: name, kind, move, line, stage, hook, requirements, Tide, pool', () => {
    for (const [idCell, name, kind, move, line, from, hook, pool] of rows) {
      const id = code(idCell!) as MutationId;
      const def: MutationDef = MUTATIONS[id];
      expect(def.name, id).toBe(name);
      expect(def.kind, id).toBe(kind);
      expect(def.move, id).toBe(move!.split('→')[0]!.trim());
      expect(def.line ?? 'any', id).toBe(line);
      expect(String(def.fromStage), id).toBe(from);
      expect(def.hook ?? '—', id).toBe(hook === '—' ? '—' : code(hook!));
      const requires = /requires `(\w+)`/.exec(hook!)?.[1];
      expect(def.requires ?? [], id).toEqual(requires ? [requires] : []);
      expect(def.tide !== undefined, id).toBe(hook!.includes('(tide)'));
      expect(def.pool, id).toBe(pool);
    }
  });

  it('hook and requirement vocabularies match INDEX.md', () => {
    const vocab = indexMd.split('**Hook vocabulary**')[1]!.split('| RequirementId')[0]!;
    const hooks = [...vocab.matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1]);
    expect([...hooks].sort()).toEqual([...HOOK_IDS].sort());
    const reqs = [...indexMd.matchAll(/^\| `(\w+)` \| the build owns/gm)].map((m) => m[1]);
    expect(reqs).toEqual([...REQUIREMENT_IDS]);
  });

  it('every Mutation sits on a real move of its line', () => {
    for (const id of MUTATION_IDS) {
      const def: MutationDef = MUTATIONS[id];
      expect(def.move in MOVES, id).toBe(true);
      expect(id.startsWith(`${def.move}.`), id).toBe(true);
      if (!def.line) continue;
      const line = POKEMON[def.line];
      expect(def.fromStage, id).toBeLessThan(line.stages.length);
      if (def.kind === 'signature') expect(def.move, id).toBe(line.stages[0]!.signatureMove);
      else expect(line.learnset.some((e) => e.move === def.move), id).toBe(true);
    }
  });

  it('ability tiers in INDEX.md and content.ts match exactly', () => {
    const ids = tableRows('## Ability tiers').map((r) => code(r[0]!));
    expect(ids.length).toBe(17);
    for (const id of ids) expect(id in ABILITIES, id).toBe(true);
    for (const id of Object.keys(ABILITIES) as AbilityId[]) expect(ids, id).toContain(id);
  });

  it('values hold only finite numbers and flags (the numbers live here, not in hook code)', () => {
    for (const id of MUTATION_IDS) {
      const def: MutationDef = MUTATIONS[id];
      const groups = [def.values, def.tide?.flood ?? {}, def.tide?.ebb ?? {}];
      for (const group of groups) {
        for (const value of Object.values(group)) {
          const leaves = typeof value === 'object' ? Object.values(value) : [value];
          for (const v of leaves) expect(typeof v === 'boolean' || Number.isFinite(v), id).toBe(true);
        }
      }
    }
  });
});

describe('Mutation sockets and offers', () => {
  it('augment levels never offer a Mutation (D16)', () => {
    for (const pokemonId of Object.keys(POKEMON) as PokemonId[]) {
      const w = world(pokemonId, 7);
      w.moves[0]!.mutation = MUTATION_IDS.find((id) => (MUTATIONS[id] as MutationDef).line === pokemonId)!;
      for (const { move } of POKEMON[pokemonId].learnset.slice(0, 4)) w.moves.push(createSlot(move));
      refreshStats(w);
      for (let i = 0; i < 300; i++) {
        for (let slot = 0; slot < w.moves.length; slot++) {
          for (const card of drawAugmentCards(w, slot)) {
            expect(AUGMENT_IDS).toContain(card.augmentId);
            expect(card.augmentId in MUTATIONS).toBe(false);
          }
        }
      }
    }
  });

  it('a Mutation has its own slot (D24): 3 augments fit beside it, and augment replacing never touches it', () => {
    const w = world();
    const slot = w.moves[0]!;
    slot.mutation = 'bubble.trap';
    slot.mutationRank = 1;
    slot.sockets.push({ augmentId: 'powerUp', rank: 1 }, { augmentId: 'quickCast', rank: 1 });
    expect(socketsUsed(slot)).toBe(2);
    expect(needsReplace(w, 0, { augmentId: 'enlarge', rank: 1 })).toBe(false);
    slot.sockets.push({ augmentId: 'enlarge', rank: 1 });
    expect(needsReplace(w, 0, { augmentId: 'keenEdge', rank: 1 })).toBe(true);

    w.pendingLevelUps = 1;
    w.level = 3; // augment level
    w.offer = makeOffer(w);
    chooseSkill(w, 0);
    const offer = w.offer!;
    if (offer.kind !== 'augment') throw new Error('expected augment cards');
    const index = offer.cards.findIndex((c) => c.rank === 1);
    chooseAugment(w, index);
    expect(w.offer?.kind).toBe('replace');
    chooseReplace(w, 3); // past the 3 augments: there is no Mutation socket any more
    expect(w.offer?.kind).toBe('replace');
    chooseReplace(w, 2);
    expect(slot.mutation).toBe('bubble.trap');
    expect(slot.sockets.length).toBe(3);
    expect(w.offer).toBeNull();
  });

  it('grant: only built Mutations, only for the right line', () => {
    const w = world();
    // Any Mutation whose behaviour isn't built yet can't be granted (none left once P4f is done).
    const unbuilt = MUTATION_IDS.find((id) => !isBuilt(id));
    if (unbuilt) expect(grantMutation(w, unbuilt)).toBe('notBuilt');
    registerBuilt('waterGun.slick');
    registerBuilt('ember.kindle');
    expect(grantMutation(w, 'ember.kindle')).toBe('wrongLine');
  });

  it('grant learns a missing move, and a second Mutation on a move replaces the first (rule 1)', () => {
    registerBuilt('waterGun.slick');
    registerBuilt('waterGun.washDown');
    const w = world();
    expect(grantMutation(w, 'waterGun.slick')).toBe('granted');
    const slot = w.moves.find((m) => m.moveId === 'waterGun')!;
    expect(slot.mutation).toBe('waterGun.slick');
    expect(grantMutation(w, 'waterGun.washDown')).toBe('granted');
    expect(slot.mutation).toBe('waterGun.washDown');
    expect(w.moves.filter((m) => m.moveId === 'waterGun').length).toBe(1);
  });

  it('grant onto 3 augments keeps every augment (D24)', () => {
    registerBuilt('waterGun.slick');
    const w = world();
    w.moves.push(createSlot('waterGun'));
    const slot = w.moves[1]!;
    slot.sockets.push({ augmentId: 'powerUp', rank: 1 }, { augmentId: 'quickCast', rank: 2 }, { augmentId: 'enlarge', rank: 1 });
    expect(grantMutation(w, 'waterGun.slick')).toBe('granted');
    expect(slot.mutation).toBe('waterGun.slick');
    expect(slot.mutationRank).toBe(1);
    expect(slot.sockets.map((s) => s.augmentId)).toEqual(['powerUp', 'quickCast', 'enlarge']);
    expect(w.offer).toBeNull();
  });

  it('the same Mutation again ranks it up to III; a different one resets to rank I (D24)', () => {
    registerBuilt('waterGun.slick');
    registerBuilt('waterGun.washDown');
    const w = world();
    expect(grantMutation(w, 'waterGun.slick')).toBe('granted');
    const slot = w.moves.find((m) => m.moveId === 'waterGun')!;
    const rankI = slot.stats.damage;
    expect(mutationRankUps(w)).toEqual([{ mutationId: 'waterGun.slick', rank: 2 }]);
    expect(grantMutation(w, 'waterGun.slick')).toBe('rankUp');
    expect(slot.mutationRank).toBe(2);
    // Slick has its own rank values (P4h-3): its damage factor changes per rank.
    const slickAt = (r: number) => rankedValues('waterGun.slick', r).damageMult;
    expect(slot.stats.damage).toBeCloseTo((rankI * slickAt(2)) / slickAt(1));
    expect(grantMutation(w, 'waterGun.slick')).toBe('rankUp');
    expect(slot.mutationRank).toBe(3);
    expect(slot.stats.damage).toBeCloseTo((rankI * slickAt(3)) / slickAt(1));
    expect(grantMutation(w, 'waterGun.slick')).toBe('maxRank');
    expect(mutationRankUps(w)).toEqual([]);

    expect(grantMutation(w, 'waterGun.washDown')).toBe('granted');
    expect(slot.mutation).toBe('waterGun.washDown');
    expect(slot.mutationRank).toBe(1);
  });

  it('sites offer rank-up cards for the Mutations held, and taking one ranks it up', () => {
    const w = world();
    expect(grantMutation(w, 'bubble.trap')).toBe('granted');
    let rankCard = -1;
    for (let tries = 0; tries < 50 && rankCard < 0; tries++) {
      const cards = rollSiteCards(w);
      rankCard = cards.findIndex((c) => c.kind === 'mutationRank' && c.mutationId === 'bubble.trap' && c.rank === 2);
      if (rankCard >= 0) w.offer = { kind: 'site', siteId: 0, cards };
    }
    expect(rankCard).toBeGreaterThanOrEqual(0);
    expect(chooseSiteCard(w, rankCard)).toBe('rankUp');
    expect(w.moves[0]!.mutationRank).toBe(2);
  });

  it('site offers follow the INDEX filter: built, line, stage, owned move, one per move, requirements', () => {
    registerBuilt('waterGun.slick');
    registerBuilt('waterGun.steadyAim');
    registerBuilt('whirlpool.eyeOfTheStorm');
    registerBuilt('bubble.trap');
    registerBuilt('ember.kindle');
    const w = world();
    // Other Mutations are built too (and more get registered by other tests): look only at these.
    const watched: string[] = ['waterGun.slick', 'waterGun.steadyAim', 'whirlpool.eyeOfTheStorm', 'bubble.trap', 'ember.kindle'];
    const offers = () => mutationOffers(w).filter((id) => watched.includes(id));
    expect(offers()).toEqual(['bubble.trap']); // Water Gun and Whirlpool not owned yet
    w.moves.push(createSlot('waterGun'), createSlot('whirlpool'));
    expect(offers()).toEqual(['waterGun.slick', 'waterGun.steadyAim', 'bubble.trap']); // Eye needs Wartortle
    w.player.stage = 1;
    expect(mutationOffers(w)).toContain('whirlpool.eyeOfTheStorm');
    w.moves[1]!.mutation = 'waterGun.slick';
    expect(mutationOffers(w).some((id) => id.startsWith('waterGun.'))).toBe(false);
    expect(mutationOffers(w)).not.toContain('ember.kindle');
  });

  it('scorchSource is met by Kindle, Flamethrower, Flame Trail or Solar Power', () => {
    const w = world('charmander');
    expect(requirementMet(w, 'scorchSource')).toBe(false);
    w.moves[0]!.mutation = 'ember.wisp';
    expect(requirementMet(w, 'scorchSource')).toBe(false);
    w.moves[0]!.mutation = 'ember.kindle';
    expect(requirementMet(w, 'scorchSource')).toBe(true);
    w.moves[0]!.mutation = null;
    w.player.ability = 'solarPower';
    expect(requirementMet(w, 'scorchSource')).toBe(true);
  });
});
