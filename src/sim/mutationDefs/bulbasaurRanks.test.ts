import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import type { MoveId } from '../../data/moves';
import { rankedValues, type MutationId } from '../../data/mutations';
import { damageEnemy } from '../combat';
import { mutationDamageTakenMult } from '../hooks';
import { grantMutation } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4h-5: Bulbasaur-line Mutation ranks II/III and their rank III twists (docs/moveset/RANKS.md).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Bulbasaur (at `stage`) with only `move` acting, holding `id` at `rank`. */
function withRank(move: MoveId, id: MutationId, rank: number, stage = 0): { w: World; slot: MoveSlot } {
  const w = createWorld({ rng: createSeededRng(101), pokemonId: 'bulbasaur', spawnEnabled: false });
  w.player.stage = stage;
  w.moves.push(createSlot(move));
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  expect(grantMutation(w, id)).toBe('granted');
  for (let r = 1; r < rank; r++) expect(grantMutation(w, id)).toBe('rankUp');
  w.player.invulnLeft = 1e9;
  w.player.bloomCooldownLeft = 1e9;
  return { w, slot: w.moves[1]! };
}

function run(w: World, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.player.invulnLeft = 1e9;
    step(w, IDLE, DT);
    if (w.offer) w.offer = null;
  }
}

function dummy(w: World, x: number, y: number): Enemy {
  const e = spawnEnemy(w, 'raticate', x, y, 200);
  e.speed = 0;
  return e;
}

describe('Bulbasaur ranks (P4h-5)', () => {
  it('Spreading Seed III: the seed jumps twice; at rank I only once', () => {
    const secondJump = (rank: number) => {
      const { w } = withRank('leechSeed', 'leechSeed.spread', rank);
      w.moves[1]!.cooldownLeft = 1e9;
      const a = dummy(w, 100, 0);
      const b = dummy(w, 150, 0);
      const c = dummy(w, 200, 0);
      a.seedDps = 5;
      a.seedLeft = 2;
      run(w, DT);
      damageEnemy(w, a, 1e9);
      expect(b.seedJumps).toBe(1);
      damageEnemy(w, b, 1e9);
      return c.seedLeft > 0;
    };
    expect(secondJump(1)).toBe(false);
    expect(secondJump(3)).toBe(true);
  });

  it('Healthy Growth III: pierce 2 at full HP', () => {
    const { w, slot } = withRank('razorLeaf', 'razorLeaf.healthyGrowth', 3);
    run(w, DT);
    expect(slot.stats.pierce - slot.baseStats.pierce).toBe(2);
  });

  it('Drift Cloud and Drowsy Haze: ranks add move damage', () => {
    for (const id of ['poisonPowder.drift', 'sleepPowder.drowsy'] as const) {
      const move = id.split('.')[0] as MoveId;
      const one = withRank(move, id, 1).slot.stats.damage;
      expect(withRank(move, id, 3).slot.stats.damage).toBeCloseTo(one * rankedValues(id, 3).damageMult);
    }
  });

  it('Drowsy Haze III: slow 60%', () => {
    expect(withRank('sleepPowder', 'sleepPowder.drowsy', 3).slot.stats.slow).toBeCloseTo(0.6);
  });

  it('Ingrain III: roots after 0.7 s still (1 s at rank I)', () => {
    const rootedAfter = (rank: number) => {
      const { w } = withRank('solarBeam', 'solarBeam.ingrain', rank, 2);
      run(w, 0.8);
      return mutationDamageTakenMult(w) < 1;
    };
    expect(rootedAfter(1)).toBe(false);
    expect(rootedAfter(3)).toBe(true);
  });

  it('Thorn Garden III: up to 5 sprouts', () => {
    const w = createWorld({ rng: createSeededRng(102), pokemonId: 'bulbasaur', spawnEnabled: false });
    for (let r = 0; r < 3; r++) grantMutation(w, 'vineWhip.thornGarden');
    const slot = w.moves[0]!;
    for (let i = 0; i < 7; i++) {
      dummy(w, 40 + i * 4, 0);
      slot.cooldownLeft = 0;
      step(w, IDLE, DT);
    }
    expect(w.entities.filter((m) => m.owner === 'vineWhip.thornGarden' && m.lifeLeft > 0)).toHaveLength(5);
  });

  it('Rollout III: up to 6 stacks', () => {
    const { w, slot } = withRank('tackle', 'tackle.rollout', 3);
    dummy(w, 30, 0);
    for (let i = 0; i < 8; i++) {
      slot.cooldownLeft = 0;
      step(w, IDLE, DT);
    }
    expect(slot.mutState.stacks).toBe(6);
  });
});
