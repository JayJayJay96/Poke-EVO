import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import { MOVES, type MoveId } from '../../data/moves';
import { MUTATION_TUNING, MUTATIONS, rankedTide, rankedValues, type MutationId } from '../../data/mutations';
import { emit } from '../hooks';
import { grantMutation } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4h-7: Lapras-line Mutation ranks II/III, including the Tide ranks (docs/moveset/RANKS.md).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Lapras with `move` (null: the signature) acting alone, holding `id` at `rank`. */
function withRank(move: MoveId | null, id: MutationId, rank: number): { w: World; slot: MoveSlot } {
  const w = createWorld({ rng: createSeededRng(61), pokemonId: 'lapras', spawnEnabled: false });
  if (move) w.moves.push(createSlot(move));
  refreshStats(w);
  if (move) w.moves[0]!.cooldownLeft = 1e9;
  expect(grantMutation(w, id)).toBe('granted');
  for (let r = 1; r < rank; r++) expect(grantMutation(w, id)).toBe('rankUp');
  w.player.invulnLeft = 1e9;
  return { w, slot: w.moves[move ? 1 : 0]! };
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

describe('Lapras ranks (P4h-7)', () => {
  it('Surging Slam: a level-up empowers 5 slams in Flood and 2 in Ebb at rank III', () => {
    const { w, slot } = withRank('bodySlam', 'bodySlam.surge', 3);
    emit(w, 'levelUp', 1);
    expect(slot.mutState.empowered).toBe(5);
    slot.mutState.empowered = 0;
    w.level = MUTATION_TUNING.tideLevel;
    emit(w, 'levelUp', 1);
    expect(slot.mutState.empowered).toBe(2);
  });

  it('Pressure Shell: the store cap grows to 80 / 100 (Flood) and 40 / 50 (Ebb)', () => {
    for (const [rank, flood, ebb] of [[2, 80, 40], [3, 100, 50]] as const) {
      const { w, slot } = withRank('hydroPump', 'hydroPump.pressureShell', rank);
      emit(w, 'armorAbsorb', 999);
      expect(slot.mutState.stored).toBe(flood);
      slot.mutState.stored = 0;
      w.level = MUTATION_TUNING.tideLevel;
      emit(w, 'armorAbsorb', 999);
      expect(slot.mutState.stored).toBe(ebb);
    }
  });

  it('Flash Freeze III: Flood freezes 0.8 s; Ebb beam ×1.4 wide', () => {
    const flood = withRank('iceBeam', 'iceBeam.flashFreeze', 3);
    const e = dummy(flood.w, 100, 0);
    run(flood.w, DT);
    expect(e.stunLeft).toBeCloseTo(0.8, 1);
    const ebb = withRank('iceBeam', 'iceBeam.flashFreeze', 3);
    ebb.w.level = MUTATION_TUNING.tideLevel;
    dummy(ebb.w, 100, 0);
    run(ebb.w, DT * 2); // Lv 30 also brings Sheer Cold, whose stat refresh lasts until the next step
    expect(ebb.slot.stats.widthMult).toBeCloseTo(1.4);
  });

  it('Ferry Wave III: Flood pulls gems from 2× the reach; Ebb from 1.4×', () => {
    expect(rankedTide('surf.ferryWave', 3).flood.gemRadiusMult).toBe(2);
    expect(rankedTide('surf.ferryWave', 3).ebb.gemRadiusMult).toBe(1.4);
    const { w, slot } = withRank('surf', 'surf.ferryWave', 3);
    dummy(w, 50, 0);
    const reach = MOVES.surf.form === 'melee' ? MOVES.surf.reach * slot.stats.area * slot.stats.reachMult : 0;
    const gem = { id: w.nextId++, x: 0, y: reach * 2 - 5, value: 1, magnetized: false, collected: false, expiresAt: Infinity };
    w.gems.push(gem);
    run(w, DT);
    expect(gem.magnetized || gem.collected).toBe(true);
  });

  it('rank I Tide values are unchanged', () => {
    expect(rankedTide('bodySlam.surge', 1)).toBe(MUTATIONS['bodySlam.surge'].tide);
  });

  it('Shockwave III: the wave runs 200 px', () => {
    const { w } = withRank('bodySlam', 'bodySlam.shockwave', 3);
    dummy(w, 30, 0);
    run(w, DT);
    const wave = w.entities.find((e) => e.owner === 'bodySlam.shockwave')!;
    expect(wave.lifeLeft * Math.hypot(wave.vx, wave.vy)).toBeCloseTo(200 - 450 * DT, 0);
  });

  it('Song of the Sea: ranks add move damage', () => {
    const one = withRank(null, 'iceShard.song', 1).slot.stats.damage;
    const three = withRank(null, 'iceShard.song', 3).slot.stats.damage;
    expect(three).toBeCloseTo(one * rankedValues('iceShard.song', 3).damageMult);
  });

  it('Frost Lance III: slow 40%', () => {
    expect(withRank(null, 'iceShard.frostLance', 1).slot.stats.slow).toBeCloseTo(0.3);
    expect(withRank(null, 'iceShard.frostLance', 3).slot.stats.slow).toBeCloseTo(0.4);
  });
});
