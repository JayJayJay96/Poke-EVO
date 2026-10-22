import { describe, expect, it } from 'vitest';
import { TUNING } from '../data/content';
import { PLAYER_STATUS } from '../data/playerStatus';
import { applyBurn, applyStatuses, findTarget } from './combat';
import { applyPlayerStatus, playerStatusSlow } from './playerStatus';
import { createSeededRng } from './rng';
import { statusMult } from './statusResist';
import type { World } from './types';
import { createWorld, spawnEnemy, step } from './world';

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };
const run = (world: World, seconds: number) => {
  for (let t = 0; t < seconds; t += DT) step(world, IDLE, DT);
};
function makeWorld(pokemonId: 'charmander' | 'bulbasaur' | 'pikachu' | 'squirtle' = 'charmander'): World {
  const world = createWorld({ rng: createSeededRng(1), pokemonId });
  world.moves = [];
  return world;
}

describe('status resistance by type (D27, README §2–§3)', () => {
  it('follows the element chart, lore immunities are ×0.25, the flavour table only lowers, clamped [0.25, 1.5]', () => {
    expect(statusMult(['Fire'], 'burn')).toBe(0.25);
    expect(statusMult(['Grass', 'Poison'], 'burn')).toBe(1.5);
    expect(statusMult(['Rock', 'Ground'], 'burn')).toBe(0.5);
    expect(statusMult(['Water'], 'paralysis')).toBe(1.5);
    expect(statusMult(['Electric'], 'paralysis')).toBe(0.25);
    expect(statusMult(['Rock', 'Ground'], 'paralysis')).toBe(0.25);
    expect(statusMult(['Bug', 'Poison'], 'poison')).toBe(0.25);
    expect(statusMult(['Rock', 'Ground'], 'soaked')).toBe(1.5);
    expect(statusMult(['Normal', 'Flying'], 'slow')).toBe(0.5);
    expect(statusMult(['Ghost', 'Poison'], 'trap')).toBe(0.25);
    expect(statusMult(['Psychic'], 'sleep')).toBe(0.5);
    expect(statusMult(['Normal'], 'sleep')).toBe(1);
  });
});

describe('player statuses (D36, README §10)', () => {
  it('poison ticks 20% of the hit per second for 3 s; a Grass/Poison starter takes ×0.25', () => {
    for (const [id, mult] of [['charmander', 1], ['bulbasaur', 0.25]] as const) {
      const world = makeWorld(id);
      const hp = world.player.hp;
      applyPlayerStatus(world, 'poison', { hit: 20 });
      run(world, PLAYER_STATUS.poison.seconds + 0.1);
      const expected = 20 * PLAYER_STATUS.poison.dpsFraction * mult * PLAYER_STATUS.poison.seconds * world.mods.damageTakenMult;
      expect(hp - world.player.hp).toBeCloseTo(expected, 0);
    }
  });

  it('a powder barely touches a Grass starter', () => {
    const world = makeWorld('bulbasaur');
    applyPlayerStatus(world, 'slow', { powder: true });
    expect(world.playerStatus.slowLeft).toBeCloseTo(PLAYER_STATUS.slow.seconds * 0.25);
  });

  it('fatigue: the same status cannot land again for 2 s after it ends', () => {
    const world = makeWorld('pikachu'); // neutral to Soaked (Charmander would take ×1.5)
    applyPlayerStatus(world, 'soaked');
    run(world, PLAYER_STATUS.soaked.seconds + DT);
    expect(world.playerStatus.soakLeft).toBe(0);
    expect(applyPlayerStatus(world, 'soaked')).toBe(false);
    run(world, PLAYER_STATUS.fatigue + DT);
    expect(applyPlayerStatus(world, 'soaked')).toBe(true);
  });

  it('paralysis: a short heavy stutter, then a slow; never a stun; slows never stack past the cap', () => {
    const world = makeWorld();
    applyPlayerStatus(world, 'paralysis');
    expect(playerStatusSlow(world)).toBe(PLAYER_STATUS.paralysis.stutterSlow);
    run(world, PLAYER_STATUS.paralysis.stutter + DT);
    applyPlayerStatus(world, 'slow');
    applyPlayerStatus(world, 'soaked');
    expect(playerStatusSlow(world)).toBe(PLAYER_STATUS.paralysis.slow);
    expect(playerStatusSlow(world)).toBeLessThanOrEqual(PLAYER_STATUS.slowCap);
    const x = world.player.x;
    step(world, { moveX: 1, moveY: 0 }, DT);
    expect(world.player.x).toBeGreaterThan(x); // you can always move
  });

  it('confusion: moves aim at a random enemy in range, not always the nearest', () => {
    const world = makeWorld();
    const near = spawnEnemy(world, 'rattata', world.player.x + 50, world.player.y);
    for (let i = 0; i < 5; i++) spawnEnemy(world, 'rattata', world.player.x - 100 - i * 20, world.player.y);
    const slot = { stats: { predatory: false } };
    applyPlayerStatus(world, 'confusion');
    const picks = new Set<number>();
    for (let i = 0; i < 30; i++) picks.add(findTarget(world, slot as never, 400)!.id);
    expect(picks.size).toBeGreaterThan(1);
    world.playerStatus.confuseLeft = 0;
    expect(findTarget(world, slot as never, 400)!.id).toBe(near.id);
  });

  it('poison can knock you out: on the map the run ends', () => {
    const world = makeWorld();
    world.player.hp = 1;
    applyPlayerStatus(world, 'poison', { hit: 100 });
    run(world, 1);
    expect(world.status).toBe('fainted');
  });
});

describe('enemy status resistance (D27)', () => {
  it('enemies take statuses by type: Flying halves slows, takes paralysis ×1.5; Geodude barely paralyses; bosses halve stuns', () => {
    const world = makeWorld();
    const pidgey = spawnEnemy(world, 'pidgey', 0, 0);
    applyStatuses(pidgey, { slow: 0.3, stun: 1, stunKind: 'paralysis', poisonDps: 0 });
    expect(pidgey.slowLeft).toBeCloseTo(TUNING.status.slowSeconds * 0.5);
    expect(pidgey.stunLeft).toBeCloseTo(1.5);
    const geodude = spawnEnemy(world, 'geodude', 0, 0);
    applyStatuses(geodude, { slow: 0, stun: 1, stunKind: 'paralysis', poisonDps: 4 });
    expect(geodude.stunLeft).toBeCloseTo(0.25);
    expect(geodude.poisonDps).toBeCloseTo(1); // Rock/Ground: Poison ×0.25
    const snorlax = spawnEnemy(world, 'snorlax', 0, 0);
    applyStatuses(snorlax, { slow: 0, stun: 2, stunKind: 'sleep', poisonDps: 0 });
    expect(snorlax.stunLeft).toBeCloseTo(1); // boss rule
    const rattata = spawnEnemy(world, 'rattata', 0, 0);
    applyBurn(rattata, 6);
    expect(rattata.burnDps).toBe(6); // Normal: no resistances
  });
});
