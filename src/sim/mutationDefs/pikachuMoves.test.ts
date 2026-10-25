import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import { MOVES, type MoveId, type OrbitMoveDef, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS, type MutationId } from '../../data/mutations';
import { applyStatuses } from '../combat';
import { orbitBalls } from '../forms/orbit';
import { emit } from '../hooks';
import { grantMutation } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4f-6d: the Pikachu-line learnset Mutations.

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Pikachu (Raichu at stage 1) with only `move` acting, holding `id`, invulnerable. */
function withMove(move: MoveId, id: MutationId | null, stage = 0): { w: World; slot: MoveSlot } {
  const w = createWorld({ rng: createSeededRng(51), pokemonId: 'pikachu', spawnEnabled: false });
  w.player.stage = stage;
  if (stage >= 1) w.player.ability = 'static.discharge';
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

describe('Quick Attack', () => {
  it('Blink Strike: hits the nearest enemy up to 140 px away; you stay put', () => {
    const { w } = withMove('quickAttack', 'quickAttack.blink');
    const e = dummy(w, 130, 0);
    run(w, DT);
    expect(lost(e)).toBeGreaterThan(0);
    expect(w.player.x).toBe(0);
  });

  it('Double Hit: a second, weaker hit 0.15 s later', () => {
    const v = MUTATIONS['quickAttack.doubleHit'].values;
    const { w, slot } = withMove('quickAttack', 'quickAttack.doubleHit');
    const e = dummy(w, 30, 0);
    run(w, DT);
    const first = lost(e);
    slot.cooldownLeft = 1e9;
    run(w, v.secondHitDelay + DT);
    expect(lost(e) - first).toBeCloseTo(first * v.secondHitFraction, 0);
  });

  it('Volt Tackle: at full Charge Quick Attack dashes for ×3, spends the Charge, costs HP, lands invulnerable', () => {
    const v = MUTATIONS['quickAttack.voltTackle'].values;
    const { w } = withMove('quickAttack', 'quickAttack.voltTackle');
    const e = dummy(w, 100, 0);
    w.player.charge = 100;
    const hp = w.player.hp;
    w.player.invulnLeft = 0; // a real, vulnerable dash: only the recoil may cost HP
    step(w, IDLE, DT);
    expect(w.player.invulnLeft).toBeGreaterThan(v.invulnSeconds - 2 * DT);
    // Spent; landing next to the dummy, Static's touch paralysis may add its usual +15.
    expect(w.player.charge).toBeLessThanOrEqual(15);
    expect(w.player.x).toBeCloseTo(v.dashPx);
    expect(w.player.hp).toBeCloseTo(hp - w.player.maxHp * v.recoilMaxHpFraction);
    expect(lost(e)).toBeGreaterThan(w.moves[1]!.stats.damage * 2.5);
  });

  it('Volt Tackle on Raichu: no auto Discharge; it fires at the end of the dash', () => {
    const { w } = withMove('quickAttack', 'quickAttack.voltTackle', 1);
    dummy(w, 300, 300); // out of dash range: no tackle yet
    w.player.charge = 100;
    run(w, DT * 3);
    expect(w.player.charge).toBe(100); // held
    const near = dummy(w, 80, 0);
    run(w, DT);
    expect(w.player.charge).toBe(0);
    expect(w.blasts.some((b) => b.type === 'Electric')).toBe(true); // the Discharge
    expect(lost(near)).toBeGreaterThan(0);
  });
});

describe('Spark', () => {
  const def = MOVES.spark as OrbitMoveDef;

  it('Arc Pair: the line between the sparks hits enemies the balls miss', () => {
    const { w } = withMove('spark', 'spark.arcPair');
    const inner = dummy(w, 25, 0); // inside the 55 px orbit, on the sweeping line
    run(w, 1);
    expect(lost(inner)).toBeGreaterThan(0);
  });

  it('Spark Shower: when the spin ends, 6 bolts burst outward', () => {
    const v = MUTATIONS['spark.shower'].values;
    const { w } = withMove('spark', 'spark.shower');
    dummy(w, 400, 400);
    run(w, def.duration + DT * 2);
    expect(w.entities.filter((e) => e.owner === 'spark.shower').length).toBe(v.bolts);
  });

  it('Static Spark: each Static paralysis adds a spark for 2 s, up to 3', () => {
    const v = MUTATIONS['spark.staticSpark'].values;
    const { w, slot } = withMove('spark', 'spark.staticSpark');
    dummy(w, 400, 400);
    run(w, DT);
    for (let i = 0; i < 5; i++) emit(w, 'staticProc', 1);
    run(w, DT);
    expect(orbitBalls(slot, def, w.player).length).toBe(def.count + v.maxExtraSparks);
    run(w, v.sparkSeconds);
    expect(orbitBalls(slot, def, w.player).length).toBe(def.count);
  });
});

describe('Electro Ball', () => {
  it('Ricochet: the ball bounces to the next enemy instead of piercing', () => {
    const { w } = withMove('electroBall', 'electroBall.ricochet');
    dummy(w, 100, 0);
    const side = dummy(w, 100, 90); // off the line: only a bounce reaches it
    run(w, 1);
    expect(lost(side)).toBeGreaterThan(0);
  });

  it('Plasma Orb: the ball grows and hits harder as it rolls', () => {
    const v = MUTATIONS['electroBall.plasma'].values;
    const { w, slot } = withMove('electroBall', 'electroBall.plasma');
    dummy(w, 330, 0);
    run(w, DT);
    const p = w.projectiles[0]!;
    const r0 = p.radius;
    run(w, 1);
    expect(p.radius).toBeGreaterThan(r0 * 1.5);
    expect(p.damage).toBeGreaterThan(slot.stats.damage);
    expect(p.damage).toBeLessThanOrEqual(slot.stats.damage * (1 + v.maxDamageBonus) + 1e-9);
  });

  it('Velocity Ball: hits harder the faster you are than the target, capped', () => {
    const v = MUTATIONS['electroBall.velocityBall'].values;
    const { w, slot } = withMove('electroBall', 'electroBall.velocityBall');
    const slow = spawnEnemy(w, 'raticate', 150, 0, 200); // keeps its own speed
    run(w, 0.8);
    const ratio = w.player.speed / slow.speed;
    expect(lost(slow)).toBeCloseTo(slot.stats.damage * (1 + Math.min(v.maxBonus, ratio - 1)), 0);
  });
});

describe('Thunder Wave', () => {
  it('Static Pulse: a ring from you paralyses everything it passes', () => {
    const { w } = withMove('thunderWave', 'thunderWave.pulse');
    const a = dummy(w, 60, 0, 'rattata');
    const b = dummy(w, -120, 0, 'rattata');
    run(w, MUTATIONS['thunderWave.pulse'].values.ringSeconds);
    expect(lost(a)).toBeGreaterThan(0);
    expect(lost(b)).toBeGreaterThan(0);
    expect(b.stunKind).toBe('paralysis');
  });

  it('Electric Terrain: a longer field where Electric damage is +25%; no paralysis', () => {
    const v = MUTATIONS['thunderWave.terrain'].values;
    const { w } = withMove('thunderWave', 'thunderWave.terrain');
    const e = dummy(w, 150, 0);
    run(w, 0.3);
    expect(e.stunLeft).toBe(0);
    expect(e.vulnType).toBe('Electric');
    expect(e.vulnPct).toBeCloseTo(v.electricBonus);
    const zone = w.zones.find((z) => z.source === 'thunderWave')!;
    expect(zone.duration).toBeCloseTo(v.fieldSeconds);
  });

  it('Conductor: the signature chain jumps first to the enemy in a Thunder Wave field', () => {
    const { w } = withMove('thunderWave', 'thunderWave.conductor');
    w.moves[1]!.cooldownLeft = 1e9;
    w.zones.push({
      id: 900,
      x: 300,
      y: 0,
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
    dummy(w, 260, 0); // first hit, in the field
    dummy(w, 260, -90); // nearer, clear of the field
    const inField = dummy(w, 340, 0); // further, inside the field
    w.moves[0]!.cooldownLeft = 0;
    for (let i = 0; i < 60 && w.arcs.length === 0; i++) step(w, IDLE, DT);
    expect(w.arcs[0]!.x2).toBeCloseTo(inField.x); // the first jump went to the field, not the nearer enemy
  });

  it('Conductor: Thunder Wave fields last 4 s and keep their 0.6 s paralysis (D53)', () => {
    const def = MOVES.thunderWave as ZoneMoveDef;
    const { w, slot } = withMove('thunderWave', 'thunderWave.conductor');
    expect(slot.stats.duration * def.duration).toBeCloseTo(def.duration * 2);
    expect(slot.stats.stun).toBeCloseTo(def.onHit!.stun!);
    dummy(w, 150, 0);
    run(w, DT);
    expect(w.zones.find((z) => z.source === 'thunderWave')!.lifeLeft).toBeGreaterThan(def.duration * 2 - 0.1);
  });
});

describe('Iron Tail', () => {
  it('Iron Spin: a 360° tail spin', () => {
    const { w } = withMove('ironTail', 'ironTail.spin');
    dummy(w, 40, 0);
    const behind = dummy(w, -40, 0);
    run(w, DT);
    expect(lost(behind)).toBeGreaterThan(0);
  });

  it('Iron Slam: a telegraphed slam at the target that stuns', () => {
    const v = MUTATIONS['ironTail.slam'].values;
    const { w } = withMove('ironTail', 'ironTail.slam');
    const e = dummy(w, 70, 0, 'rattata');
    run(w, DT);
    expect(lost(e)).toBe(0);
    run(w, v.telegraphSeconds);
    expect(lost(e)).toBeGreaterThan(0);
    expect(e.stunLeft).toBeGreaterThan(0);
  });

  it('Shock Shatter: hitting a paralysed enemy shatters it for ×1.8 and the shock leaps on', () => {
    const v = MUTATIONS['ironTail.shockShatter'].values;
    const { w, slot } = withMove('ironTail', 'ironTail.shockShatter');
    const e = dummy(w, 50, 0);
    const next = dummy(w, 120, 0);
    applyStatuses(e, { slow: 0, stun: 2, poisonDps: 0, stunKind: 'paralysis' });
    run(w, DT);
    expect(lost(e)).toBeCloseTo(slot.stats.damage * v.shatterMult, 0);
    expect(e.stunLeft).toBe(0);
    expect(lost(next)).toBeGreaterThan(0);
  });
});

describe('Thunder (Raichu)', () => {
  it('Storm Call: three smaller strikes on three different enemies', () => {
    const { w } = withMove('thunder', 'thunder.storm', 1);
    const targets = [dummy(w, 100, 0), dummy(w, -100, 0), dummy(w, 0, 150)];
    run(w, 0.6);
    expect(targets.filter((e) => lost(e) > 0).length).toBe(3);
  });

  it('Afterglow: the strike point stays electrified and paralyses enemies that walk in', () => {
    const { w, slot } = withMove('thunder', 'thunder.afterglow', 1);
    const target = dummy(w, 120, 0);
    run(w, 0.6);
    slot.cooldownLeft = 1e9;
    const walker = dummy(w, target.x + 5, target.y, 'rattata');
    run(w, 0.2); // the next field tick
    expect(walker.stunKind).toBe('paralysis');
    expect(w.entities.some((e) => e.owner === 'thunder.afterglow' && e.lifeLeft > 0)).toBe(true);
  });

  it('Thunderstorm: every Discharge calls a strike on the toughest enemy in range', () => {
    const { w, slot } = withMove('thunder', 'thunder.thunderstorm', 1);
    slot.cooldownLeft = 1e9;
    dummy(w, 100, 0);
    const tough = spawnEnemy(w, 'raticate', -150, 0, 500);
    tough.speed = 0;
    run(w, DT);
    emit(w, 'discharge', 1);
    run(w, 0.6);
    expect(lost(tough)).toBeGreaterThan(0);
    expect(slot.stats.cooldown).toBeCloseTo(slot.baseStats.cooldown); // D53: no tax
  });
});
