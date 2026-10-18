import { describe, expect, it } from 'vitest';
import indexMd from '../../docs/moveset/INDEX.md?raw';
import { AUGMENT_IDS } from '../data/augments';
import { ABILITIES, POKEMON, type AbilityId, type PokemonId } from '../data/content';
import { MOVES } from '../data/moves';
import {
  HOOK_IDS,
  MUTATION_IDS,
  MUTATIONS,
  PENDING_MOVE_IDS,
  REQUIREMENT_IDS,
  type MutationDef,
  type MutationId,
} from '../data/mutations';
import {
  cancelMutationReplace,
  chooseMutationReplace,
  grantMutation,
  isBuilt,
  mutationOffers,
  registerBuilt,
  requirementMet,
  socketsUsed,
} from './mutations';
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
    const pending: readonly string[] = PENDING_MOVE_IDS;
    for (const id of MUTATION_IDS) {
      const def: MutationDef = MUTATIONS[id];
      expect(def.move in MOVES || pending.includes(def.move), id).toBe(true);
      expect(id.startsWith(`${def.move}.`), id).toBe(true);
      if (!def.line) continue;
      const line = POKEMON[def.line];
      expect(def.fromStage, id).toBeLessThan(line.stages.length);
      if (def.kind === 'signature') expect(def.move, id).toBe(line.stages[0]!.signatureMove);
      // Bonds on moves that exist must be on the line's learnset (the 3 new Charmander moves arrive in P4f-7).
      else if (def.move in MOVES) expect(line.learnset.some((e) => e.move === def.move), id).toBe(true);
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

  it('a Mutation takes one of the 3 sockets, and an augment can replace it', () => {
    const w = world();
    const slot = w.moves[0]!;
    slot.mutation = 'bubble.trap';
    slot.sockets.push({ augmentId: 'powerUp', rank: 1 }, { augmentId: 'quickCast', rank: 1 });
    expect(socketsUsed(slot)).toBe(3);
    expect(needsReplace(w, 0, { augmentId: 'enlarge', rank: 1 })).toBe(true);
    expect(needsReplace(w, 0, { augmentId: 'powerUp', rank: 2 })).toBe(false);

    w.pendingLevelUps = 1;
    w.level = 3; // augment level
    w.offer = makeOffer(w);
    chooseSkill(w, 0);
    const offer = w.offer!;
    if (offer.kind !== 'augment') throw new Error('expected augment cards');
    const index = offer.cards.findIndex((c) => c.rank === 1);
    chooseAugment(w, index);
    expect(w.offer?.kind).toBe('replace');
    chooseReplace(w, 2); // past the 2 augments: the Mutation socket
    expect(slot.mutation).toBeNull();
    expect(slot.sockets.length).toBe(3);
    expect(w.offer).toBeNull();
  });

  it('grant: only built Mutations, only for the right line', () => {
    const w = world();
    expect(isBuilt('surf.backwash')).toBe(false); // built in P4f-6
    expect(grantMutation(w, 'surf.backwash')).toBe('notBuilt');
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

  it('grant onto 3 augments opens a replace window; cancel keeps them, choosing swaps one out', () => {
    registerBuilt('waterGun.slick');
    const w = world();
    w.moves.push(createSlot('waterGun'));
    const slot = w.moves[1]!;
    slot.sockets.push({ augmentId: 'powerUp', rank: 1 }, { augmentId: 'quickCast', rank: 2 }, { augmentId: 'enlarge', rank: 1 });
    expect(grantMutation(w, 'waterGun.slick')).toBe('replace');
    expect(w.offer).toEqual({ kind: 'mutationReplace', slot: 1, mutationId: 'waterGun.slick' });
    expect(grantMutation(w, 'waterGun.slick')).toBe('busy');
    cancelMutationReplace(w);
    expect(w.offer).toBeNull();
    expect(slot.mutation).toBeNull();

    grantMutation(w, 'waterGun.slick');
    chooseMutationReplace(w, 1);
    expect(slot.mutation).toBe('waterGun.slick');
    expect(slot.sockets.map((s) => s.augmentId)).toEqual(['powerUp', 'enlarge']);
    expect(w.offer).toBeNull();
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
