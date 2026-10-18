import { describe, expect, it } from 'vitest';
import { TUNING, type PokemonId } from '../data/content';
import { MUTATION_TUNING } from '../data/mutations';
import type { MoveId } from '../data/moves';
import { applyNewStun, applyStatuses, damageEnemy, enemySpeedFactor, makeHitInfo, procHit, soak } from './combat';
import { defineMutation, emit, healPlayer, mutationDamageTakenMult, type HookEvent } from './hooks';
import { gainXp } from './progression';
import { createSeededRng } from './rng';
import { createSlot, refreshStats } from './stats';
import { spawnPuddle, spawnScorch } from './terrain';
import type { InputState, MoveSlot, World } from './types';
import { createWorld, spawnEnemy, step } from './world';

// P4f-2: the Mutation hook layer, shared terrain and crowd-control guard rails.
// Hook behaviour is exercised with throwaway definitions on real IDs (overwritten per test file).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Signature on a long cooldown so only the listed moves act. */
function makeWorld(pokemonId: PokemonId = 'squirtle', moves: MoveId[] = []): World {
  const world = createWorld({ rng: createSeededRng(3), pokemonId, spawnEnabled: false });
  for (const id of moves) world.moves.push(createSlot(id));
  refreshStats(world);
  world.moves[0]!.cooldownLeft = 1e9;
  return world;
}

function run(world: World, seconds: number, input: InputState = IDLE): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(world, input, DT);
}

/** Records every event a Mutation on `slot` hears. */
function listen(world: World, slotIndex: number): Record<string, number> {
  const heard: Record<string, number> = {};
  defineMutation('tackle.rollout', {
    onEvent: (_w, _s, event: HookEvent, amount) => {
      heard[event] = (heard[event] ?? 0) + amount;
    },
  });
  world.moves[slotIndex]!.mutation = 'tackle.rollout';
  return heard;
}

describe('hook events', () => {
  it('Shell block, hit taken, Static paralysis and Shell Armor absorb fire with their amounts', () => {
    const w = makeWorld('squirtle', ['tackle']);
    const heard = listen(w, 1);
    w.moves[1]!.cooldownLeft = 1e9;
    const rat = spawnEnemy(w, 'rattata', 0, 0, 100);
    rat.speed = 0;
    run(w, DT); // Shell is up: blocked
    expect(heard.shellBlock).toBe(10);
    expect(heard.hitTaken).toBeUndefined();
    w.player.invulnLeft = 0;
    run(w, DT);
    expect(heard.hitTaken).toBeCloseTo(10);

    const pika = makeWorld('pikachu', ['tackle']);
    const heardPika = listen(pika, 1);
    pika.moves[1]!.cooldownLeft = 1e9;
    spawnEnemy(pika, 'rattata', 0, 0, 100).speed = 0;
    run(pika, DT);
    expect(heardPika.staticProc).toBe(1);

    const lapras = makeWorld('lapras', ['tackle']);
    const heardLapras = listen(lapras, 1);
    lapras.moves[1]!.cooldownLeft = 1e9;
    spawnEnemy(lapras, 'rattata', 0, 0, 100).speed = 0;
    run(lapras, DT);
    expect(heardLapras.armorAbsorb).toBeCloseTo(10 * 0.15);
    expect(heardLapras.hitTaken).toBeCloseTo(10 * 0.85);
  });

  it('level-ups, kills and healing are routed through one place each', () => {
    const w = makeWorld('squirtle', ['tackle']);
    const heard = listen(w, 1);
    gainXp(w, 30);
    expect(heard.levelUp).toBe(w.level - 1);

    const rat = spawnEnemy(w, 'rattata', 500, 500);
    damageEnemy(w, rat, 9999);
    expect(heard.kill).toBe(1);

    w.player.hp = w.player.maxHp - 5;
    expect(healPlayer(w, 20)).toBe(5); // capped at max HP
    expect(heard.healing).toBe(5);
    expect(healPlayer(w, 20)).toBe(0);
    expect(heard.healing).toBe(5); // no event when nothing healed
  });
});

describe('Mutation hooks', () => {
  it('stats applies on refresh; live recomputes from base every step without compounding', () => {
    const w = makeWorld('squirtle', ['tackle']);
    let shell = true;
    defineMutation('tackle.bowling', {
      stats: (s) => {
        s.damage *= 0.5;
      },
      live: (s) => {
        if (shell) s.damage *= 2;
      },
    });
    const slot = w.moves[1]!;
    slot.mutation = 'tackle.bowling';
    refreshStats(w);
    const base = slot.stats.damage;
    run(w, 0.5);
    expect(slot.stats.damage).toBeCloseTo(base * 2);
    shell = false;
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(base);
  });

  it('cast replaces the move; onCast, update, damageMult, onHit and onKill run for its own hits', () => {
    const w = makeWorld('squirtle', ['tackle']);
    const log: string[] = [];
    let dealtSeen = 0;
    defineMutation('tackle.bulbBash', {
      cast: () => {
        log.push('cast');
        return true;
      },
      onCast: () => log.push('onCast'),
      update: () => log.push('update'),
      damageMult: () => 3,
      onHit: (_w, _s, _e, dealt) => {
        dealtSeen = dealt;
      },
      onKill: () => log.push('kill'),
    });
    const slot = w.moves[1]!;
    slot.mutation = 'tackle.bulbBash';
    run(w, DT);
    expect(log).toEqual(['cast', 'onCast', 'update']);
    expect(slot.cooldownLeft).toBeCloseTo(slot.stats.cooldown);

    const rat = spawnEnemy(w, 'rattata', 500, 500);
    damageEnemy(w, rat, 2, makeHitInfo(slot.stats, slot));
    expect(dealtSeen).toBeCloseTo(6);
    damageEnemy(w, rat, 9999, makeHitInfo(slot.stats, slot));
    expect(log).toContain('kill');
  });

  it('proc hits never trigger hooks, Lifesteal or kill events (no proc-from-proc)', () => {
    const w = makeWorld('squirtle', ['tackle']);
    const heard = listen(w, 1);
    let hits = 0;
    defineMutation('tackle.bulbBash', { onHit: () => hits++, damageMult: () => 10 });
    const slot = w.moves[1]!;
    slot.mutation = 'tackle.bulbBash';
    w.player.hp = 50;
    const rat = spawnEnemy(w, 'rattata', 500, 500);
    const proc = { ...procHit('Water'), slot, lifesteal: 1 };
    const dealt = damageEnemy(w, rat, 3, { ...proc, lifesteal: 0 });
    expect(dealt).toBeCloseTo(3); // no ×10
    expect(hits).toBe(0);
    damageEnemy(w, rat, 9999, proc);
    expect(heard.kill).toBeUndefined();
  });

  it('beam reach multiplier and onExpire', () => {
    const w = makeWorld('squirtle', ['waterGun']);
    let expired = 0;
    defineMutation('waterGun.washDown', { onExpire: () => expired++, live: (s) => (s.reachMult = 1.5) });
    const slot: MoveSlot = w.moves[1]!;
    slot.mutation = 'waterGun.washDown';
    const near = spawnEnemy(w, 'raticate', 100, 0, 50);
    const far = spawnEnemy(w, 'raticate', 330, 0, 50); // past 240 px, inside 360
    near.speed = far.speed = 0;
    run(w, 1);
    expect(far.hp).toBeLessThan(far.maxHp);
    expect(expired).toBe(1);
  });

  it('player move speed and damage taken multiply across owned Mutations; movement is tracked', () => {
    const w = makeWorld('squirtle', ['tackle', 'waterGun']);
    defineMutation('tackle.rollout', { moveSpeedMult: () => 0.5, damageTakenMult: () => 0.6 });
    defineMutation('waterGun.slick', { moveSpeedMult: () => 0.8 });
    w.moves[1]!.mutation = 'tackle.rollout';
    w.moves[2]!.mutation = 'waterGun.slick';
    w.moves[0]!.cooldownLeft = 99;
    const x0 = w.player.x;
    run(w, 1, { moveX: 1, moveY: 0 });
    expect(w.player.x - x0).toBeCloseTo(w.player.speed * 0.4, 0);
    expect(w.player.movingFor).toBeCloseTo(1);
    expect(w.player.faceX).toBe(1);
    run(w, 0.5);
    expect(w.player.stillFor).toBeCloseTo(0.5);
    expect(w.player.movingFor).toBe(0);
    expect(mutationDamageTakenMult(w)).toBeCloseTo(0.6);
  });

  it('emit with no Mutations is harmless', () => {
    const w = makeWorld();
    expect(() => emit(w, 'bloom', 1)).not.toThrow();
  });
});

describe('shared terrain', () => {
  it('puddles cap at 6 (oldest dries first) and Soak enemies standing in them', () => {
    const w = makeWorld();
    w.moves[0]!.cooldownLeft = 99;
    for (let i = 0; i < 8; i++) spawnPuddle(w, i * 100, 300);
    expect(w.puddles.length).toBe(MUTATION_TUNING.puddle.maxAlive);
    expect(w.puddles[0]!.x).toBe(200);
    const rat = spawnEnemy(w, 'rattata', 200, 300);
    rat.speed = 0;
    run(w, 0.3);
    expect(rat.soakLeft).toBeGreaterThan(0);
    expect(enemySpeedFactor(rat)).toBeCloseTo(MUTATION_TUNING.soaked.speedMult);
    run(w, MUTATION_TUNING.puddle.seconds);
    expect(w.puddles.length).toBe(0);
  });

  it('Soaked enemies stagger further', () => {
    const w = makeWorld();
    const a = spawnEnemy(w, 'rattata', 500, 0);
    const b = spawnEnemy(w, 'rattata', 500, 100);
    soak(b);
    const hit = { ...makeHitInfo(createSlot('tackle').stats), knockback: 20, dirX: 1, dirY: 0 };
    damageEnemy(w, a, 1, hit);
    damageEnemy(w, b, 1, hit);
    expect(b.kbX / a.kbX).toBeCloseTo(MUTATION_TUNING.soaked.staggerTakenMult);
  });

  it('slips stun light enemies in a Slick puddle; Scorch burns', () => {
    const w = makeWorld();
    w.moves[0]!.cooldownLeft = 99;
    spawnPuddle(w, 300, 0, 3, 1, 0.6); // 100%/s slip chance
    spawnScorch(w, -300, 0, 50);
    const rat = spawnEnemy(w, 'rattata', 300, 0);
    const pidgey = spawnEnemy(w, 'pidgey', -300, 0);
    rat.speed = pidgey.speed = 0;
    run(w, 0.3);
    expect(rat.stunLeft).toBeGreaterThan(0);
    expect(pidgey.burnLeft).toBeGreaterThan(0);
    expect(pidgey.burnDps).toBeCloseTo(50 * MUTATION_TUNING.scorch.burnFraction);
  });
});

describe('crowd-control guard rails', () => {
  it('stun fatigue blocks new-effect stuns for 1.5 s after one ends; base stuns are unchanged (D21)', () => {
    const w = makeWorld();
    w.moves[0]!.cooldownLeft = 99;
    const rat = spawnEnemy(w, 'rattata', 400, 0);
    rat.speed = 0;
    expect(applyNewStun(rat, 0.5)).toBe(true);
    run(w, 0.6);
    expect(rat.stunLeft).toBe(0);
    expect(rat.stunFatigueLeft).toBeGreaterThan(1);
    expect(applyNewStun(rat, 0.5)).toBe(false);
    applyStatuses(rat, { slow: 0, stun: 0.5, poisonDps: 0 });
    expect(rat.stunLeft).toBe(0.5); // base moves keep today's behaviour
    run(w, 2.2);
    expect(applyNewStun(rat, 0.5)).toBe(true);
  });

  it('slows and Soaked together are capped at 70%', () => {
    const w = makeWorld();
    const rat = spawnEnemy(w, 'rattata', 400, 0);
    applyStatuses(rat, { slow: 0.6, stun: 0, poisonDps: 0 });
    expect(enemySpeedFactor(rat)).toBeCloseTo(0.4);
    soak(rat);
    expect(enemySpeedFactor(rat)).toBeCloseTo(1 - MUTATION_TUNING.slowCap);
  });
});
