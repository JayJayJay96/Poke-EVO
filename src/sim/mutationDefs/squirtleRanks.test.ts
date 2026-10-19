import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import { MOVES, type MoveId, type ZoneMoveDef } from '../../data/moves';
import { rankedValues, type MutationId } from '../../data/mutations';
import { emit, hooksOf } from '../hooks';
import { grantMutation } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, Projectile, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4h-3: Squirtle-line Mutation ranks II/III and their rank III twists (docs/moveset/RANKS.md).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Squirtle with only `move` acting, holding `id` at `rank`, invulnerable. */
function withRank(move: MoveId, id: MutationId, rank: number): { w: World; slot: MoveSlot } {
  const w = createWorld({ rng: createSeededRng(81), pokemonId: 'squirtle', spawnEnabled: false });
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

function dummy(w: World, x: number, y: number, kind: 'rattata' | 'raticate' = 'raticate'): Enemy {
  const e = spawnEnemy(w, kind, x, y, 200);
  e.speed = 0;
  return e;
}

describe('Squirtle ranks (P4h-3)', () => {
  it('Spiked Shell III: the aura lasts 4 s', () => {
    const { w, slot } = withRank('withdraw', 'withdraw.spikedShell', 3);
    dummy(w, 20, 0);
    run(w, DT);
    expect(slot.activeLeft).toBeCloseTo(4 * slot.stats.duration - DT, 2);
  });

  it('Hunker Down III: a hit taken while hunkered staggers the attacker away', () => {
    const { w } = withRank('withdraw', 'withdraw.hunkerDown', 3);
    const e = dummy(w, 20, 0);
    run(w, DT); // cast: the buff starts
    e.x = 10;
    e.kbX = 0;
    e.stunLeft = 0;
    w.player.invulnLeft = 0;
    step(w, IDLE, DT);
    expect(e.kbX).toBeGreaterThan(0);
  });

  it('Counter Shell III: the reset Withdraw hits ×1.5', () => {
    const { w, slot } = withRank('withdraw', 'withdraw.counterShell', 3);
    emit(w, 'shellBlock', 1);
    run(w, DT); // nothing in reach: still armed
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * rankedValues('withdraw.counterShell', 3).resetHitMult);
  });

  it('Wash Down III: Water +30% and +10% from every type, stacking', () => {
    const { w } = withRank('waterGun', 'waterGun.washDown', 3);
    const e = dummy(w, 80, 0);
    run(w, DT * 3);
    expect(e.vulnType).toBe('Water');
    expect(e.vulnPct).toBeCloseTo(0.3);
    expect(e.vulnAllPct).toBeCloseTo(0.1);
  });

  it('Slick II: the puddles get the rank II slip chance', () => {
    const { w } = withRank('waterGun', 'waterGun.slick', 2);
    dummy(w, 80, 0);
    run(w, DT);
    expect(w.puddles[0]!.slipChancePerSec).toBeCloseTo(rankedValues('waterGun.slick', 2).slipChancePerSec);
  });

  it('Moat III: enemies on the ring are Soaked', () => {
    const { w } = withRank('whirlpool', 'whirlpool.moat', 3);
    const e = dummy(w, 70, 0);
    run(w, 0.6);
    expect(e.soakLeft).toBeGreaterThan(0);
  });

  it('Eye of the Storm III: the Shell Burst whirlpool pulls light enemies in', () => {
    const { w } = withRank('whirlpool', 'whirlpool.eyeOfTheStorm', 3);
    emit(w, 'shellBurst', 1);
    const zone = w.zones.find((z) => z.source === 'whirlpool')!;
    const e = dummy(w, zone.x + zone.radius * 0.6, zone.y, 'rattata');
    const before = Math.hypot(e.x - zone.x, e.y - zone.y);
    run(w, 0.5);
    expect(Math.hypot(e.x - zone.x, e.y - zone.y)).toBeLessThan(before - 5);
  });

  it('Eye of the Storm I: no pull', () => {
    const { w } = withRank('whirlpool', 'whirlpool.eyeOfTheStorm', 1);
    emit(w, 'shellBurst', 1);
    const zone = w.zones.find((z) => z.source === 'whirlpool')!;
    expect(zone.radius).toBeCloseTo((MOVES.whirlpool as ZoneMoveDef).radius * rankedValues('whirlpool.eyeOfTheStorm', 1).sizeMult);
    const e = dummy(w, zone.x + zone.radius * 0.6, zone.y, 'rattata');
    const x = e.x;
    run(w, 0.5);
    expect(e.x).toBeCloseTo(x, 0);
  });

  it('Backwash III: the return wave Soaks', () => {
    const { w } = withRank('surf', 'surf.backwash', 3);
    const e = dummy(w, 60, 0);
    run(w, 0.5);
    expect(e.soakLeft).toBeGreaterThan(0);
  });

  it('Rain Cannon III: the rain Soaks', () => {
    const { w } = withRank('hydroPump', 'hydroPump.rainCannon', 3);
    const e = dummy(w, 60, 0);
    run(w, 0.5);
    expect(e.soakLeft).toBeGreaterThan(0);
  });

  it('Shrapnel III: a shard passes through one enemy; at rank I it stops', () => {
    const shardHits = (rank: number) => {
      const { w, slot } = withRank('flashCannon', 'flashCannon.shrapnel', rank);
      slot.cooldownLeft = 1e9;
      const first = dummy(w, 300, 200, 'rattata');
      const second = dummy(w, 340, 200, 'rattata');
      // The shot expires at (280, 200); one shard flies along +x.
      hooksOf(slot)!.onProjectileExpire!(w, slot, { x: 280, y: 200, damage: 20 } as Projectile);
      run(w, 0.3);
      return [first, second].filter((e) => e.hp < e.maxHp).length;
    };
    expect(shardHits(1)).toBe(1);
    expect(shardHits(3)).toBe(2);
  });

  it('Bubble Trap III: the pop Soaks what it hits', () => {
    const w = createWorld({ rng: createSeededRng(82), pokemonId: 'squirtle', spawnEnabled: false });
    for (let r = 0; r < 3; r++) grantMutation(w, 'bubble.trap');
    expect(w.moves[0]!.mutationRank).toBe(3);
    w.moves[0]!.cooldownLeft = 1e9;
    const trapped = dummy(w, 200, 0, 'rattata');
    trapped.trapLeft = DT / 2;
    trapped.trapDamage = 10;
    const near = dummy(w, 220, 0, 'rattata');
    run(w, DT * 2);
    expect(near.soakLeft).toBeGreaterThan(0);
  });
});
