import { writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { POKEMON, type PokemonId } from '../data/content';
import { MOVES, type MoveId } from '../data/moves';
import { MUTATION_IDS, MUTATIONS, type MutationDef, type MutationId } from '../data/mutations';
import { measureDps, type DummyRing } from './balance';
import { isBuilt } from './mutations';
import { createSeededRng } from './rng';
import { createSlot, refreshStats } from './stats';
import { createWorld } from './world';

// Rule 4 check (docs/moveset/README.md): a mutated move should land within ±15% DPS of the same
// move with Power Up I instead, on the dummy ring. Run with `npm run mutations`; report goes to
// mutations-report.md (gitignored). The bot stands still and is invulnerable, so Bonds read with
// their condition as that implies (Shell always ready, never hit, full HP): judge them with that in mind.

const TOLERANCE = 0.15;
const SEEDS = [1, 2, 3];
/** The default ring: 16 dummies on 4 circles from 30 px, so short melee reaches count too. */
const RING: DummyRing = { innerDist: 30, count: 16, rings: 4, step: 50 };
/** Moves whose base form misses the default ring (Spark orbits at 55 px, between circles) get a denser one. */
const RING_FOR: Partial<Record<MoveId, DummyRing>> = {
  spark: { innerDist: 30, count: 32, rings: 8, step: 25 },
};

/** The line a generic Mutation is measured on: the first line that learns the move. */
function lineFor(def: MutationDef): PokemonId {
  if (def.line) return def.line;
  return (Object.keys(POKEMON) as PokemonId[]).find((id) => POKEMON[id].learnset.some((e) => e.move === def.move))!;
}

function dpsWith(pokemonId: PokemonId, move: MoveId, seed: number, mutation: MutationId | null): number {
  const world = createWorld({ rng: createSeededRng(seed), pokemonId, spawnEnabled: false });
  const slot = createSlot(move);
  if (mutation) slot.mutation = mutation;
  else slot.sockets.push({ augmentId: 'powerUp', rank: 1 });
  world.moves = [slot];
  refreshStats(world);
  return measureDps(world, RING_FOR[move] ?? RING);
}

test('Mutation rule 4: DPS vs Power Up I', { timeout: 30 * 60_000 }, () => {
  const rows: string[] = [];
  for (const id of MUTATION_IDS.filter(isBuilt)) {
    const def: MutationDef = MUTATIONS[id];
    if (!(def.move in MOVES)) continue;
    const line = lineFor(def);
    const move = def.move as MoveId;
    const avg = (f: (seed: number) => number) => SEEDS.reduce((s, seed) => s + f(seed), 0) / SEEDS.length;
    const powerUp = avg((seed) => dpsWith(line, move, seed, null));
    const mutated = avg((seed) => dpsWith(line, move, seed, id));
    const ratio = powerUp > 0 ? mutated / powerUp : 0;
    const ok = Math.abs(ratio - 1) <= TOLERANCE ? '✓' : '✗';
    rows.push(`| ${id} | ${def.kind} | ${line} | ${powerUp.toFixed(1)} | ${mutated.toFixed(1)} | ${ratio.toFixed(2)} | ${ok} |`);
  }
  const header = '| Mutation | kind | measured on | Power Up I DPS | mutated DPS | ratio | ±15% |\n|---|---|---|---|---|---|---|';
  const note =
    'Dummy ring of 16 from 30 px (32 from 30 to 205 px for Spark), move alone at its first stage, bot standing still and invulnerable (Shell always ready, ' +
    'never hit, full HP). Utility (puddles, slips, Soak, stagger, movement) is not damage and is not counted.';
  writeFileSync('mutations-report.md', `# Mutation rule 4 (seeds ${SEEDS.join(', ')})\n\n${note}\n\n${header}\n${rows.join('\n')}\n`);
});
