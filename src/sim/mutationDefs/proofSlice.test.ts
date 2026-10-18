import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import { MOVES, type BeamMoveDef, type MeleeMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { mutationMoveSpeedMult } from '../hooks';
import { grantMutation, mutationOffers } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { InputState, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4f-3 proof slice: Water Gun (Slick, Steady Aim) and Withdraw (Spiked Shell, Counter Shell).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Squirtle with only `move` acting (Bubble parked). */
function squirtleWith(move: 'waterGun' | 'withdraw'): World {
  const w = createWorld({ rng: createSeededRng(5), pokemonId: 'squirtle', spawnEnabled: false });
  w.moves.push(createSlot(move));
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  return w;
}

function run(w: World, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(w, IDLE, DT);
    if (w.offer) w.offer = null;
  }
}

function dummy(w: World, x: number, y: number) {
  const e = spawnEnemy(w, 'raticate', x, y, 100);
  e.speed = 0;
  return e;
}

describe('Water Gun — Slick (generic)', () => {
  it('lays a line of puddles along the beam that Soak; −30% damage', () => {
    const w = squirtleWith('waterGun');
    const base = w.moves[1]!.stats.damage;
    expect(grantMutation(w, 'waterGun.slick')).toBe('granted');
    const slick = MUTATIONS['waterGun.slick'].values;
    expect(w.moves[1]!.stats.damage).toBeCloseTo(base * slick.damageMult);
    const target = dummy(w, 150, 0);
    w.player.invulnLeft = 1e9;
    run(w, 0.3);
    expect(w.puddles.length).toBe(3); // 240 px of beam, 35 px puddles edge to edge
    for (const p of w.puddles) {
      expect(p.y).toBeCloseTo(0);
      expect(p.slipChancePerSec).toBe(slick.slipChancePerSec);
      expect(p.slipStun).toBe(slick.slipStun);
      expect(p.duration).toBe(slick.puddleSeconds);
    }
    expect(target.soakLeft).toBeGreaterThan(0);
  });

  it('light enemies slip over time (seeded)', () => {
    const w = squirtleWith('waterGun');
    grantMutation(w, 'waterGun.slick');
    w.player.invulnLeft = 1e9;
    const rats = [70, 140, 210].map((x) => dummy(w, x, 0));
    let slipped = false;
    for (let i = 0; i < Math.round(3 / DT) && !slipped; i++) {
      step(w, IDLE, DT);
      slipped = rats.some((r) => r.stunLeft > 0 && r.fatigueOnEnd);
    }
    expect(slipped).toBe(true);
  });
});

describe('Water Gun — Steady Aim (Bond: Shell ready)', () => {
  const def = MOVES.waterGun as BeamMoveDef;
  const aim = MUTATIONS['waterGun.steadyAim'].values;

  it('while Shell is up: beam +40% long and push ×2', () => {
    const w = squirtleWith('waterGun');
    grantMutation(w, 'waterGun.steadyAim');
    w.player.invulnLeft = 1e9;
    dummy(w, 100, 0);
    const far = dummy(w, def.length * 1.3, 0);
    run(w, 0.3);
    expect(far.hp).toBeLessThan(far.maxHp);
    expect(w.moves[1]!.stats.knockback).toBeCloseTo(def.onHit!.knockback! * aim.pushMult);
  });

  it('while Shell recharges: normal length, −25% damage', () => {
    const w = squirtleWith('waterGun');
    grantMutation(w, 'waterGun.steadyAim');
    const base = w.moves[1]!.baseStats.damage;
    w.player.blockReadyLeft = 5;
    w.player.invulnLeft = 1e9;
    dummy(w, 100, 0);
    const far = dummy(w, def.length * 1.3, 0);
    run(w, 0.3);
    expect(far.hp).toBe(far.maxHp);
    expect(w.moves[1]!.stats.damage).toBeCloseTo(base * aim.damageMultShellDown);
  });
});

describe('Withdraw — Spiked Shell (generic)', () => {
  const spiked = MUTATIONS['withdraw.spikedShell'].values;

  it('becomes a 3 s aura hitting every 0.5 s with stagger and no stun; slower walk; cooldown ×1.6', () => {
    const w = squirtleWith('withdraw');
    const baseCd = w.moves[1]!.stats.cooldown;
    grantMutation(w, 'withdraw.spikedShell');
    const slot = w.moves[1]!;
    expect(slot.stats.cooldown).toBeCloseTo(baseCd * spiked.cooldownMult);
    expect(slot.stats.stun).toBe(0);
    w.player.invulnLeft = 1e9;
    const e = dummy(w, 30, 0);
    run(w, DT);
    expect(slot.activeLeft).toBeGreaterThan(spiked.auraSeconds - 0.1);
    expect(mutationMoveSpeedMult(w)).toBeCloseTo(spiked.moveSpeedMult);
    let hits = 0;
    let last = e.hp;
    for (let i = 0; i < Math.round(3.2 / DT); i++) {
      e.x = 30; // pinned next to the player
      e.y = 0;
      e.kbX = e.kbY = 0;
      step(w, IDLE, DT);
      if (e.hp < last) hits++;
      last = e.hp;
      expect(e.stunLeft).toBe(0);
    }
    expect(hits).toBe(spiked.auraSeconds / spiked.tickInterval); // 6 more ticks after the first
    expect(mutationMoveSpeedMult(w)).toBe(1);
  });

  it("doesn't start with nobody in reach", () => {
    const w = squirtleWith('withdraw');
    grantMutation(w, 'withdraw.spikedShell');
    dummy(w, 300, 0);
    run(w, 0.5);
    expect(w.moves[1]!.activeLeft).toBe(0);
  });
});

describe('Withdraw — Counter Shell (Bond: Shell blocks)', () => {
  const counter = MUTATIONS['withdraw.counterShell'].values;
  const def = MOVES.withdraw as MeleeMoveDef;

  it('a Shell block resets Withdraw, and that bash staggers ×2; −20% damage', () => {
    const w = squirtleWith('withdraw');
    const base = w.moves[1]!.stats.damage;
    grantMutation(w, 'withdraw.counterShell');
    const slot = w.moves[1]!;
    expect(slot.stats.damage).toBeCloseTo(base * counter.damageMult);
    slot.cooldownLeft = 99;
    const rat = spawnEnemy(w, 'rattata', 0, 0, 100);
    rat.speed = 0;
    step(w, IDLE, DT); // contact: Shell blocks
    expect(w.player.blockReadyLeft).toBeGreaterThan(0);
    expect(slot.cooldownLeft).toBe(0);
    expect(slot.mutState.armed).toBe(1);
    step(w, IDLE, DT); // live doubles the stagger, then the counter bash fires
    expect(slot.mutState.armed).toBe(0);
    expect(slot.stats.knockback).toBeCloseTo(def.onHit!.knockback! * counter.staggerMult);
    step(w, IDLE, DT); // disarmed: back to normal stagger
    expect(slot.stats.knockback).toBeCloseTo(def.onHit!.knockback!);
  });

  it('is offered to Squirtle only, once Withdraw is owned', () => {
    const w = squirtleWith('withdraw');
    expect(mutationOffers(w)).toEqual(expect.arrayContaining(['withdraw.spikedShell', 'withdraw.counterShell']));
    const pika = createWorld({ rng: createSeededRng(1), pokemonId: 'pikachu', spawnEnabled: false });
    expect(grantMutation(pika, 'withdraw.counterShell')).toBe('wrongLine');
  });
});
