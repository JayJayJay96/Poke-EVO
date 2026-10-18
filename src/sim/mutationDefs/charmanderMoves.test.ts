import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import { MOVES, type BeamMoveDef, type MeleeMoveDef, type MoveId, type OrbitMoveDef } from '../../data/moves';
import { MUTATIONS, type MutationId } from '../../data/mutations';
import { orbitBalls } from '../forms/orbit';
import { emit, mutationMoveSpeedMult } from '../hooks';
import { grantMutation } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4f-6b: the Charmander-line learnset Mutations (Smokescreen, Slash, Wing Attack arrive in P4f-7).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Charmander (at `stage`) with only `move` acting, holding `id`, invulnerable. */
function withMove(move: MoveId, id: MutationId | null, stage = 0): { w: World; slot: MoveSlot } {
  const w = createWorld({ rng: createSeededRng(31), pokemonId: 'charmander', spawnEnabled: false });
  w.player.stage = stage;
  w.moves.push(createSlot(move));
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  if (id) expect(grantMutation(w, id)).toBe('granted');
  w.player.invulnLeft = 1e9;
  return { w, slot: w.moves[1]! };
}

function run(w: World, seconds: number, input: InputState = IDLE): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.player.invulnLeft = 1e9;
    step(w, input, DT);
    if (w.offer) w.offer = null;
  }
}

function dummy(w: World, x: number, y: number, kind: 'rattata' | 'raticate' = 'raticate'): Enemy {
  const e = spawnEnemy(w, kind, x, y, 200);
  e.speed = 0;
  return e;
}

const lost = (e: Enemy) => e.maxHp - e.hp;

describe('Scratch', () => {
  it('Fury Swipes: hits on the same enemy within 2 s stack +15% each (max 5); narrower arc', () => {
    const v = MUTATIONS['scratch.furySwipes'].values;
    const { w, slot } = withMove('scratch', 'scratch.furySwipes');
    expect(slot.stats.arcMult).toBeCloseTo(v.arcMult);
    const e = dummy(w, 30, 0);
    const hits: number[] = [];
    let last = 0;
    for (let i = 0; i < 7; i++) {
      slot.cooldownLeft = 0;
      step(w, IDLE, DT);
      hits.push(lost(e) - last);
      last = lost(e);
    }
    expect(hits[1]! / hits[0]!).toBeCloseTo(1 + v.stackPct);
    expect(hits[6]! / hits[0]!).toBeCloseTo(1 + v.stackPct * v.maxStacks);
  });

  it('Crescent: a 200° arc and a slash wave that reaches past the claw', () => {
    const { w } = withMove('scratch', 'scratch.crescent');
    const reach = (MOVES.scratch as MeleeMoveDef).reach * MUTATIONS['scratch.crescent'].values.reachMult;
    const near = dummy(w, 30, 0);
    const past = dummy(w, reach + 40, 0);
    const side = dummy(w, -5, 35); // ~100° off the swing direction
    step(w, IDLE, DT);
    expect(lost(near)).toBeGreaterThan(0);
    expect(lost(past)).toBeGreaterThan(0);
    expect(lost(side)).toBeGreaterThan(0);
  });

  it('Blaze Claws: with Blaze on, Scratch turns Fire (Burn, STAB) and reaches 30% further; −15% otherwise', () => {
    const v = MUTATIONS['scratch.blazeClaws'].values;
    const { w, slot } = withMove('scratch', 'scratch.blazeClaws');
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * v.damageMultOff);
    w.player.hp = w.player.maxHp * 0.2;
    run(w, DT);
    expect(slot.stats.attackType).toBe('Fire');
    expect(slot.stats.burnPct).toBeCloseTo(v.burnPct);
    expect(slot.stats.reachMult).toBeCloseTo(v.reachMult);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * (1 + TUNING.stabBonus));
  });
});

describe('Fire Spin', () => {
  const def = MOVES.fireSpin as OrbitMoveDef;

  it('Vortex: when the spin ends, a burst around you', () => {
    const { w } = withMove('fireSpin', 'fireSpin.vortex');
    const e = dummy(w, 100, 0); // outside the 70 px orbit, inside the 110 px burst
    run(w, def.duration + DT * 2);
    expect(lost(e)).toBeGreaterThan(0);
  });

  it('Flame Trail: the flames leave Scorch as they spin', () => {
    const { w } = withMove('fireSpin', 'fireSpin.flameTrail');
    dummy(w, 300, 0);
    run(w, 1);
    expect(w.scorches.length).toBeGreaterThan(0);
  });

  it('Tail Flame: +1 flame below 70% HP, +2 and Burn below 40%', () => {
    const v = MUTATIONS['fireSpin.tailFlame'].values;
    const { w, slot } = withMove('fireSpin', 'fireSpin.tailFlame');
    run(w, DT);
    expect(orbitBalls(slot, def, w.player).length).toBe(def.count);
    w.player.hp = w.player.maxHp * 0.6;
    run(w, DT);
    expect(orbitBalls(slot, def, w.player).length).toBe(def.count + 1);
    w.player.hp = w.player.maxHp * 0.3;
    run(w, DT);
    expect(orbitBalls(slot, def, w.player).length).toBe(def.count + 2);
    expect(slot.stats.burnPct).toBeCloseTo(v.burnPct);
  });
});

describe('Dragon Rage', () => {
  const def = MOVES.dragonRage as BeamMoveDef;

  it('Fixed Rage: fixed damage per tick that grows with level and ignores types and boosts', () => {
    const v = MUTATIONS['dragonRage.fixedRage'].values;
    const { w, slot } = withMove('dragonRage', 'dragonRage.fixedRage');
    w.level = 12;
    w.boosts.damage = 5;
    refreshStats(w);
    run(w, DT);
    expect(slot.stats.damage).toBe(v.fixedDamage + Math.floor(12 / v.levelsPerPoint));
    expect(slot.stats.attackType).toBeNull();
  });

  it('Dragon Breath: a short cone (not a long beam)', () => {
    const { w } = withMove('dragonRage', 'dragonRage.dragonBreath');
    const near = dummy(w, 100, 10, 'rattata');
    const far = dummy(w, 220, 0);
    run(w, def.duration);
    expect(lost(near)).toBeGreaterThan(0);
    expect(lost(far)).toBe(0); // beyond the 140 px cone
  });

  it('Cornered Dragon: each Flare Up fires Dragon Rage in a cross at once and resets it', () => {
    const { w, slot } = withMove('dragonRage', 'dragonRage.corneredDragon', 1);
    const up = dummy(w, 0, -150);
    const left = dummy(w, -150, 0);
    slot.cooldownLeft = 5;
    run(w, DT); // builds the spatial hash
    emit(w, 'flareUp', 1);
    expect(lost(up)).toBeGreaterThan(0);
    expect(lost(left)).toBeGreaterThan(0);
    expect(slot.cooldownLeft).toBe(0);
  });
});

describe('Air Slash (Charizard)', () => {
  it('Crosscut: both blades converge on the target; the second always crits', () => {
    const { w } = withMove('airSlash', 'airSlash.crosscut', 2);
    const e = dummy(w, 200, 0);
    step(w, IDLE, DT);
    expect(w.projectiles.length).toBe(2);
    expect(w.projectiles[1]!.hit.critChance).toBe(1);
    run(w, 0.5);
    expect(lost(e)).toBeGreaterThan(w.moves[1]!.stats.damage * 2);
  });

  it('Tailwind: each blade hit gives +3% move speed for 2 s, up to +15%', () => {
    const v = MUTATIONS['airSlash.tailwind'].values;
    const { w, slot } = withMove('airSlash', 'airSlash.tailwind', 2);
    dummy(w, 150, 0);
    for (let i = 0; i < 6; i++) {
      slot.cooldownLeft = 0;
      run(w, 0.3);
    }
    expect(mutationMoveSpeedMult(w)).toBeCloseTo(1 + v.maxSpeedPct);
    slot.cooldownLeft = 1e9;
    run(w, v.speedSeconds + 0.4);
    expect(mutationMoveSpeedMult(w)).toBe(1);
  });

  it('Aerial Ace: after 1 s of flying the blades home and crit more; standing still costs 25%', () => {
    const v = MUTATIONS['airSlash.aerialAce'].values;
    const { w, slot } = withMove('airSlash', 'airSlash.aerialAce', 2);
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * v.damageMultStill);
    run(w, v.movingSeconds + DT, { moveX: 1, moveY: 0 });
    expect(slot.stats.homing).toBe(true);
    expect(slot.stats.critChance).toBeCloseTo(slot.baseStats.critChance + v.critBonus);
  });
});

describe('Hurricane (Charizard)', () => {
  it('Tornado: the storm travels the way you were moving instead of circling you', () => {
    const v = MUTATIONS['hurricane.tornado'].values;
    const { w, slot } = withMove('hurricane', 'hurricane.tornado', 2);
    run(w, DT, { moveX: 1, moveY: 0 });
    expect(slot.anchored).toBe(true);
    run(w, 1);
    expect(slot.anchorX).toBeGreaterThan(v.travelSpeed * 0.9);
    expect(Math.abs(w.player.x - slot.anchorX)).toBeGreaterThan(50);
  });

  it('Gale Wall: the winds shove enemies outward', () => {
    const { w } = withMove('hurricane', 'hurricane.galeWall', 2);
    const e = dummy(w, 110, 0, 'rattata');
    run(w, 0.6);
    expect(Math.hypot(e.x, e.y)).toBeGreaterThan(110);
  });

  it('Inferno Storm: kills extend the storm (max +1.5 s); 30 kills turn it Fire and Burning', () => {
    const v = MUTATIONS['hurricane.infernoStorm'].values;
    const { w, slot } = withMove('hurricane', 'hurricane.infernoStorm', 2);
    run(w, DT);
    const left = slot.activeLeft;
    emit(w, 'kill', 1);
    expect(slot.activeLeft).toBeCloseTo(left + v.secondsPerKill);
    for (let i = 0; i < v.killsToIgnite; i++) emit(w, 'kill', 1);
    expect(slot.activeLeft).toBeLessThanOrEqual(left + v.maxBonusSeconds + 1e-9);
    run(w, DT);
    expect(slot.stats.attackType).toBe('Fire');
    expect(slot.stats.burnPct).toBeCloseTo(v.burnPct);
  });
});
