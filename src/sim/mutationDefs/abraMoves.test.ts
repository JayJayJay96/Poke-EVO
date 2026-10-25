import { describe, expect, it } from 'vitest';
import { ABILITIES, TUNING } from '../../data/content';
import { MOVES, type MoveId, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS, type MutationId } from '../../data/mutations';
import { applyConfusion, procHit } from '../combat';
import { emit, hooksOf } from '../hooks';
import { grantMutation } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// Abra line (D56, docs/moveset/abra): Teleport, Psychic Echo, Confused, Reflect, the new moves and all 21 Mutations.

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };
const TELEPORT = ABILITIES.teleport.teleport!;

function abra(stage = 0): World {
  const w = createWorld({ rng: createSeededRng(43), pokemonId: 'abra', spawnEnabled: false });
  w.player.stage = stage;
  if (stage >= 1) w.player.ability = 'teleport.echo';
  refreshStats(w);
  w.player.invulnLeft = 1e9;
  return w;
}

function withMove(move: MoveId, id: MutationId | null, stage = 0): { w: World; slot: MoveSlot } {
  const w = abra(stage);
  w.moves.push(createSlot(move));
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  if (id) expect(grantMutation(w, id)).toBe('granted');
  return { w, slot: w.moves[1]! };
}

function withSignature(tier: number, id: MutationId | null): { w: World; slot: MoveSlot } {
  const w = abra(tier);
  const slot = w.moves[0]!;
  slot.moveId = (['confusion', 'psychic', 'expandingForce'] as const)[tier]!;
  if (id) expect(grantMutation(w, id)).toBe('granted');
  refreshStats(w);
  return { w, slot };
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

/** Four enemies hugging the player, so Teleport fires. */
function surround(w: World): Enemy[] {
  return [dummy(w, 30, 0), dummy(w, -30, 0), dummy(w, 0, 30), dummy(w, 0, -30)];
}

describe('Teleport', () => {
  it('surrounded by 4: a 0.3 s telegraph, then a 150 px blink; 8 s recharge', () => {
    const w = abra();
    w.moves[0]!.cooldownLeft = 1e9;
    surround(w);
    run(w, DT);
    expect(w.player.blinkLeft).toBeGreaterThan(0);
    run(w, TELEPORT.telegraph + DT);
    expect(Math.hypot(w.player.x, w.player.y)).toBeCloseTo(TELEPORT.blinkPx, 0);
    expect(w.player.teleportLeft).toBeGreaterThan(TELEPORT.recharge - 0.5);
  });

  it('3 enemies close is not enough', () => {
    const w = abra();
    w.moves[0]!.cooldownLeft = 1e9;
    surround(w).pop()!.hp = 0;
    run(w, 0.5);
    expect(w.player.blinkLeft).toBe(0);
    expect(w.player.x).toBe(0);
  });

  it('Kadabra: the blink leaves a Psychic Echo where you were', () => {
    const w = abra(1);
    w.moves[0]!.cooldownLeft = 1e9;
    const ring = surround(w);
    run(w, TELEPORT.telegraph + 2 * DT);
    expect(ring.every((e) => lost(e) > 0)).toBe(true);
  });

  it('Magic Guard: enemy shots never hurt; Teleport every 6 s', () => {
    const w = abra(2);
    w.player.ability = 'magicGuard';
    expect(ABILITIES.magicGuard.teleport!.recharge).toBe(6);
    const owner = dummy(w, 200, 0);
    w.enemyShots.push({ x: 0, y: 0, vx: 0, vy: 0, radius: 6, left: 1, damage: 30, owner });
    const hp = w.player.hp;
    w.player.invulnLeft = 0;
    step(w, IDLE, DT);
    expect(w.player.hp).toBe(hp);
  });
});

describe('Confused (enemy status)', () => {
  it('a Confused enemy deals no contact damage', () => {
    const w = abra();
    w.moves[0]!.cooldownLeft = 1e9;
    const e = spawnEnemy(w, 'raticate', 5, 0, 200);
    applyConfusion(e, 1);
    expect(e.confuseLeft).toBeCloseTo(1);
    const hp = w.player.hp;
    w.player.invulnLeft = 0;
    step(w, IDLE, DT);
    expect(w.player.hp).toBe(hp);
  });

  it('Confusion (the signature) may Confuse what it hits: 35% per enemy (D57)', () => {
    const { w, slot } = withSignature(0, null);
    expect(slot.stats.confuseChance).toBeCloseTo(0.35);
    const e = dummy(w, 100, 0);
    let confused = false;
    for (let i = 0; i < 40 && !confused; i++) {
      slot.cooldownLeft = 0;
      run(w, DT);
      confused = e.confuseLeft > 0;
    }
    expect(lost(e)).toBeGreaterThan(0);
    expect(confused).toBe(true);
  });

  it('Confusion fatigue (D57): once it ends, no new Confusion for 1.5 s', () => {
    const w = abra();
    w.moves[0]!.cooldownLeft = 1e9;
    const e = dummy(w, 200, 0);
    applyConfusion(e, 0.5);
    run(w, 0.6);
    expect(e.confuseLeft).toBe(0);
    applyConfusion(e, 0.5);
    expect(e.confuseLeft).toBe(0);
    run(w, 1.5);
    applyConfusion(e, 0.5);
    expect(e.confuseLeft).toBeGreaterThan(0);
  });
});

describe('Abra moves', () => {
  it('Expanding Force: the ring hits beyond the burst for 35% (D57); the rest of the burst splashes 60%', () => {
    const { w, slot } = withSignature(2, null);
    slot.stats.critChance = 0;
    const near = dummy(w, 200, 0);
    const splash = dummy(w, 200, 40);
    const ring = dummy(w, 200, 85);
    const out = dummy(w, 200, 125);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(lost(splash)).toBeCloseTo(lost(near) * 0.6, 0);
    expect(lost(ring)).toBeCloseTo(lost(near) * 0.35, 0);
    expect(lost(out)).toBe(0);
  });

  it('Future Sight: nothing lands for 2 s, then the blast', () => {
    const { w, slot } = withMove('futureSight', null, 2);
    const e = dummy(w, 150, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    slot.cooldownLeft = 1e9;
    run(w, 1.5);
    expect(lost(e)).toBe(0);
    run(w, 0.7);
    expect(lost(e)).toBeGreaterThan(0);
  });

  it('Reflect: a barrier on you cuts contact damage 40% and blocks enemy shots', () => {
    const { w, slot } = withMove('reflect', null);
    dummy(w, 100, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(w.player.barrierLeft).toBeGreaterThan(3.5);
    expect(w.player.barrierCut).toBeCloseTo(0.4);
    const owner = dummy(w, 300, 0);
    w.enemyShots.push({ x: 60, y: 0, vx: -100, vy: 0, radius: 6, left: 1, damage: 30, owner });
    run(w, DT);
    expect(w.enemyShots.length).toBe(0);
  });

  it('Swift homes; Psybeam may Confuse (20% per hit)', () => {
    expect(withMove('swift', null).slot.stats.homing).toBe(true);
    const { slot } = withMove('psybeam', null);
    expect(slot.stats.confuse).toBeCloseTo(0.5);
    expect(slot.stats.confuseChance).toBeCloseTo(0.2);
  });

  it('Synchronize: Psychic moves +30%', () => {
    const w = abra(2);
    const plain = w.moves[0]!.stats.damage;
    w.player.ability = 'synchronize';
    refreshStats(w);
    expect(w.moves[0]!.stats.damage / plain).toBeCloseTo((1 + TUNING.stabBonus + 0.3) / (1 + TUNING.stabBonus));
  });
});

describe('Signature Mutations', () => {
  it('Mind Lock: hits mark the enemy (+15% from your other moves)', () => {
    const v = MUTATIONS['confusion.mindLock'].values;
    const { w, slot } = withSignature(0, 'confusion.mindLock');
    const e = dummy(w, 100, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(e.psyMarkLeft).toBeGreaterThan(0);
    expect(e.psyMarkPct).toBeCloseTo(v.markPct);
  });

  it('Gravity Well: light enemies are pulled toward the target before the burst', () => {
    const { w, slot } = withSignature(0, 'confusion.gravityWell');
    const target = dummy(w, 100, 0);
    const side = dummy(w, 100, 50, 'rattata');
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(lost(target)).toBeGreaterThan(0);
    expect(side.y).toBeLessThan(50);
  });

  it('Psy Split: bursts on 3 nearest enemies at Psychic', () => {
    const { w, slot } = withSignature(1, 'confusion.psySplit');
    const es = [dummy(w, 100, 0), dummy(w, -120, 0), dummy(w, 0, 140)];
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(es.every((e) => lost(e) > 0)).toBe(true);
  });
});

describe('Psybeam Mutations', () => {
  it('Signal Sweep: the beam turns while it fires', () => {
    const { w, slot } = withMove('psybeam', 'psybeam.signalSweep');
    dummy(w, 150, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    const first = hooksOf(slot)!.beamDirs!(w, slot)[0]!;
    run(w, 0.4);
    const later = hooksOf(slot)!.beamDirs!(w, slot)[0]!;
    expect(Math.abs(Math.atan2(later[1], later[0]) - Math.atan2(first[1], first[0]))).toBeGreaterThan(0.3);
  });

  it('Disorient: every hit Confuses', () => {
    const { w, slot } = withMove('psybeam', 'psybeam.disorient');
    const e = dummy(w, 150, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(e.confuseLeft).toBeGreaterThan(0);
  });

  it('Blink Beam: a Teleport fires a beam along the blink', () => {
    const { w, slot } = withMove('psybeam', 'psybeam.blinkBeam');
    slot.cooldownLeft = 1e9;
    const mid = dummy(w, 75, 0);
    run(w, DT);
    w.player.blinkFromX = 0;
    w.player.blinkFromY = 0;
    w.player.x = 150;
    emit(w, 'teleport', 1);
    expect(lost(mid)).toBeGreaterThan(0);
  });
});

describe('Kinesis Mutations', () => {
  it('Spoon Guard: spoons eat enemy shots', () => {
    const { w, slot } = withMove('kinesis', 'kinesis.spoonGuard');
    slot.cooldownLeft = 1e9;
    const owner = dummy(w, 300, 0);
    slot.activeLeft = 3;
    slot.angle = 0;
    const shot = { x: 70, y: 0, vx: 0, vy: 0, radius: 6, left: 1, damage: 10, owner };
    w.enemyShots.push(shot);
    run(w, DT);
    expect(shot.left).toBe(0); // removed from the list on the next step
  });

  it('Fling Spoons: when the orbit ends, the spoons fly at enemies', () => {
    const { w, slot } = withMove('kinesis', 'kinesis.fling');
    slot.cooldownLeft = 1e9;
    const far = dummy(w, 250, 0);
    run(w, DT);
    hooksOf(slot)!.onExpire!(w, slot);
    expect(lost(far)).toBeGreaterThan(0);
  });

  it('Spoon Bender: crits Confused enemies and keeps them Confused', () => {
    const { w, slot } = withMove('kinesis', 'kinesis.spoonBender');
    const e = dummy(w, 70, 0);
    applyConfusion(e, 1);
    expect(hooksOf(slot)!.forceCrit!(w, slot, e)).toBe(true);
    hooksOf(slot)!.onHit!(w, slot, e, 1, procHit('Psychic'));
    expect(e.confuseLeft).toBeCloseTo(1.3);
  });
});

describe('Psycho Cut Mutations', () => {
  it('Keen Psycho: +25% crit, narrower', () => {
    const { slot } = withMove('psychoCut', 'psychoCut.keen');
    expect(slot.stats.critChance).toBeCloseTo(0.4);
    expect(slot.stats.arcMult).toBeCloseTo(0.7);
  });

  it('Psycho Wave: the slash sends a wave down the line', () => {
    const { w, slot } = withMove('psychoCut', 'psychoCut.wave');
    dummy(w, 50, 0);
    const far = dummy(w, 115, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(lost(far)).toBeGreaterThan(0);
  });

  it('Flowing Cut: moving, the slash leaves a line; standing ×0.85', () => {
    const { w, slot } = withMove('psychoCut', 'psychoCut.flowingCut');
    slot.cooldownLeft = 1e9;
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * 0.85);
    run(w, 1.1, { moveX: 1, moveY: 0 });
    dummy(w, w.player.x + 40, 0);
    slot.cooldownLeft = 0;
    run(w, DT, { moveX: 1, moveY: 0 });
    expect(w.entities.some((e) => e.owner === 'psychoCut.flowingCut')).toBe(true);
  });
});

describe('Reflect Mutations', () => {
  it('Light Screen: also cuts telegraphed attacks; lasts less', () => {
    const { w, slot } = withMove('reflect', 'reflect.lightScreen');
    dummy(w, 100, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(w.player.barrierRangedCut).toBeCloseTo(0.4);
    expect(w.player.barrierLeft).toBeLessThan(3.1);
  });

  it('Mirror Coat: contact attackers take half back', () => {
    const { w, slot } = withMove('reflect', 'reflect.mirrorCoat');
    const e = spawnEnemy(w, 'raticate', 100, 0, 200);
    e.speed = 0;
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(w.player.barrierThorns).toBeCloseTo(0.5);
    e.x = 5;
    e.y = 0;
    w.player.invulnLeft = 0;
    step(w, IDLE, DT);
    expect(lost(e)).toBeGreaterThan(0);
  });

  it('Barrier Echo: 5 hits behind the barrier pulse 120 px', () => {
    const { w, slot } = withMove('reflect', 'reflect.barrierEcho');
    const e = dummy(w, 100, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    slot.cooldownLeft = 1e9;
    for (let i = 0; i < 5; i++) emit(w, 'hitTaken', 5, e);
    expect(lost(e)).toBeGreaterThan(0);
  });
});

describe('Swift Mutations', () => {
  it('Star Storm: five stars', () => {
    const { w, slot } = withMove('swift', 'swift.starStorm');
    dummy(w, 150, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(w.projectiles.length).toBe(5);
  });

  it('Comet Star: one star that pierces everything', () => {
    const { w, slot } = withMove('swift', 'swift.comet');
    dummy(w, 150, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(w.projectiles.length).toBe(1);
    expect(slot.stats.pierce).toBeGreaterThan(100);
  });

  it('Shooting Stars: a kill sends one seeking star (a copy), rate-limited', () => {
    const { w, slot } = withMove('swift', 'swift.shootingStars');
    slot.cooldownLeft = 1e9;
    dummy(w, 150, 0);
    run(w, DT);
    emit(w, 'kill', 1);
    emit(w, 'kill', 1);
    expect(w.projectiles.length).toBe(1);
    expect(w.projectiles[0]!.hit.fromProc).toBe(true);
  });
});

describe('Future Sight Mutations', () => {
  const def = MOVES.futureSight as ZoneMoveDef;

  it('Foresight Field: three marks on separate spots', () => {
    const { w, slot } = withMove('futureSight', 'futureSight.field', 2);
    const es = [dummy(w, 150, 0), dummy(w, -150, 0), dummy(w, 0, 160)];
    slot.cooldownLeft = 0;
    run(w, DT);
    slot.cooldownLeft = 1e9;
    run(w, def.delay! + 0.2);
    expect(es.every((e) => lost(e) > 0)).toBe(true);
  });

  it('Prophecy: lands after 3 s', () => {
    const { w, slot } = withMove('futureSight', 'futureSight.prophecy', 2);
    const e = dummy(w, 150, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    slot.cooldownLeft = 1e9;
    run(w, 2.6);
    expect(lost(e)).toBe(0);
    run(w, 0.6);
    expect(lost(e)).toBeGreaterThan(0);
  });

  it('Echo Sight: an Echo plants a Future Sight where it went off', () => {
    const { w, slot } = withMove('futureSight', 'futureSight.echoSight', 2);
    slot.cooldownLeft = 1e9;
    const e = dummy(w, -100, 0);
    run(w, DT);
    w.player.echoX = -100;
    w.player.echoY = 0;
    emit(w, 'echo', 1);
    run(w, def.delay! + 0.2);
    expect(lost(e)).toBeGreaterThan(0);
  });
});
