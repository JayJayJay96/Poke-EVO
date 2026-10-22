import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import { MOVES, type BeamMoveDef, type MoveId, type OrbitMoveDef, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS, type MutationId } from '../../data/mutations';
import { damageEnemy, makeHitInfo } from '../combat';
import { orbitBalls } from '../forms/orbit';
import { emit, mutationDamageTakenMult, mutationMoveSpeedMult } from '../hooks';
import { grantMutation, isBuilt } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4f-6a: the Squirtle-line learnset Mutations (Surf and Hydro Pump generics are shared with Lapras).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Squirtle with only `move` acting, holding `id` (or no Mutation), invulnerable. */
function withMove(move: MoveId, id: MutationId | null): { w: World; slot: MoveSlot } {
  const w = createWorld({ rng: createSeededRng(21), pokemonId: 'squirtle', spawnEnabled: false });
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
const plainDamage = (move: MoveId) => withMove(move, null).slot.stats.damage;
const ballDistance = (w: World, slot: MoveSlot) => {
  const ball = orbitBalls(slot, MOVES.rapidSpin as OrbitMoveDef, w.player)[0]!;
  return Math.hypot(ball.x - w.player.x, ball.y - w.player.y);
};

describe('Withdraw — Hunker Down', () => {
  it('after a cast: −40% damage taken and −50% walk speed for 1.5 s; −20% damage', () => {
    const v = MUTATIONS['withdraw.hunkerDown'].values;
    const { w, slot } = withMove('withdraw', 'withdraw.hunkerDown');
    expect(slot.stats.damage).toBeCloseTo(plainDamage('withdraw') * v.damageMult);
    dummy(w, 30, 0);
    run(w, DT);
    expect(mutationDamageTakenMult(w)).toBeCloseTo(v.damageTakenMult);
    expect(mutationMoveSpeedMult(w)).toBeCloseTo(v.moveSpeedMult);
    slot.cooldownLeft = 1e9;
    run(w, v.buffSeconds + 0.05);
    expect(mutationDamageTakenMult(w)).toBe(1);
  });
});

describe('Rapid Spin', () => {
  it('Spiral Spin: shells spiral out from 30 to 120 px over the spin', () => {
    const v = MUTATIONS['rapidSpin.spiralSpin'].values;
    const { w, slot } = withMove('rapidSpin', 'rapidSpin.spiralSpin');
    dummy(w, 400, 0);
    run(w, DT * 2);
    expect(ballDistance(w, slot)).toBeLessThan(v.innerRadius + 5);
    run(w, (MOVES.rapidSpin as OrbitMoveDef).duration - 0.1);
    expect(ballDistance(w, slot)).toBeGreaterThan(v.outerRadius - 10);
  });

  it('Deflector: not built, so never offered, until ranged enemies exist (P5)', () => {
    expect(isBuilt('rapidSpin.deflector')).toBe(false);
  });

  it('Shell Spin: each enemy hit cuts Shell recharge by 0.25 s, at most 1.5 s per spin', () => {
    const v = MUTATIONS['rapidSpin.shellSpin'].values;
    const { w, slot } = withMove('rapidSpin', 'rapidSpin.shellSpin');
    for (let i = 0; i < 10; i++) dummy(w, Math.cos(i) * 50, Math.sin(i) * 50);
    w.player.blockReadyLeft = 8;
    run(w, (MOVES.rapidSpin as OrbitMoveDef).duration);
    expect(slot.mutState.cut).toBeGreaterThan(v.rechargeCutPerHit - 1e-9);
    expect(slot.mutState.cut).toBeLessThanOrEqual(v.maxCutPerCast + 1e-9);
  });
});

describe('Water Gun — Wash Down', () => {
  it('Soaks; hit enemies take +20% from Water moves for 3 s; half damage, no push', () => {
    const v = MUTATIONS['waterGun.washDown'].values;
    const { w, slot } = withMove('waterGun', 'waterGun.washDown');
    expect(slot.stats.knockback).toBe(0);
    const e = dummy(w, 100, 0);
    run(w, 0.25);
    expect(e.soakLeft).toBeGreaterThan(0);
    expect(e.vulnType).toBe('Water');
    const other = dummy(w, 300, 300);
    const water = makeHitInfo(createSlot('surf').stats);
    const before = lost(e);
    damageEnemy(w, e, 10, water);
    damageEnemy(w, other, 10, water);
    expect(lost(e) - before).toBeCloseTo(lost(other) * (1 + v.waterDamageTakenPct));
  });
});

describe('Whirlpool', () => {
  it('Maelstrom: drags light enemies to the centre, then collapses into a burst', () => {
    const { w, slot } = withMove('whirlpool', 'whirlpool.maelstrom');
    const target = dummy(w, 150, 0);
    const edge = dummy(w, 150, 40, 'rattata');
    run(w, DT);
    expect(slot.mutState.zoneId).toBeGreaterThan(0);
    slot.cooldownLeft = 1e9;
    run(w, 1);
    expect(Math.abs(edge.y - target.y)).toBeLessThan(40);
    const before = lost(target);
    run(w, (MOVES.whirlpool as ZoneMoveDef).duration);
    const zoneTick = slot.stats.damage * slot.stats.zoneDamageMult;
    expect(lost(target) - before).toBeGreaterThan(zoneTick * 3);
  });

  it('Moat: a ring around you; enemies crossing it are hurt and slowed 70%, the middle is safe', () => {
    const v = MUTATIONS['whirlpool.moat'].values;
    const { w } = withMove('whirlpool', 'whirlpool.moat');
    const inRing = dummy(w, 65, 0);
    const inside = dummy(w, 15, 0, 'rattata');
    run(w, DT);
    expect(lost(inRing)).toBeGreaterThan(0);
    expect(inRing.slow).toBeCloseTo(v.slow);
    expect(lost(inside)).toBe(0);
    expect(w.entities.some((e) => e.owner === 'whirlpool.moat')).toBe(true);
  });

  it('Eye of the Storm: every Shell Burst drops a half-size whirlpool at your feet', () => {
    const v = MUTATIONS['whirlpool.eyeOfTheStorm'].values;
    const { w } = withMove('whirlpool', 'whirlpool.eyeOfTheStorm');
    emit(w, 'shellBurst', 1);
    const zone = w.zones.find((z) => z.source === 'whirlpool');
    expect(zone).toBeDefined();
    expect(zone!.radius).toBeCloseTo((MOVES.whirlpool as ZoneMoveDef).radius * v.sizeMult);
    expect(zone!.x).toBe(w.player.x);
  });
});

describe('Surf', () => {
  it('Ride the Wave: a wall rolls the way you move, hitting what is ahead; you speed up', () => {
    const v = MUTATIONS['surf.rideTheWave'].values;
    const { w } = withMove('surf', 'surf.rideTheWave');
    const ahead = dummy(w, 150, 60);
    const behind = dummy(w, -100, 0);
    run(w, DT, { moveX: 1, moveY: 0 });
    expect(mutationMoveSpeedMult(w)).toBeCloseTo(1 + v.moveSpeedPct);
    run(w, v.travel / v.waveSpeed);
    expect(lost(ahead)).toBeGreaterThan(0);
    expect(lost(behind)).toBe(0);
  });

  it('Backwash: the wave rolls back in for 50% and pulls light enemies in', () => {
    const v = MUTATIONS['surf.backwash'].values;
    const { w, slot } = withMove('surf', 'surf.backwash');
    const e = dummy(w, 80, 0, 'rattata');
    run(w, DT);
    const first = lost(e);
    slot.cooldownLeft = 1e9;
    e.kbX = 0;
    run(w, v.returnDelay + DT);
    expect(lost(e) - first).toBeCloseTo(first * v.returnDamageFraction, 0);
    expect(e.kbX).toBeLessThan(0); // pulled toward the player
  });

  it('Last Wave: below 40% HP Surf comes twice as fast and 30% wider; above it, −20% damage', () => {
    const v = MUTATIONS['surf.lastWave'].values;
    const { w, slot } = withMove('surf', 'surf.lastWave');
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * v.damageMultAbove);
    w.player.hp = w.player.maxHp * 0.3;
    run(w, DT);
    expect(slot.stats.cooldown).toBeCloseTo(slot.baseStats.cooldown * v.cooldownMult);
    expect(slot.stats.reachMult).toBeCloseTo(v.radiusMult);
  });
});

describe('Hydro Pump', () => {
  const def = MOVES.hydroPump as BeamMoveDef;

  it('Split Stream: two beams at ±30°; nothing straight ahead', () => {
    const { w } = withMove('hydroPump', 'hydroPump.splitStream');
    const center = dummy(w, 150, 0); // nearest, so the beams aim at it
    const side = dummy(w, Math.cos(Math.PI / 6) * 200, Math.sin(Math.PI / 6) * 200);
    run(w, def.duration);
    expect(lost(side)).toBeGreaterThan(0);
    expect(lost(center)).toBe(0);
  });

  it('Pressure Build: each tick hits harder; the beam lasts 50% longer', () => {
    const v = MUTATIONS['hydroPump.pressureBuild'].values;
    const { w, slot } = withMove('hydroPump', 'hydroPump.pressureBuild');
    const e = dummy(w, 150, 0);
    const ticks: number[] = [];
    let last = 0;
    for (let i = 0; i < Math.round((def.duration * v.durationMult) / DT); i++) {
      step(w, IDLE, DT);
      if (i === 0) slot.cooldownLeft = 1e9;
      if (lost(e) > last) {
        ticks.push(lost(e) - last);
        last = lost(e);
      }
    }
    expect(ticks.length).toBeGreaterThan(def.duration / def.tickInterval);
    expect(ticks[ticks.length - 1]!).toBeGreaterThan(ticks[0]! * 1.5);
  });

  it('Rain Cannon: rains on enemies around you (not along a beam) and heals per enemy hit, capped', () => {
    const v = MUTATIONS['hydroPump.rainCannon'].values;
    const { w } = withMove('hydroPump', 'hydroPump.rainCannon');
    const around = [dummy(w, 60, 0), dummy(w, -60, 0), dummy(w, 0, 80)];
    const far = dummy(w, 250, 0);
    w.player.hp = 50;
    run(w, def.duration);
    expect(around.every((e) => lost(e) > 0)).toBe(true);
    expect(lost(far)).toBe(0);
    expect(w.player.hp).toBeGreaterThan(50);
    expect(w.player.hp).toBeLessThanOrEqual(50 + v.maxHealPerSec * def.duration + 1);
  });
});

describe('Flash Cannon', () => {
  it('Shrapnel: the shot shatters into 6 shards at the end of its flight', () => {
    const v = MUTATIONS['flashCannon.shrapnel'].values;
    const { w, slot } = withMove('flashCannon', 'flashCannon.shrapnel');
    dummy(w, 300, 200); // in range for aiming, off the line once it flies past
    run(w, DT);
    slot.cooldownLeft = 1e9;
    let shards = 0;
    for (let i = 0; i < Math.round(1.1 / DT) && shards === 0; i++) {
      step(w, IDLE, DT);
      shards = w.entities.filter((e) => e.owner === 'flashCannon.shrapnel').length;
    }
    expect(shards).toBe(v.shards);
  });

  it('Railgun: fires where you move, pierces everything', () => {
    const { w } = withMove('flashCannon', 'flashCannon.railgun');
    dummy(w, 0, 200); // the target is below, but you're running right
    run(w, DT, { moveX: 1, moveY: 0 });
    const p = w.projectiles[0]!;
    expect(p.vx).toBeGreaterThan(0);
    expect(Math.abs(p.vy)).toBeLessThan(1e-6);
    expect(p.pierceLeft).toBeGreaterThan(1e6);
  });

  it('Armor Rounds: after a hit taken, the next shot fires a second round at 60%', () => {
    const v = MUTATIONS['flashCannon.armorRounds'].values;
    const { w, slot } = withMove('flashCannon', 'flashCannon.armorRounds');
    dummy(w, 300, 0);
    run(w, DT);
    expect(w.projectiles.length).toBe(1);
    emit(w, 'hitTaken', 5);
    slot.cooldownLeft = 0;
    run(w, DT);
    const fresh = w.projectiles.slice(-2);
    expect(fresh.length).toBe(2);
    expect(fresh[1]!.damage).toBeCloseTo(fresh[0]!.damage * v.secondRoundFraction);
    expect(fresh[1]!.hit.fromProc).toBe(true);
  });
});
