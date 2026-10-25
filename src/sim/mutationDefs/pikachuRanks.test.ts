import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import { MOVES, type MoveId, type ZoneMoveDef } from '../../data/moves';
import { rankedValues, type MutationId } from '../../data/mutations';
import { chainBias, emit } from '../hooks';
import { grantMutation } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4h-6: Pikachu-line Mutation ranks II/III and their rank III twists (docs/moveset/RANKS.md).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Pikachu (Raichu with Discharge at stage 1) with only `move` acting, holding `id` at `rank`. */
function withRank(move: MoveId, id: MutationId, rank: number, stage = 0): { w: World; slot: MoveSlot } {
  const w = createWorld({ rng: createSeededRng(111), pokemonId: 'pikachu', spawnEnabled: false });
  w.player.stage = stage;
  if (stage >= 1) w.player.ability = 'static.discharge';
  w.moves.push(createSlot(move));
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  expect(grantMutation(w, id)).toBe('granted');
  for (let r = 1; r < rank; r++) expect(grantMutation(w, id)).toBe('rankUp');
  w.player.invulnLeft = 1e9;
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

/** A Thunder Wave field at (x, y), as the move leaves it. */
function field(w: World, x: number, y: number): void {
  w.zones.push({
    id: w.nextId++,
    x,
    y,
    radius: 80,
    lifeLeft: 9,
    duration: 9,
    tickInterval: 99,
    tickLeft: 99,
    damage: 0,
    critChance: 0,
    slow: 0,
    stun: 0,
    stunKind: null,
    blind: 0,
    poisonDps: 0,
    attackType: null,
    source: 'thunderWave',
  });
}

describe('Pikachu ranks (P4h-6)', () => {
  it('Conductor: jumps between two fields deal ×1.15 / ×1.3 / ×1.45 (D53); elsewhere ×1', () => {
    for (const rank of [1, 2, 3]) {
      const { w } = withRank('thunderWave', 'thunderWave.conductor', rank);
      field(w, 300, 0);
      const a = dummy(w, 280, 0);
      const b = dummy(w, 320, 0);
      const out = dummy(w, 600, 0);
      expect(chainBias(w, a, b).damageMult).toBeCloseTo(rankedValues('thunderWave.conductor', rank).chainDamageMult);
      expect(chainBias(w, a, out).damageMult).toBe(1);
    }
  });

  it('Static Spark III: up to 4 extra sparks (3 at rank I)', () => {
    const sparks = (rank: number) => {
      const { w, slot } = withRank('spark', 'spark.staticSpark', rank);
      for (let i = 0; i < 5; i++) emit(w, 'staticProc', 1);
      run(w, DT);
      return slot.stats.extraCount - slot.baseStats.extraCount;
    };
    expect(sparks(1)).toBe(3);
    expect(sparks(3)).toBe(4);
  });

  it('Thunderstorm III: the Discharge strike is ×1.5 wider', () => {
    const { w, slot } = withRank('thunder', 'thunder.thunderstorm', 3, 1);
    slot.cooldownLeft = 1e9;
    dummy(w, 100, 0);
    run(w, DT);
    emit(w, 'discharge', 1);
    const strike = w.zones.find((z) => z.source === null)!;
    expect(strike.radius).toBeCloseTo((MOVES.thunder as ZoneMoveDef).radius * slot.stats.area * 1.5);
  });

  it('Volt Tackle III: the dash runs 150 px', () => {
    const { w } = withRank('quickAttack', 'quickAttack.voltTackle', 3);
    dummy(w, 200, 0);
    w.player.charge = 100;
    run(w, DT);
    expect(w.player.x).toBeCloseTo(150);
  });

  it('Static Pulse: ranks add move damage', () => {
    const one = withRank('thunderWave', 'thunderWave.pulse', 1).slot.stats.damage;
    const three = withRank('thunderWave', 'thunderWave.pulse', 3).slot.stats.damage;
    expect(three).toBeCloseTo(one * rankedValues('thunderWave.pulse', 3).damageMult);
  });

  it('Ricochet III: 3 bounces', () => {
    expect(rankedValues('electroBall.ricochet', 3).maxBounces).toBe(3);
  });
});
