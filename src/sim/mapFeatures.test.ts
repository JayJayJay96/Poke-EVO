import { describe, expect, it } from 'vitest';
import { TUNING, type PokemonId } from '../data/content';
import { CELL, MAP_TUNING } from '../data/map';
import { cellsOf, chunkKey, generateChunk, ledgesOf } from './map';
import { createSeededRng } from './rng';
import type { World } from './types';
import { createWorld, spawnEnemy, step } from './world';

// Map features (D47, docs/map/README.md §7.5–§7.9), build step M4.

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };
const DOWN = { moveX: 0, moveY: 1 };
const UP = { moveX: 0, moveY: -1 };

/** A quiet world whose start chunk (−500…500; tile row r spans y −500 + 100r … −400 + 100r) holds these tiles. */
function world(rows: string[], pokemonId: PokemonId = 'charmander'): World {
  const w = createWorld({ rng: createSeededRng(1), spawnEnabled: false, mapSeed: 1, obstacleDensity: 1, pokemonId });
  w.moves = [];
  const chunk = generateChunk(1, 0, 0);
  const cells = cellsOf(rows);
  w.map.chunks.set(chunkKey(0, 0), {
    ...chunk,
    tiles: rows,
    own: [],
    near: [],
    slots: [],
    cells,
    water: cells.includes(CELL.water),
    patches: null,
    ledges: ledgesOf(rows, 0, 0),
    nearLedges: null,
  });
  // Neighbours too: their generated ledges would show up near the edges.
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const) {
    const n = generateChunk(1, dx, dy);
    w.map.chunks.set(chunkKey(dx, dy), { ...n, ledges: [], nearLedges: null });
  }
  return w;
}

const rowsOf = (...rows: string[]): string[] => [...rows, ...Array<string>(10 - rows.length).fill('..........')];
// A south-facing ledge whose lip runs y = 0 from x −500 to 500 (row 4 is all `v`).
const LEDGE = rowsOf('..........', '..........', '..........', '..........', 'vvvvvvvvvv');

describe('ledges (M4)', () => {
  it('ledge tiles in a line merge into one lip, with its drop side', () => {
    expect(ledgesOf(LEDGE, 0, 0)).toEqual([{ x1: -500, y1: 0, x2: 500, y2: 0, nx: 0, ny: 1 }]);
    const west = ledgesOf(rowsOf('..<.......', '..<.......'), 0, 0);
    expect(west).toEqual([{ x1: -300, y1: -500, x2: -300, y2: -300, nx: -1, ny: 0 }]);
  });

  it('walking off a ledge is a hop: 60 px over 0.35 s, input locked, no invulnerability', () => {
    const w = world(LEDGE);
    w.player.x = 0;
    w.player.y = -1; // one step (2.5 px) takes it over the lip
    step(w, DOWN, DT);
    expect(w.player.hopLeft).toBeGreaterThan(0);
    const y = w.player.y;
    for (let i = 0; i < MAP_TUNING.ledge.hopSeconds / DT; i++) {
      expect(w.player.invulnLeft).toBe(0);
      step(w, UP, DT); // pressing back does nothing mid-hop
    }
    expect(w.player.y - y).toBeCloseTo(MAP_TUNING.ledge.hopDistance, -1);
  });

  it('climbing back up is slow (30%) inside the band below the lip', () => {
    const climbed = (rows: string[]): number => {
      const w = world(rows);
      w.player.x = 0;
      w.player.y = 15;
      step(w, UP, DT);
      return 15 - w.player.y;
    };
    expect(climbed(LEDGE) / climbed(rowsOf())).toBeCloseTo(MAP_TUNING.ledge.climbFactor, 5);
  });

  it('enemies climb at 30% too and step down without a hop', () => {
    const speed = (rows: string[], startY: number, playerY: number): number => {
      const w = world(rows);
      w.player.invulnLeft = 999;
      w.player.y = playerY;
      const e = spawnEnemy(w, 'rattata', 0, startY);
      step(w, IDLE, DT);
      return Math.abs(e.y - startY);
    };
    expect(speed(LEDGE, 15, -300) / speed(rowsOf(), 15, -300)).toBeCloseTo(MAP_TUNING.ledge.climbFactor, 2);
    expect(speed(LEDGE, -15, 300) / speed(rowsOf(), -15, 300)).toBeCloseTo(1, 2);
  });

  it('Charizard flies over ledges: no hop, no climb', () => {
    const w = world(LEDGE);
    w.player.stage = 2;
    w.player.y = -1;
    step(w, DOWN, DT);
    expect(w.player.hopLeft).toBe(0);
    const up = world(LEDGE);
    up.player.stage = 2;
    up.player.y = 15;
    const flat = world(rowsOf());
    flat.player.stage = 2;
    flat.player.y = 15;
    step(up, UP, DT);
    step(flat, UP, DT);
    expect(15 - up.player.y).toBeCloseTo(15 - flat.player.y, 5);
  });
});
