import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import { MOVES, type BeamMoveDef, type MoveId } from '../../data/moves';
import { MUTATION_TUNING, MUTATIONS, type MutationId } from '../../data/mutations';
import { emit, mutationMoveSpeedMult } from '../hooks';
import { grantMutation } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4f-6e: the Lapras-line learnset Mutations.

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Lapras with only `move` acting, holding `id`, invulnerable. */
function withMove(move: MoveId, id: MutationId | null): { w: World; slot: MoveSlot } {
  const w = createWorld({ rng: createSeededRng(61), pokemonId: 'lapras', spawnEnabled: false });
  w.moves.push(createSlot(move));
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  if (id) expect(grantMutation(w, id)).toBe('granted');
  w.player.invulnLeft = 1e9;
  return { w, slot: w.moves[1]! };
}

function run(w: World, seconds: number, input: InputState = IDLE, invulnerable = true): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    if (invulnerable) w.player.invulnLeft = 1e9;
    step(w, input, DT);
    if (w.offer) w.offer = null;
  }
}

function dummy(w: World, x: number, y: number): Enemy {
  const e = spawnEnemy(w, 'raticate', x, y, 200);
  e.speed = 0;
  return e;
}

function addGem(w: World, x: number, y: number): World['gems'][number] {
  const gem = { id: w.nextId++, x, y, value: 1, magnetized: false, collected: false, expiresAt: Infinity };
  w.gems.push(gem);
  return gem;
}

const lost = (e: Enemy) => e.maxHp - e.hp;

describe('Body Slam', () => {
  it('Belly Flop: nothing until the hop lands, then a 360° slam around you', () => {
    const v = MUTATIONS['bodySlam.bellyFlop'].values;
    const { w, slot } = withMove('bodySlam', 'bodySlam.bellyFlop');
    const front = dummy(w, 60, 0);
    const back = dummy(w, -60, 0);
    run(w, DT);
    expect(lost(front)).toBe(0);
    slot.cooldownLeft = 1e9;
    run(w, v.delaySeconds + DT);
    expect(lost(front)).toBeGreaterThan(0);
    expect(lost(back)).toBeGreaterThan(0);
  });

  it('Belly Flop: the slam lands where you are when the hop ends', () => {
    const v = MUTATIONS['bodySlam.bellyFlop'].values;
    const { w, slot } = withMove('bodySlam', 'bodySlam.bellyFlop');
    dummy(w, 60, 0);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    const far = dummy(w, 0, 200);
    w.player.y = 150; // moved during the hop
    run(w, v.delaySeconds + DT);
    expect(lost(far)).toBeGreaterThan(0);
  });

  it('Shockwave: a wave runs on from the slam at 40%, without paralysis', () => {
    const v = MUTATIONS['bodySlam.shockwave'].values;
    const { w, slot } = withMove('bodySlam', 'bodySlam.shockwave');
    const near = dummy(w, 40, 0);
    const far = dummy(w, 170, 0);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    expect(lost(far)).toBe(0);
    run(w, 0.5);
    expect(lost(far)).toBeCloseTo(slot.stats.damage * v.waveDamageFraction, 0);
    expect(far.stunLeft).toBe(0);
    expect(lost(near)).toBeGreaterThan(0);
  });

  it('Surging Slam: a level-up makes the next 3 slams 360° with 0.5 s paralysis (Flood)', () => {
    const v = MUTATIONS['bodySlam.surge'];
    const { w, slot } = withMove('bodySlam', 'bodySlam.surge');
    dummy(w, 30, 0); // nearest: the plain slam aims at it
    const behind = dummy(w, -50, 0);
    run(w, DT);
    expect(lost(behind)).toBe(0); // plain 140° slam
    emit(w, 'levelUp', 1);
    expect(slot.mutState.empowered).toBe(v.tide.flood.empoweredSlams);
    slot.cooldownLeft = 0;
    behind.stunLeft = 0;
    run(w, DT);
    expect(lost(behind)).toBeGreaterThan(0);
    expect(behind.stunLeft).toBeCloseTo(v.values.paralyseSeconds, 2);
    expect(slot.mutState.empowered).toBe(v.tide.flood.empoweredSlams - 1);
  });

  it('Surging Slam: from the Tide level a level-up empowers only 1 slam (Ebb)', () => {
    const v = MUTATIONS['bodySlam.surge'];
    const { w, slot } = withMove('bodySlam', 'bodySlam.surge');
    w.level = MUTATION_TUNING.tideLevel;
    emit(w, 'levelUp', 1);
    expect(slot.mutState.empowered).toBe(v.tide.ebb.empoweredSlams);
    // D54: no damage cost in Ebb (in Flood it is ×damageMult).
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage);
    w.level = 1;
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * v.values.damageMult);
  });
});

describe('Ice Beam', () => {
  const iceBeam = MOVES.iceBeam as BeamMoveDef;

  it('Ice Wall: a wall forms across the beam end; an enemy on it is pushed to the far side', () => {
    const v = MUTATIONS['iceBeam.iceWall'].values;
    const { w, slot } = withMove('iceBeam', 'iceBeam.iceWall');
    dummy(w, 150, 0);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    const wall = w.entities.find((m) => m.owner === 'iceBeam.iceWall')!;
    const end = iceBeam.length * slot.stats.area * slot.stats.reachMult;
    expect((wall.x + wall.x2) / 2).toBeCloseTo(end);
    expect(Math.hypot(wall.x2 - wall.x, wall.y2 - wall.y)).toBeCloseTo(v.wallWidth * slot.stats.area);
    const stuck = dummy(w, end, 5);
    run(w, DT);
    expect(stuck.x).toBeGreaterThanOrEqual(end + v.wallThickness / 2 + stuck.radius - 0.01);
  });

  it('Ice Wall: an enemy walking at you from behind the wall stays behind it', () => {
    const { w, slot } = withMove('iceBeam', 'iceBeam.iceWall');
    dummy(w, 150, 0);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    const end = iceBeam.length * slot.stats.area * slot.stats.reachMult;
    const walker = spawnEnemy(w, 'raticate', end + 40, 0, 200);
    run(w, 1);
    expect(walker.x).toBeGreaterThan(end);
  });

  it('Aurora Beam: hit enemies deal −20% contact damage for 3 s; the slow is 30%', () => {
    const v = MUTATIONS['iceBeam.aurora'].values;
    const { w, slot } = withMove('iceBeam', 'iceBeam.aurora');
    const e = dummy(w, 100, 0);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    expect(e.weakenMult).toBe(v.contactDamageMult);
    expect(e.weakenLeft).toBeGreaterThan(v.debuffSeconds - 0.1);
    expect(e.slow).toBe(v.slow);
    // Touch the player: the hit is weakened.
    e.x = 10;
    w.player.invulnLeft = 0;
    const hp = w.player.hp;
    run(w, DT, IDLE, false);
    expect(hp - w.player.hp).toBeCloseTo(e.contactDamage * v.contactDamageMult * w.mods.damageTakenMult);
  });

  it('Flash Freeze (Flood): freezes once per beam instead of slowing', () => {
    const v = MUTATIONS['iceBeam.flashFreeze'];
    const { w, slot } = withMove('iceBeam', 'iceBeam.flashFreeze');
    const e = dummy(w, 100, 0);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    expect(e.stunLeft).toBeCloseTo(v.tide.flood.freezeSeconds, 1);
    expect(e.slow).toBe(0);
    run(w, iceBeam.duration);
    // Still frozen from the first tick only, not refreshed by the later ones.
    expect(e.stunLeft).toBeLessThan(v.tide.flood.freezeSeconds - iceBeam.duration + 0.05);
  });

  it('Flash Freeze (Ebb): no freeze; 60% slow and a wider beam', () => {
    const v = MUTATIONS['iceBeam.flashFreeze'];
    const { w, slot } = withMove('iceBeam', 'iceBeam.flashFreeze');
    w.level = MUTATION_TUNING.tideLevel;
    const e = dummy(w, 100, 0);
    run(w, DT * 2); // Lv 30 also brings Sheer Cold (Lv 25), whose stat refresh lasts until the next step
    expect(e.stunLeft).toBe(0);
    expect(e.slow).toBe(v.tide.ebb.slow);
    expect(slot.stats.widthMult).toBeCloseTo(v.tide.ebb.widthMult);
  });
});

describe('Surf', () => {
  it('Ferry Wave (Flood): pulls gems in 1.5× the radius and speeds you up', () => {
    const v = MUTATIONS['surf.ferryWave'];
    const { w, slot } = withMove('surf', 'surf.ferryWave');
    dummy(w, 50, 0);
    const reach = MOVES.surf.form === 'melee' ? MOVES.surf.reach * slot.stats.area * slot.stats.reachMult : 0;
    const inside = addGem(w, 0, reach * v.tide.flood.gemRadiusMult - 5);
    const outside = addGem(w, 0, -(reach * v.tide.flood.gemRadiusMult + 30));
    run(w, DT);
    expect(inside.magnetized || inside.collected).toBe(true);
    expect(outside.magnetized).toBe(false);
    expect(mutationMoveSpeedMult(w)).toBeCloseTo(1 + v.tide.flood.moveSpeedPct);
    slot.cooldownLeft = 1e9;
    run(w, v.tide.flood.speedSeconds + DT);
    expect(mutationMoveSpeedMult(w)).toBe(1);
  });

  it('Ferry Wave (Ebb): only the normal radius, no speed', () => {
    const { w, slot } = withMove('surf', 'surf.ferryWave');
    w.level = MUTATION_TUNING.tideLevel;
    dummy(w, 50, 0);
    const reach = MOVES.surf.form === 'melee' ? MOVES.surf.reach * slot.stats.area * slot.stats.reachMult : 0;
    const beyond = addGem(w, 0, reach + 20);
    run(w, DT);
    expect(beyond.magnetized).toBe(false);
    expect(mutationMoveSpeedMult(w)).toBe(1);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage); // D54: no damage cost in Ebb
  });
});

describe('Hydro Pump', () => {
  it('Pressure Shell: absorbed damage is stored up to 60 (Flood) or 30 (Ebb)', () => {
    const v = MUTATIONS['hydroPump.pressureShell'];
    const { w, slot } = withMove('hydroPump', 'hydroPump.pressureShell');
    emit(w, 'armorAbsorb', 100);
    expect(slot.mutState.stored).toBe(v.tide.flood.storeCap);
    slot.mutState.stored = 0;
    w.level = MUTATION_TUNING.tideLevel;
    emit(w, 'armorAbsorb', 100);
    expect(slot.mutState.stored).toBe(v.tide.ebb.storeCap);
  });

  it('Pressure Shell: the next Hydro Pump adds the store over its ticks, then it is spent', () => {
    const def = MOVES.hydroPump as BeamMoveDef;
    const { w, slot } = withMove('hydroPump', 'hydroPump.pressureShell');
    const base = slot.baseStats.damage;
    slot.mutState.stored = 40;
    dummy(w, 100, 0);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    const ticks = Math.round((def.duration * slot.stats.duration) / def.tickInterval);
    expect(slot.mutState.stored).toBe(0);
    expect(slot.stats.damage).toBeCloseTo(base + 40 / ticks);
    run(w, def.duration);
    expect(slot.stats.damage).toBeCloseTo(base);
  });

  it('Pressure Shell: a real hit through Shell Armor fills the store', () => {
    const { w, slot } = withMove('hydroPump', 'hydroPump.pressureShell');
    const e = dummy(w, 300, 300);
    e.x = 10;
    e.y = 0;
    w.player.invulnLeft = 0;
    slot.cooldownLeft = 1e9;
    run(w, DT, IDLE, false);
    expect(slot.mutState.stored).toBeGreaterThan(0);
  });
});
