import { describe, expect, it } from 'vitest';
import { TUNING, type PokemonId } from '../data/content';
import { CELL, MAP_TUNING } from '../data/map';
import { MOVES, type BeamMoveDef, type OrbitMoveDef, type ZoneMoveDef } from '../data/moves';
import { castBeam } from './forms/beam';
import { castOrbit, updateOrbit } from './forms/orbit';
import { castZone } from './forms/zoneCast';
import { createProjectile, updateProjectiles } from './forms/projectile';
import { cellAt, cellsOf, chunkKey, generateChunk } from './map';
import { grassPhase, marshFrozen, patchCharged, reactAt, restsInGrass } from './mapReactions';
import { createSeededRng } from './rng';
import { createSlot } from './stats';
import type { Enemy, World } from './types';
import { createWorld, spawnEnemy, step } from './world';

// Map reactions (D47, docs/map/README.md §7–§8), build step M3b.

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };

/** A quiet world whose start chunk (−500…500; column c spans x −500 + 100c) holds these tiles. */
function world(rows: string[], pokemonId: PokemonId = 'charmander'): World {
  const w = createWorld({ rng: createSeededRng(1), spawnEnabled: false, mapSeed: 1, obstacleDensity: 1, pokemonId });
  w.moves = [];
  const chunk = generateChunk(1, 0, 0);
  const cells = cellsOf(rows);
  w.map.chunks.set(chunkKey(0, 0), { ...chunk, tiles: rows, own: [], near: [], slots: [], cells, water: cells.includes(CELL.water), patches: null });
  return w;
}

function run(w: World, seconds: number, input = IDLE): void {
  for (let i = 0; i < seconds / DT; i++) step(w, input, DT);
}

/** An enemy pinned where it stands (a long stun), so it stays on the terrain under test. */
function pinned(w: World, kind: 'rattata' | 'pidgey', x: number, y: number): Enemy {
  const e = spawnEnemy(w, kind, x, y);
  e.stunLeft = 999;
  return e;
}

const rowsOf = (...rows: string[]): string[] => [...rows, ...Array<string>(10 - rows.length).fill('..........')];

// Two grass patches: A at x −300…0, y −500…−200 (a 6 × 6-cell block), B at x 200…400, same rows.
const GRASS = rowsOf('..ggg..gg.', '..ggg..gg.', '..ggg..gg.');
const A = { x: -275, y: -475 };
const A_FAR = { x: -25, y: -225 };
const B = { x: 225, y: -475 };

describe('tall grass (M3b)', () => {
  it('a Grass type rests after 2 s in tall grass; not on open floor, and not a non-Grass type', () => {
    for (const [id, x, heals] of [['bulbasaur', A.x, true], ['bulbasaur', 0, false], ['charmander', A.x, false]] as const) {
      const w = world(GRASS, id);
      w.player.x = x;
      w.player.y = A.y;
      w.player.hp = 50;
      w.player.calmFor = MAP_TUNING.grass.restDelayGrassType + 0.1;
      expect(restsInGrass(w)).toBe(heals);
      step(w, IDLE, DT);
      expect(w.player.hp > 50).toBe(heals);
    }
  });

  it('fire spreads through the whole patch and stops at its edge', () => {
    const w = world(GRASS);
    reactAt(w, A.x, A.y, 'Fire', 100);
    expect(grassPhase(w, A.x, A.y)).toBe('burning');
    expect(grassPhase(w, A_FAR.x, A_FAR.y)).toBe('grass'); // 10 cells away: not reached yet
    run(w, 10 / MAP_TUNING.grass.spreadCellsPerSec + 0.1);
    expect(grassPhase(w, A_FAR.x, A_FAR.y)).toBe('burning');
    expect(grassPhase(w, B.x, B.y)).toBe('grass');
  });

  it('a burning cell Burns enemies at 30% of the hit per second, flyers at half', () => {
    const w = world(GRASS);
    const walker = pinned(w, 'rattata', A.x, A.y);
    const flyer = pinned(w, 'pidgey', A.x + 50, A.y);
    reactAt(w, A.x, A.y, 'Fire', 100);
    run(w, 1); // the flyer's cell catches 1/3 s later; burns land on the 0.25 s ticks
    expect(walker.burnLeft).toBeGreaterThan(0);
    expect(flyer.burnDps / walker.burnDps).toBeCloseTo(MAP_TUNING.grass.flyerBurnMult, 5);
  });

  it('you take no damage standing in your own fire (R6)', () => {
    const w = world(GRASS);
    w.player.x = A.x;
    w.player.y = A.y;
    reactAt(w, A.x, A.y, 'Fire', 100);
    run(w, 3);
    expect(w.player.hp).toBe(w.player.maxHp);
  });

  it('ash can not ignite again until the patch regrows', () => {
    const w = world(GRASS);
    reactAt(w, A.x, A.y, 'Fire', 100);
    run(w, MAP_TUNING.grass.burnSeconds + 0.5);
    expect(grassPhase(w, A.x, A.y)).toBe('ash');
    reactAt(w, A.x, A.y, 'Fire', 100);
    expect(grassPhase(w, A.x, A.y)).toBe('ash');
  });

  it('at most 2 patches burn at once', () => {
    const w = world(rowsOf('g...g...g.'));
    for (const x of [-475, -75, 325]) reactAt(w, x, -475, 'Fire', 100);
    expect([-475, -75, 325].map((x) => grassPhase(w, x, -475))).toEqual(['burning', 'burning', 'grass']);
  });

  it('other types do nothing to grass', () => {
    const w = world(GRASS);
    for (const type of ['Water', 'Electric', 'Ice', 'Grass'] as const) reactAt(w, A.x, A.y, type, 100);
    expect(grassPhase(w, A.x, A.y)).toBe('grass');
  });
});

// A marsh patch at x −500…−100, y −500…−200 (8 × 6 cells).
const MARSH = rowsOf('mmmm......', 'mmmm......', 'mmmm......');
const M = { x: -400, y: -400 };

describe('marsh reactions (M3b)', () => {
  it('Electric paralyses every grounded enemy in the patch and hits it for 20%; flyers are spared', () => {
    const w = world(MARSH);
    const a = spawnEnemy(w, 'rattata', M.x, M.y);
    const b = spawnEnemy(w, 'rattata', -150, -250);
    const flyer = spawnEnemy(w, 'pidgey', M.x + 50, M.y);
    const outside = spawnEnemy(w, 'rattata', 200, 0);
    const hp = a.hp;
    reactAt(w, M.x, M.y, 'Electric', 10);
    for (const e of [a, b]) {
      expect(e.stunKind).toBe('paralysis');
      expect(e.stunLeft).toBeCloseTo(MAP_TUNING.marsh.charge.paralyse, 5);
    }
    expect(hp - a.hp).toBeCloseTo(10 * MAP_TUNING.marsh.charge.damageFraction, 5);
    expect(flyer.stunLeft).toBe(0);
    expect(outside.stunLeft).toBe(0);
  });

  it('the charge has a 4 s cooldown per patch, and stun fatigue blocks the paralysis', () => {
    const w = world(MARSH);
    const e = spawnEnemy(w, 'rattata', M.x, M.y);
    reactAt(w, M.x, M.y, 'Electric', 10);
    const hp = e.hp;
    reactAt(w, M.x, M.y, 'Electric', 10);
    expect(e.hp).toBe(hp);
    const tired = spawnEnemy(w, 'rattata', M.x, M.y + 50);
    tired.stunFatigueLeft = 5;
    w.time += MAP_TUNING.marsh.charge.cooldown;
    reactAt(w, M.x, M.y, 'Electric', 10);
    expect(tired.stunLeft).toBe(0);
    expect(tired.hp).toBeLessThan(tired.maxHp);
  });

  it('Ice freezes the marsh: no slow for 6 s', () => {
    const speed = (frozen: boolean): number => {
      const w = world(MARSH);
      w.player.x = -480;
      w.player.y = M.y;
      if (frozen) reactAt(w, M.x, M.y, 'Ice', 10);
      run(w, 0.5, { moveX: 1, moveY: 0 });
      return w.player.x + 480;
    };
    expect(speed(true) / speed(false)).toBeCloseTo(1 / (1 - MAP_TUNING.marsh.slow), 1);
    const w = world(MARSH);
    reactAt(w, M.x, M.y, 'Ice', 10);
    expect(marshFrozen(w, M.x, M.y)).toBe(true);
    run(w, MAP_TUNING.marsh.freeze.seconds + 0.1);
    expect(marshFrozen(w, M.x, M.y)).toBe(false);
  });
});

// Deep water from x −100 to 300 across the whole chunk.
const LAKE = Array<string>(10).fill('....wwww..');

describe('ice bridges (M3b)', () => {
  it('Ice on water lays a walkable strip up to 8 × 2 cells along the hit', () => {
    const w = world(LAKE);
    reactAt(w, -75, 25, 'Ice', 10, 1, 0);
    expect(w.map.bridges).toHaveLength(1);
    const cells = w.map.bridges[0]!.cells.size;
    expect(cells).toBeGreaterThan(2);
    expect(cells).toBeLessThanOrEqual(MAP_TUNING.iceBridge.cells * MAP_TUNING.iceBridge.width);
    expect(cellAt(w, -75, 25)).toBe(CELL.open);
    // A walker crosses on it.
    w.player.x = -300;
    w.player.y = 25;
    run(w, 5, { moveX: 1, moveY: 0 });
    expect(w.player.x).toBeGreaterThan(300);
  });

  it('it lasts 6 s, cracks for 1 s, then melts: walkers on it are stunned and put ashore, you are not stunned', () => {
    const w = world(LAKE);
    w.player.invulnLeft = 999;
    reactAt(w, -75, 25, 'Ice', 10, 1, 0);
    run(w, MAP_TUNING.iceBridge.seconds);
    expect(w.map.bridges).toHaveLength(1);
    const e = spawnEnemy(w, 'rattata', 25, 25);
    w.player.x = 75;
    w.player.y = 25;
    let stunned = false;
    for (let i = 0; i < 1.5 / DT && !stunned; i++) {
      step(w, IDLE, DT);
      stunned = w.map.bridges.length === 0 && e.stunLeft > 0;
    }
    expect(stunned).toBe(true);
    step(w, IDLE, DT);
    expect(cellAt(w, e.x, e.y)).not.toBe(CELL.water);
    expect(cellAt(w, w.player.x, w.player.y)).not.toBe(CELL.water);
  });

  it('at most 3 bridges: a 4th melts the oldest', () => {
    const w = world(LAKE);
    for (let i = 0; i < 4; i++) {
      reactAt(w, -75, -475 + i * 250, 'Ice', 10, 1, 0);
      w.time += MAP_TUNING.reactionCooldown;
    }
    expect(w.map.bridges).toHaveLength(MAP_TUNING.iceBridge.max);
    expect(cellAt(w, -75, -475)).toBe(CELL.water);
  });

  it('Fire on a bridge cracks it at once; Ice refreshes it', () => {
    const w = world(LAKE);
    reactAt(w, -75, 25, 'Ice', 10, 1, 0);
    const bridge = w.map.bridges[0]!;
    reactAt(w, -75, 25, 'Fire', 10);
    expect(bridge.frozenLeft).toBe(0);
    reactAt(w, -75, 25, 'Ice', 10);
    expect(bridge.frozenLeft).toBe(MAP_TUNING.iceBridge.seconds);
  });
});

describe('reaction triggers (README §8.1)', () => {
  it('a projectile reacts once per feature cell it enters, at most 4 times', () => {
    const w = world(Array<string>(10).fill('gggggggggg'));
    const shot = createProjectile();
    Object.assign(shot, { x: -480, y: 25, vx: 600, vy: 0, speed: 600, radius: 4, damage: 50, lifeLeft: 1.5, dead: false });
    shot.hit.attackType = 'Fire';
    w.projectiles.push(shot);
    for (let i = 0; i < 90; i++) updateProjectiles(w, DT);
    expect(shot.reacts).toBe(MAP_TUNING.trigger.projectile);
    expect(grassPhase(w, -475, 25)).toBe('burning');
  });

  it('a zone reacts where it is cast (Thunder Wave charges the marsh)', () => {
    const w = world(MARSH);
    spawnEnemy(w, 'rattata', M.x, M.y);
    w.player.x = M.x + 200;
    w.player.y = M.y;
    expect(castZone(w, createSlot('thunderWave'), MOVES.thunderWave as ZoneMoveDef)).toBe(true);
    expect(patchCharged(w, M.x, M.y)).toBe(true);
  });

  it('a beam reacts along its length (Ice Beam bridges the water)', () => {
    const w = world(LAKE);
    w.player.x = -300;
    w.player.y = 25;
    spawnEnemy(w, 'rattata', 0, 25);
    expect(castBeam(w, createSlot('iceBeam'), MOVES.iceBeam as BeamMoveDef)).toBe(true);
    expect(w.map.bridges).toHaveLength(1);
  });

  it('an orbit reacts at its balls (Fire Spin lights the grass around you)', () => {
    const w = world(Array<string>(10).fill('gggggggggg'));
    const slot = createSlot('fireSpin');
    const def = MOVES.fireSpin as OrbitMoveDef;
    castOrbit(w, slot, def);
    updateOrbit(w, slot, def, DT);
    const burning = [0, 90, 180, 270].some((deg) => {
      const a = (deg * Math.PI) / 180;
      return grassPhase(w, Math.cos(a) * def.orbitRadius, Math.sin(a) * def.orbitRadius) === 'burning';
    });
    expect(burning).toBe(true);
  });

  it('hits on open floor never count toward the cap', () => {
    const w = world(rowsOf());
    expect(reactAt(w, 0, 0, 'Fire', 10)).toBe(false);
  });
});
