import { describe, expect, it } from 'vitest';
import { POKEMON, TUNING } from '../data/content';
import { MOVES } from '../data/moves';
import { gainXp, xpToNext } from './progression';
import { createSeededRng } from './rng';
import type { InputState, World } from './types';
import { createWorld, drainPlayer, hitPlayer, spawnEnemy, step } from './world';

// D43: out-of-combat regen and per-level growth.
const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };
const STAB = 1 + TUNING.stabBonus;

function makeWorld(): World {
  return createWorld({ rng: createSeededRng(1), spawnRadius: 600, spawnEnabled: false, pokemonId: 'charmander' });
}

function run(world: World, seconds: number): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) step(world, IDLE, DT);
}

describe('rest regen', () => {
  const { afterSeconds, maxHpPctPerSec } = TUNING.restRegen;

  it('starts only after 5 s without damage, at 1% of max HP per second, and stops at full', () => {
    const world = makeWorld();
    world.player.hp = 50;
    run(world, afterSeconds - 0.1);
    expect(world.player.hp).toBe(50);
    run(world, 1.1);
    expect(world.player.hp).toBeCloseTo(50 + world.player.maxHp * maxHpPctPerSec, 0);
    world.player.hp = world.player.maxHp - 0.1;
    run(world, 1);
    expect(world.player.hp).toBe(world.player.maxHp);
  });

  it('a landed hit or a poison tick resets the wait', () => {
    const world = makeWorld();
    run(world, afterSeconds + 1);
    hitPlayer(world, 10, spawnEnemy(world, 'raticate', 900, 0));
    const afterHit = world.player.hp;
    run(world, afterSeconds - 0.5);
    expect(world.player.hp).toBe(afterHit);
    drainPlayer(world, 1);
    const afterDrain = world.player.hp;
    run(world, afterSeconds - 0.5);
    expect(world.player.hp).toBe(afterDrain);
  });
});

describe('level growth', () => {
  it('each level past 1 adds +2 max HP (healed as gained) and +1% damage, before the card is picked', () => {
    const world = makeWorld();
    const stage = POKEMON.charmander.stages[0]!;
    world.player.hp = 50;
    let xp = 0;
    for (let level = 1; level < 5; level++) xp += xpToNext(level);
    gainXp(world, xp);
    expect(world.level).toBe(5);
    expect(world.pendingLevelUps).toBe(4); // banked, still applied
    const { maxHp, damagePct } = TUNING.levelGrowth;
    expect(world.player.maxHp).toBe(stage.maxHp + 4 * maxHp);
    expect(world.player.hp).toBe(50 + 4 * maxHp);
    expect(world.moves[0]!.stats.damage).toBeCloseTo(MOVES.ember.damage * stage.damageMult * (1 + 4 * damagePct) * STAB);
  });
});
