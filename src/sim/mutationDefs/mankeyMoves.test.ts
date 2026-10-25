import { describe, expect, it } from 'vitest';
import { ABILITIES, TUNING } from '../../data/content';
import { MOVES, type MoveId, type OrbitMoveDef, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS, type MutationId } from '../../data/mutations';
import { emit, hooksOf } from '../hooks';
import { grantMutation } from '../mutations';
import { rageCooldownRate, rampageDamageMult } from '../rage';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, hitPlayer, spawnEnemy, step } from '../world';

// Mankey line (D56, docs/moveset/mankey): Anger Point, Rampage, the new moves and all 21 Mutations.

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };
const RAGE = ABILITIES.angerPoint.rage!;

function mankey(stage = 0): World {
  const w = createWorld({ rng: createSeededRng(41), pokemonId: 'mankey', spawnEnabled: false });
  w.player.stage = stage;
  if (stage >= 1) w.player.ability = 'angerPoint.thrash';
  refreshStats(w);
  w.player.invulnLeft = 1e9;
  return w;
}

/** Mankey (at `stage`) with only `move` acting, holding `id`. */
function withMove(move: MoveId, id: MutationId | null, stage = 0): { w: World; slot: MoveSlot } {
  const w = mankey(stage);
  w.moves.push(createSlot(move));
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  if (id) expect(grantMutation(w, id)).toBe('granted');
  return { w, slot: w.moves[1]! };
}

/** The signature slot at a given tier (0 Karate Chop, 1 Cross Chop, 2 Rage Fist), holding `id`. */
function withSignature(tier: number, id: MutationId | null): { w: World; slot: MoveSlot } {
  const w = mankey(tier);
  const slot = w.moves[0]!;
  slot.moveId = (['karateChop', 'crossChop', 'rageFist'] as const)[tier]!;
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

function dummy(w: World, x: number, y: number, kind: 'rattata' | 'raticate' | 'tauros' = 'raticate'): Enemy {
  const e = spawnEnemy(w, kind, x, y, 200);
  e.speed = 0;
  return e;
}

const lost = (e: Enemy) => e.maxHp - e.hp;

describe('Anger Point (Rage)', () => {
  it('hits taken fill Rage; Contact hits add 1 each, at most 5 per cast; other moves add none', () => {
    const w = mankey();
    const e = dummy(w, 300, 0);
    hitPlayer(w, 5, e);
    expect(w.player.rage).toBe(RAGE.perHitTaken);
    const { w: w2, slot } = withMove('lowKick', null);
    for (let i = 0; i < 8; i++) dummy(w2, 30 * Math.cos(i), 30 * Math.sin(i), 'rattata');
    slot.cooldownLeft = 0;
    run(w2, DT);
    expect(w2.player.rage).toBe(RAGE.maxContactPerCast * RAGE.perContactHit);
    const { w: w3, slot: wave } = withMove('vacuumWave', null);
    dummy(w3, 100, 0);
    wave.cooldownLeft = 0;
    run(w3, 0.3);
    expect(w3.player.rage).toBe(0);
  });

  it('Rage drains once no hit is dealt or taken for 3 s, and speeds cooldowns up to 20%', () => {
    const w = mankey();
    w.player.rage = 100;
    expect(rageCooldownRate(w)).toBeCloseTo(1 / (1 - RAGE.maxCooldownCut));
    run(w, RAGE.drainAfter - 0.5);
    expect(w.player.rage).toBe(100);
    run(w, 1.5);
    expect(w.player.rage).toBeLessThan(100);
  });

  it('Mankey stage: full Rage never Rampages', () => {
    const w = mankey(0);
    w.player.rage = 100;
    run(w, DT);
    expect(w.player.rampageLeft).toBe(0);
  });

  it('Primeape: full Rage starts a 5 s Rampage (+30% damage); it ends with Rage empty and Confusion', () => {
    const w = mankey(1);
    w.player.rage = 100;
    run(w, DT);
    expect(w.player.rampageLeft).toBeGreaterThan(0);
    expect(rampageDamageMult(w)).toBeCloseTo(1.3);
    run(w, ABILITIES['angerPoint.thrash'].rage!.rampage!.seconds + 0.1);
    expect(w.player.rampageLeft).toBe(0);
    expect(w.player.rage).toBe(0);
    expect(w.playerStatus.confuseLeft).toBeGreaterThan(0);
  });

  it('Defiant fills Rage 50% faster from hits; Vital Spirit ignores statuses and heals on Rampage', () => {
    const w = mankey(2);
    w.player.ability = 'defiant';
    hitPlayer(w, 5, dummy(w, 300, 0));
    expect(w.player.rage).toBeCloseTo(RAGE.perHitTaken * 1.5);
    const v = mankey(2);
    v.player.ability = 'vitalSpirit';
    v.player.hp = 50;
    v.player.rage = 100;
    run(v, DT);
    expect(v.player.hp).toBeGreaterThan(50);
    run(v, 5.1);
    expect(v.playerStatus.confuseLeft).toBe(0);
  });
});

describe('Mankey moves', () => {
  it('Low Kick hits heavier enemies harder', () => {
    const { w, slot } = withMove('lowKick', null);
    const light = dummy(w, 30, 0, 'rattata');
    const heavy = dummy(w, -30, 0, 'tauros');
    slot.stats.critChance = 0;
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(lost(heavy)).toBeGreaterThan(lost(light) * 1.4);
  });

  it('Close Combat drops your guard: +15% damage taken for 2 s', () => {
    const { w, slot } = withMove('closeCombat', null, 1);
    const e = dummy(w, 40, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(w.player.vulnLeft).toBeGreaterThan(0);
    const hp = w.player.hp;
    hitPlayer(w, 10, e);
    expect(hp - w.player.hp).toBeCloseTo(10 * w.mods.damageTakenMult * 1.15);
  });

  it('Rage Fist hits up to 40% harder with full Rage', () => {
    const hitAt = (rage: number) => {
      const { w, slot } = withSignature(2, null);
      w.player.ability = 'angerPoint'; // no Rampage in this measurement
      slot.stats.critChance = 0;
      const e = dummy(w, 150, 0);
      w.player.rage = rage;
      w.player.rageIdle = -1e9; // no drain during the test
      slot.cooldownLeft = 0;
      run(w, 0.5);
      return lost(e);
    };
    expect(hitAt(100) / hitAt(0)).toBeCloseTo(1.4, 1);
  });

  it('Shadow Punch homes', () => {
    const { slot } = withMove('shadowPunch', null, 2);
    expect(slot.stats.homing).toBe(true);
  });

  it('Seismic Toss: an instant 60 px slam on the nearest enemy', () => {
    const { w, slot } = withMove('seismicToss', null);
    const a = dummy(w, 100, 0);
    const b = dummy(w, 140, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(lost(a)).toBeGreaterThan(0);
    expect(lost(b)).toBeGreaterThan(0);
    expect((MOVES.seismicToss as ZoneMoveDef).radius).toBe(60);
  });
});

describe('Signature Mutations', () => {
  it('Combo Chain: hits within 1.5 s stack', () => {
    const { w, slot } = withSignature(0, 'karateChop.combo');
    dummy(w, 30, 0);
    for (let i = 0; i < 3; i++) {
      slot.cooldownLeft = 0;
      run(w, DT);
    }
    expect(slot.mutState.stacks).toBe(3);
  });

  it('Combo Chain: a full combo bursts 90 px at Cross Chop', () => {
    const v = MUTATIONS['karateChop.combo'].values;
    const { w, slot } = withSignature(1, 'karateChop.combo');
    slot.cooldownLeft = 1e9;
    const far = dummy(w, 0, 85);
    run(w, DT); // builds the spatial hash
    slot.mutState.stacks = v.maxStacks;
    slot.mutState.lastHit = w.time;
    hooksOf(slot)!.onCast!(w, slot);
    expect(lost(far)).toBeGreaterThan(0);
    expect(slot.mutState.stacks).toBe(0);
  });

  it('Vacuum Chop: a wave hits down the line; X-shaped at Cross Chop; a trail at Rage Fist', () => {
    const { w, slot } = withSignature(1, 'karateChop.vacuum');
    slot.cooldownLeft = 1e9;
    const line = dummy(w, 130, 0);
    const side = dummy(w, Math.cos(Math.PI / 6) * 120, Math.sin(Math.PI / 6) * 120);
    run(w, DT);
    hooksOf(slot)!.onCast!(w, slot);
    expect(lost(line)).toBeGreaterThan(0);
    expect(lost(side)).toBeGreaterThan(0);
    const { w: w2, slot: s2 } = withSignature(2, 'karateChop.vacuum');
    s2.cooldownLeft = 1e9;
    dummy(w2, 130, 0);
    run(w2, DT);
    hooksOf(s2)!.onCast!(w2, s2);
    expect(w2.entities.some((e) => e.owner === 'karateChop.vacuum')).toBe(true);
  });

  it('Rage Release: up to +40% damage with Rage; Rage drains twice as fast', () => {
    const { w, slot } = withSignature(0, 'karateChop.rageRelease');
    const e = dummy(w, 30, 0);
    w.player.rage = 100;
    expect(hooksOf(slot)!.damageMult!(w, slot, e)).toBeCloseTo(1.4);
    expect(hooksOf(slot)!.rageDrainMult!(w, slot)).toBe(2);
  });
});

describe('Low Kick Mutations', () => {
  it('Trip: a light enemy falls down', () => {
    const { w, slot } = withMove('lowKick', 'lowKick.trip');
    const e = dummy(w, 30, 0, 'rattata');
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(e.stunLeft).toBeGreaterThan(0);
  });

  it('Heavy Hitter: heavy targets take far more than with the plain scaling', () => {
    const { w, slot } = withMove('lowKick', 'lowKick.heavyHitter');
    const tauros = dummy(w, 30, 0, 'tauros');
    const rattata = dummy(w, -30, 0, 'rattata');
    expect(hooksOf(slot)!.damageMult!(w, slot, tauros)).toBeGreaterThan(1.2);
    expect(hooksOf(slot)!.damageMult!(w, slot, rattata)).toBeLessThan(0.7);
  });

  it('Brawlers Rhythm: kills widen the next kick (+10% each, max 40%)', () => {
    const { w, slot } = withMove('lowKick', 'lowKick.brawlersRhythm');
    for (let i = 0; i < 6; i++) emit(w, 'kill', 1);
    slot.cooldownLeft = 1e9;
    run(w, DT);
    expect(slot.stats.reachMult).toBeCloseTo(1.4);
  });
});

describe('Vacuum Wave Mutations', () => {
  it('Aura Wave: homes, pierce 3 → 1', () => {
    const { slot } = withMove('vacuumWave', 'vacuumWave.auraWave');
    expect(slot.stats.homing).toBe(true);
    expect(slot.stats.pierce + (MOVES.vacuumWave.form === 'projectile' ? MOVES.vacuumWave.pierce! : 0)).toBe(1);
  });

  it('Spread Wave: three waves', () => {
    const { w, slot } = withMove('vacuumWave', 'vacuumWave.spread');
    dummy(w, 150, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(w.projectiles.length).toBe(3);
  });

  it('Shockfist: a hit taken fires a free wave (a copy), at most every 0.8 s', () => {
    const { w, slot } = withMove('vacuumWave', 'vacuumWave.shockfist');
    slot.cooldownLeft = 1e9;
    const e = dummy(w, 100, 0);
    run(w, DT);
    emit(w, 'hitTaken', 5, e);
    emit(w, 'hitTaken', 5, e);
    const shots = w.projectiles;
    expect(shots.length).toBe(1);
    expect(shots[0]!.hit.fromProc).toBe(true);
  });
});

describe('Seismic Toss Mutations', () => {
  it('Submission: the slam lands on the densest cluster', () => {
    const { w, slot } = withMove('seismicToss', 'seismicToss.submission');
    const lone = dummy(w, 0, 90);
    const pack = [dummy(w, 150, 0), dummy(w, 165, 10), dummy(w, 160, -12)];
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(pack.every((e) => lost(e) > 0)).toBe(true);
    expect(lost(lone)).toBe(0);
  });

  it('Level Toss: fixed 10 + 1 per level, typeless', () => {
    const { w, slot } = withMove('seismicToss', 'seismicToss.levelToss');
    w.level = 12;
    slot.cooldownLeft = 1e9;
    run(w, DT);
    expect(slot.stats.damage).toBe(22);
    expect(slot.stats.attackType).toBeNull();
  });

  it('Running Throw: ×1.3 wider after moving 1 s; ×0.85 damage standing', () => {
    const { w, slot } = withMove('seismicToss', 'seismicToss.runningThrow');
    slot.cooldownLeft = 1e9;
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * 0.85);
    run(w, 1.1, { moveX: 1, moveY: 0 });
    expect(slot.stats.area).toBeCloseTo(slot.baseStats.area * 1.3);
  });
});

describe('Thrash Mutations', () => {
  const def = MOVES.thrash as OrbitMoveDef;

  it('Outrage: lasts twice as long, then Confuses you', () => {
    const { w, slot } = withMove('thrash', 'thrash.outrage');
    expect(slot.stats.duration).toBeCloseTo(2);
    dummy(w, 60, 0);
    slot.cooldownLeft = 0;
    run(w, def.duration * 2 + 0.2);
    expect(w.playerStatus.confuseLeft).toBeGreaterThan(0);
  });

  it('Parting Jabs: when it ends, the fists fly out', () => {
    const { w, slot } = withMove('thrash', 'thrash.partingJabs');
    slot.cooldownLeft = 1e9;
    const far = dummy(w, 160, 0);
    run(w, DT);
    slot.angle = 0;
    hooksOf(slot)!.onExpire!(w, slot);
    expect(lost(far)).toBeGreaterThan(0);
  });

  it('Berserk Flurry: a Rampage starts Thrash at once with double fists', () => {
    const { w, slot } = withMove('thrash', 'thrash.berserkFlurry', 1);
    slot.cooldownLeft = 1e9;
    emit(w, 'rampage', 1);
    run(w, DT);
    expect(slot.activeLeft).toBeGreaterThan(0);
    expect(slot.stats.extraCount).toBe(def.count);
  });
});

describe('Close Combat Mutations', () => {
  it('Brick Break: ×1.3 on Elites', () => {
    const { w, slot } = withMove('closeCombat', 'closeCombat.brickBreak', 1);
    const e = dummy(w, 40, 0);
    e.elite = true;
    expect(hooksOf(slot)!.damageMult!(w, slot, e)).toBeCloseTo(1.3);
  });

  it('Arm Thrust: three hits at 40%', () => {
    const { w, slot } = withMove('closeCombat', 'closeCombat.armThrust', 1);
    const e = dummy(w, 40, 0);
    slot.stats.critChance = 0;
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(lost(e)).toBeCloseTo(slot.stats.damage * 0.4 * 3 * 2, 0); // Fighting vs Normal ×2
  });

  it('Fury Combat: at 50+ Rage no guard drop and +25% damage', () => {
    const { w, slot } = withMove('closeCombat', 'closeCombat.furyCombat', 1);
    dummy(w, 40, 0);
    w.player.rage = 60;
    w.player.rageIdle = -1e9;
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * 1.25);
    expect(w.player.vulnLeft).toBe(0);
  });
});

describe('Shadow Punch Mutations', () => {
  it('Shadow Barrage: three fists', () => {
    const { w, slot } = withMove('shadowPunch', 'shadowPunch.barrage', 2);
    dummy(w, 150, 0);
    slot.cooldownLeft = 0;
    run(w, DT);
    expect(w.projectiles.length).toBe(3);
  });

  it('Phantom Grip: a light target is held', () => {
    const { w, slot } = withMove('shadowPunch', 'shadowPunch.grip', 2);
    const e = dummy(w, 60, 0, 'rattata');
    slot.cooldownLeft = 0;
    let held = false;
    for (let i = 0; i < 30 && !held; i++) {
      run(w, DT);
      held = e.trapLeft > 0;
    }
    expect(held).toBe(true);
  });

  it('Phantom Grudge: a Rampage ending fires 5 fists (copies)', () => {
    const { w, slot } = withMove('shadowPunch', 'shadowPunch.phantomGrudge', 2);
    slot.cooldownLeft = 1e9;
    dummy(w, 200, 0);
    run(w, DT);
    emit(w, 'rampageEnd', 1);
    const fists = w.projectiles;
    expect(fists.length).toBe(5);
    expect(fists.every((p) => p.hit.fromProc)).toBe(true);
  });
});
