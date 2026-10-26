import { describe, expect, it } from 'vitest';
import { TUNING, type PokemonId } from '../data/content';
import { CELL, MAP_TUNING } from '../data/map';
import { cellsOf, chunkKey, generateChunk, ledgesOf } from './map';
import { createSeededRng } from './rng';
import { berryTreeState, itemBallState } from './mapFeatures';
import type { MapSlot, Obstacle, World } from './types';
import { createWorld, spawnEnemy, step } from './world';

// Map features (D47, docs/map/README.md §7.5–§7.9), build step M4.

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };
const DOWN = { moveX: 0, moveY: 1 };
const UP = { moveX: 0, moveY: -1 };

/** A quiet world whose start chunk (−500…500; tile row r spans y −500 + 100r … −400 + 100r) holds these tiles. */
function world(rows: string[], pokemonId: PokemonId = 'charmander', features: { own?: Obstacle[]; itemBalls?: MapSlot[]; seed?: number } = {}): World {
  const w = createWorld({ rng: createSeededRng(features.seed ?? 1), spawnEnabled: false, mapSeed: 1, obstacleDensity: 1, pokemonId });
  w.moves = [];
  const chunk = generateChunk(1, 0, 0);
  const cells = cellsOf(rows);
  w.map.chunks.set(chunkKey(0, 0), {
    ...chunk,
    tiles: rows,
    own: features.own ?? [],
    near: features.own ?? [],
    slots: [],
    cells,
    water: cells.includes(CELL.water),
    patches: null,
    ledges: ledgesOf(rows, 0, 0),
    nearLedges: null,
    itemBalls: features.itemBalls ?? [],
  });
  // Neighbours too: their generated ledges would show up near the edges.
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const) {
    const n = generateChunk(1, dx, dy);
    w.map.chunks.set(chunkKey(dx, dy), { ...n, ledges: [], nearLedges: null, own: [], near: null, itemBalls: [] });
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

const FLAT = rowsOf();
const TREE: Obstacle = { x: 0, y: -200, radius: MAP_TUNING.berryTreeRadius, kind: 'berryTree' };
const BALL: MapSlot = { kind: 'item', x: 0, y: -200 };

describe('berry trees (M4)', () => {
  function atTree(): World {
    const w = world(FLAT, 'charmander', { own: [TREE] });
    w.player.invulnLeft = 999;
    w.player.x = 0;
    w.player.y = -200 + MAP_TUNING.berryTree.ring - 10;
    return w;
  }

  it('standing in the ring for 2 s shakes down 1–2 Oran Berries, then it is bare for 90 s', () => {
    const w = atTree();
    for (let i = 0; i < (MAP_TUNING.berryTree.capture - 0.1) / DT; i++) step(w, IDLE, DT);
    expect(w.berries).toHaveLength(0);
    for (let i = 0; i < 0.2 / DT; i++) step(w, IDLE, DT);
    const dropped = w.berries.filter((b) => b.kind === 'oran').length;
    expect(dropped).toBeGreaterThanOrEqual(1);
    expect(dropped).toBeLessThanOrEqual(2);
    for (let i = 0; i < 3 / DT; i++) step(w, IDLE, DT);
    expect(w.berries.length).toBe(dropped); // bare: no second harvest
    expect(w.time).toBeLessThan(berryTreeState(w, TREE)!.bareUntil);
  });

  it('progress drains while you are outside the ring', () => {
    const w = atTree();
    for (let i = 0; i < 1.5 / DT; i++) step(w, IDLE, DT);
    w.player.y = 300;
    for (let i = 0; i < 1 / DT; i++) step(w, IDLE, DT);
    expect(berryTreeState(w, TREE)!.progress).toBeCloseTo(0.5, 1);
  });

  it('the trunk blocks like any tall obstacle', () => {
    const w = atTree();
    w.player.y = -150;
    for (let i = 0; i < 1 / DT; i++) step(w, UP, DT);
    expect(Math.hypot(w.player.x - TREE.x, w.player.y - TREE.y)).toBeGreaterThanOrEqual(TREE.radius + w.player.radius - 0.01);
  });

  it('a harvest respects the berry cap', () => {
    const w = atTree();
    for (let i = 0; i < TUNING.heal.maxBerries; i++) w.berries.push({ id: -1 - i, kind: 'oran', x: 400, y: 400, collected: false });
    for (let i = 0; i < 2.5 / DT; i++) step(w, IDLE, DT);
    expect(w.berries.length).toBe(TUNING.heal.maxBerries);
  });
});

describe('item balls (M4)', () => {
  it('walking over one gives an XP cluster, an Oran Berry or a Magnet', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const w = world(FLAT, 'charmander', { itemBalls: [BALL], seed });
      w.player.invulnLeft = 999;
      w.player.x = 0;
      w.player.y = -100;
      for (let i = 0; i < 1.5 / DT && !itemBallState(w, BALL)?.taken; i++) step(w, UP, DT);
      expect(itemBallState(w, BALL)!.taken).toBe(true);
      if (w.gems.length >= MAP_TUNING.itemBall.xpGems) seen.add('xp');
      if (w.berries.some((b) => b.kind === 'oran')) seen.add('berry');
      if (w.berries.some((b) => b.kind === 'magnet')) seen.add('magnet');
    }
    expect([...seen].sort()).toEqual(['berry', 'magnet', 'xp']);
  });

  it('no Ambusher before 3:00', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = world(FLAT, 'charmander', { itemBalls: [BALL], seed });
      w.player.y = -200 + MAP_TUNING.itemBall.wakeRange - 5;
      step(w, IDLE, DT);
      expect(itemBallState(w, BALL)!.wobbleLeft).toBe(-1);
    }
  });

  it('after 3:00 some balls are a Voltorb: it always wobbles 0.6 s before it wakes', () => {
    let ambushes = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = world(FLAT, 'charmander', { itemBalls: [BALL], seed });
      w.time = 200;
      w.player.invulnLeft = 999;
      w.player.y = -200 + MAP_TUNING.itemBall.wakeRange - 5;
      step(w, IDLE, DT);
      if (itemBallState(w, BALL)!.wobbleLeft < 0) continue;
      ambushes++;
      expect(w.enemies.some((e) => e.kind === 'voltorb')).toBe(false); // the tell comes first
      for (let i = 0; i < (MAP_TUNING.itemBall.wobble + 0.05) / DT; i++) step(w, IDLE, DT);
      const voltorb = w.enemies.find((e) => e.kind === 'voltorb');
      expect(voltorb).toBeDefined();
      expect(itemBallState(w, BALL)!.taken).toBe(true);
    }
    expect(ambushes).toBeGreaterThan(3); // 25% of 40
    expect(ambushes).toBeLessThan(20);
  });
});

describe('map notices and telegraphs (M5)', () => {
  it('a first-time tip shows once a run (swimming)', () => {
    const w = world(Array<string>(10).fill('wwwwwwwwww'), 'squirtle');
    step(w, IDLE, DT);
    expect(w.map.notices).toEqual(['swimming']);
    w.map.notices.length = 0;
    w.player.x = 600; // out, then back in
    step(w, IDLE, DT);
    w.player.x = 0;
    step(w, IDLE, DT);
    expect(w.map.notices).toEqual([]);
  });

  it('an arena entrance is foreshadowed 15 s ahead, on the spot that then opens', () => {
    const w = world(FLAT);
    w.spawnEnabled = true;
    w.spawnTimer = 1e9;
    w.nextHordeAt = 1e9;
    w.player.invulnLeft = 999;
    const at = w.arenaSchedule[0]!;
    w.time = at - MAP_TUNING.foreshadow.seconds - 0.5;
    step(w, IDLE, DT);
    expect(w.foreshadow).toBeNull();
    while (!w.foreshadow) step(w, IDLE, DT);
    expect(at - w.time).toBeCloseTo(MAP_TUNING.foreshadow.seconds, 0);
    expect(w.map.notices.some((id) => id.startsWith('foreshadow.'))).toBe(true);
    const { bossId, x, y } = w.foreshadow;
    while (!w.entrance) step(w, IDLE, DT);
    expect(w.entrance).toMatchObject({ bossId, x, y });
    expect(w.foreshadow).toBeNull();
  });

  it('a horde whose side has tall grass comes out of it, and the grass gives the warning', () => {
    const w = world(Array<string>(10).fill('gggggggggg'));
    w.spawnEnabled = true;
    w.spawnTimer = 1e9;
    w.player.invulnLeft = 999;
    w.time = 120;
    w.nextHordeAt = 120;
    w.arenaEventsDone = 99; // no arena events left
    step(w, IDLE, DT);
    const from = w.hordeWarning?.from;
    expect(from).toBeTruthy();
    const d = Math.hypot(from!.x - w.player.x, from!.y - w.player.y);
    expect(d).toBeGreaterThanOrEqual(MAP_TUNING.horde.minDistance);
    expect(w.map.notices).toContain('hordeEmerge');
    while (w.hordeWarning) step(w, IDLE, DT);
    const leader = w.enemies.find((e) => e.elite)!;
    expect(Math.hypot(leader.x - from!.x, leader.y - from!.y)).toBeLessThan(60);
  });

  it('off the map, hordes still come from the spawn ring', () => {
    const w = createWorld({ rng: createSeededRng(1), spawnEnabled: true, mapSeed: 1 });
    w.spawnTimer = 1e9;
    w.time = 120;
    w.nextHordeAt = 120;
    w.arenaEventsDone = 99; // no arena events left
    step(w, IDLE, DT);
    expect(w.hordeWarning).toBeTruthy();
    expect(w.hordeWarning!.from).toBeNull();
  });
});
