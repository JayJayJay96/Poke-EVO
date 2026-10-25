import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import type { MoveId } from '../../data/moves';
import { MUTATION_TUNING, rankedValues, type MutationId } from '../../data/mutations';
import { CRIT_MULTIPLIER } from '../../data/upgrades';
import { grantMutation } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import { spawnScorch } from '../terrain';
import type { Enemy, InputState, MoveSlot, Projectile, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';
import { wispCount } from './ember';

// P4h-4: Charmander-line Mutation ranks II/III and their rank III twists (docs/moveset/RANKS.md).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

function world(stage = 0): World {
  const w = createWorld({ rng: createSeededRng(91), pokemonId: 'charmander', spawnEnabled: false });
  w.player.stage = stage;
  w.player.invulnLeft = 1e9;
  return w;
}

/** Grants `id` and ranks it up to `rank`. */
function rankUp(w: World, id: MutationId, rank: number): void {
  expect(grantMutation(w, id)).toBe('granted');
  for (let r = 1; r < rank; r++) expect(grantMutation(w, id)).toBe('rankUp');
}

/** Charmander (at `stage`) with only `move` acting, holding `id` at `rank`. */
function withRank(move: MoveId, id: MutationId, rank: number, stage = 0): { w: World; slot: MoveSlot } {
  const w = world(stage);
  w.moves.push(createSlot(move));
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  rankUp(w, id, rank);
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

const lost = (e: Enemy) => e.maxHp - e.hp;

describe('Charmander ranks (P4h-4)', () => {
  it('Fixed Rage III: 9 fixed damage, +1 per 3 levels', () => {
    const { w, slot } = withRank('dragonRage', 'dragonRage.fixedRage', 3);
    w.level = 9;
    run(w, DT);
    expect(slot.stats.damage).toBe(9 + 3);
  });

  it('Cornered Dragon III: 8 directions, side arms ×0.75', () => {
    const diagonalHit = (rank: number) => {
      const { w } = withRank('dragonRage', 'dragonRage.corneredDragon', rank, 1);
      w.player.hp = w.player.maxHp * 0.2;
      const target = dummy(w, 150, 0);
      const diag = dummy(w, 110, -110);
      run(w, DT);
      return lost(diag) / lost(target);
    };
    expect(diagonalHit(1)).toBe(0);
    expect(diagonalHit(3)).toBeCloseTo(0.75);
  });

  it('Vortex III: the burst reaches 130 px (110 at rank I)', () => {
    const burstHits = (rank: number) => {
      const { w, slot } = withRank('fireSpin', 'fireSpin.vortex', rank);
      // Burst reach counts the enemy's radius: 135 px is outside 110 + r, inside 130 + r.
      const far = dummy(w, 135, 0);
      run(w, DT);
      slot.cooldownLeft = 1e9;
      const before = lost(far);
      run(w, 3.6); // the 3.5 s spin runs out and bursts
      return lost(far) > before;
    };
    expect(burstHits(1)).toBe(false);
    expect(burstHits(3)).toBe(true);
  });

  it('Tail Flame III: one extra flame from 80% HP (70% at rank I)', () => {
    const flamesAt = (rank: number) => {
      const { w, slot } = withRank('fireSpin', 'fireSpin.tailFlame', rank);
      w.player.hp = w.player.maxHp * 0.75;
      run(w, DT);
      return slot.stats.extraCount;
    };
    expect(flamesAt(1)).toBe(0);
    expect(flamesAt(3)).toBe(1);
  });

  it('Searing Slash III: the cash-in deals ×1.25 the remaining Burn', () => {
    const { w, slot } = withRank('slash', 'slash.searingSlash', 3, 1);
    slot.stats.critChance = 0;
    const e = dummy(w, 100, 0);
    e.burnDps = 4;
    e.burnLeft = 2;
    e.burnTickLeft = 1; // no burn tick in this step
    run(w, DT);
    expect(lost(e)).toBeCloseTo(slot.stats.damage * CRIT_MULTIPLIER + 4 * (2 - DT) * 1.25, 0);
  });

  it('Backdraft III: a 200° rear arc with its rank damage', () => {
    const plain = withRank('wingAttack', 'wingAttack.backdraft', 1).slot.stats.damage;
    const { w, slot } = withRank('wingAttack', 'wingAttack.backdraft', 3);
    expect(slot.stats.damage).toBeCloseTo(plain * rankedValues('wingAttack.backdraft', 3).damageMult);
    // Facing +x, a 200° rear arc reaches 10° past straight up.
    const side = dummy(w, 10, -60);
    dummy(w, -40, 0);
    run(w, DT);
    expect(lost(side)).toBeGreaterThan(0);
  });

  it('Fan the Flames III: a fanned patch grows to ×1.75', () => {
    const { w, slot } = withRank('wingAttack', 'wingAttack.fanTheFlames', 3, 2);
    const patch = spawnScorch(w, 0, -60, 10);
    dummy(w, 0, 60);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    expect(patch.radius).toBeCloseTo(MUTATION_TUNING.scorch.radius * 1.75);
  });

  it('Kindle III: Kindled shots Burn', () => {
    const w = world();
    rankUp(w, 'ember.kindle', 3);
    const slot = w.moves[0]!;
    dummy(w, 200, 0);
    const fired: Projectile[] = [];
    for (let i = 0; i < 3; i++) {
      const before = new Set(w.projectiles);
      slot.cooldownLeft = 0;
      step(w, IDLE, DT);
      fired.push(...w.projectiles.filter((p) => !before.has(p)));
    }
    const kindled = fired.find((p) => p.tag === 1)!;
    const plain = fired.find((p) => p.tag !== 1)!;
    const innate = plain.hit.burnDps / plain.damage; // Ember's own burn share, if any
    expect(kindled.hit.burnDps).toBeCloseTo(kindled.damage * (innate + rankedValues('ember.kindle', 3).kindledBurnPct));
  });

  it('Will-o-Wisp III: one more wisp stored (4)', () => {
    const w = world();
    rankUp(w, 'ember.wisp', 3);
    const slot = w.moves[0]!;
    for (let i = 0; i < 6; i++) {
      slot.cooldownLeft = 0;
      step(w, IDLE, DT);
    }
    expect(wispCount(slot)).toBe(4);
  });

  it('Inferno Storm: ignites at 25 kills (II) and 20 (III)', () => {
    expect(rankedValues('hurricane.infernoStorm', 2).killsToIgnite).toBe(25);
    expect(rankedValues('hurricane.infernoStorm', 3).killsToIgnite).toBe(20);
  });
});
