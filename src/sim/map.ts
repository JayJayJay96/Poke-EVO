import type { ArenaEntranceKind } from '../data/arena';
import { ENEMIES, POKEMON } from '../data/content';
import {
  BIOME_IDS,
  BIOMES,
  CELL,
  CELL_OF_TILE,
  ENTRANCE_BIOME,
  MAP_TUNING,
  SET_PIECES,
  type BiomeId,
  type CellClass,
  type ObstacleKind,
  type SlotKind,
  type Traversal,
} from '../data/map';
import { ELITE_ABILITY } from '../data/hordes';
import { marshFrozen } from './mapReactions';
import { createSeededRng, type Rng } from './rng';
import type { Enemy, Ledge, MapChunk, MapSlot, Obstacle, World } from './types';

// Main map (D47, docs/map/README.md), build step M2. Each 1000 px chunk gets a biome from seeded noise, then one
// hand-made set piece (rotated or mirrored) plus a few lone fillers. A layout is kept only if it passes the lane
// check: every chunk edge keeps the same two door gaps open and every walkable cell connects to them, so the whole
// map stays connected (R1) without a chunk ever reading its neighbours. Arenas sit on the same coordinates, so the
// map is switched off while a fight runs.

const EMPTY: readonly Obstacle[] = [];
/** Tiles per chunk side. */
const N = 10;
/** Lane-check cells per chunk side. */
const CELLS = MAP_TUNING.chunkSize / MAP_TUNING.cellSize;

interface Circle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Chunk index for a world coordinate; chunk (0, 0) is centred on the start (same chunks as sites). */
export function chunkOf(v: number): number {
  return Math.floor(v / MAP_TUNING.chunkSize + 0.5);
}

/** Numeric chunk key, so lookups in the hot path build no strings; unique within ±32k chunks. */
export function chunkKey(cx: number, cy: number): number {
  return (cx + 32768) * 65536 + (cy + 32768);
}

function isStart(cx: number, cy: number): boolean {
  return Math.abs(cx) <= 1 && Math.abs(cy) <= 1;
}

// ---- Biomes ----------------------------------------------------------------------------------------------------

function lattice(seed: number, ix: number, iy: number, field: number): number {
  return createSeededRng((Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(field + 1, 83492791) ^ seed) >>> 0).next();
}

/** Smooth value noise in [0, 1): one field per biome. */
function noise(seed: number, x: number, y: number, field: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const sx = smooth(x - ix);
  const sy = smooth(y - iy);
  const top = lerp(lattice(seed, ix, iy, field), lattice(seed, ix + 1, iy, field), sx);
  const bottom = lerp(lattice(seed, ix, iy + 1, field), lattice(seed, ix + 1, iy + 1, field), sx);
  return lerp(top, bottom, sy);
}

/** The chunk's biome: the start and its 8 neighbours are meadow; elsewhere the strongest biased noise field wins. */
export function biomeAt(mapSeed: number, cx: number, cy: number): BiomeId {
  if (isStart(cx, cy)) return 'meadow';
  const s = MAP_TUNING.noiseScale;
  let best: BiomeId = 'meadow';
  let bestValue = -Infinity;
  BIOME_IDS.forEach((id, field) => {
    const v = noise(mapSeed, cx / s, cy / s, field) + BIOMES[id].bias;
    if (v > bestValue) {
      bestValue = v;
      best = id;
    }
  });
  return best;
}

// ---- Set pieces -----------------------------------------------------------------------------------------------

/** Ledge characters by the side they drop to, and where each goes after a clockwise quarter turn. */
const TURN_CW: Readonly<Record<string, string>> = { v: '<', '<': '^', '^': '>', '>': 'v' };
const MIRROR: Readonly<Record<string, string>> = { '<': '>', '>': '<' };

/**
 * A piece's rows after transform `t` (0–7): bit 2 mirrors left↔right, bits 0–1 turn it clockwise that many quarter
 * turns. Ledges turn with it; a result with a north-facing ledge (`^`) is never used (README §7.5).
 */
export function transformTiles(rows: readonly string[], t: number): string[] {
  let grid = rows.map((row) => [...row]);
  if (t & 4) grid = grid.map((row) => row.reverse().map((ch) => MIRROR[ch] ?? ch));
  for (let k = 0; k < (t & 3); k++) {
    grid = grid.map((_, r) => grid.map((__, c) => grid[N - 1 - c]![r]!).map((ch) => TURN_CW[ch] ?? ch));
  }
  return grid.map((row) => row.join(''));
}

/** Tiles that stand tall (trees, boulders, berry-tree trunks). */
const TALL = 'ToB';

/**
 * Breaks big groups of tall tiles (D47 amendment 2026-10-26, owner: big obstacle groups still hold mobs back even with
 * wall-follow). A tall tile may touch at most one other, diagonals included, so a group is a pair at most and every
 * other tall tile stands a full tile away: a ≥ 100 px gap between trunks, wide enough for any non-boss enemy. Berry
 * trunks are kept first (they're slots); the rest are kept in reading order, and a dropped tile becomes open floor.
 * Deterministic, so the same seed still gives the same map.
 */
export function thinTall(rows: readonly string[]): string[] {
  const grid = rows.map((row) => [...row]);
  const kept = rows.map((row) => [...row].map(() => false));
  const keptAround = (r: number, c: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && kept[r + dr]?.[c + dc]) out.push([r + dr, c + dc]);
    }
    return out;
  };
  const visit = (r: number, c: number): void => {
    const around = keptAround(r, c);
    // Alone, or next to exactly one kept tile that has no other partner yet: keep it, making at most a pair.
    if (around.length === 0 || (around.length === 1 && keptAround(...around[0]!).length === 0)) kept[r]![c] = true;
    else grid[r]![c] = '.';
  };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r]![c] === 'B') visit(r, c);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (TALL.includes(grid[r]![c]!) && grid[r]![c] !== 'B') visit(r, c);
  return grid.map((row) => row.join(''));
}

interface Stamped {
  own: Obstacle[];
  /** Tall things with no rules yet (berry tree trunks, M4) that the lane check and caps already count. */
  future: Circle[];
  slots: MapSlot[];
}

const SLOT_OF: Readonly<Record<string, SlotKind>> = { S: 'site', E: 'entrance', B: 'berry', I: 'item' };

function between(rng: Rng, [lo, hi]: readonly [number, number]): number {
  return lo + rng.next() * (hi - lo);
}

function jitter(rng: Rng, amount: number): number {
  return (rng.next() * 2 - 1) * amount;
}

/** Turns tiles into world obstacles and slots; obstacles sit on their tile's centre. */
function stamp(tiles: readonly string[], cx: number, cy: number, rng: Rng): Stamped {
  const { chunkSize, tileSize, tree, boulder, berryTreeRadius } = MAP_TUNING;
  const left = (cx - 0.5) * chunkSize;
  const top = (cy - 0.5) * chunkSize;
  const out: Stamped = { own: [], future: [], slots: [] };
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const ch = tiles[r]![c]!;
      const x = left + (c + 0.5) * tileSize;
      const y = top + (r + 0.5) * tileSize;
      if (ch === 'T') out.own.push({ x, y, radius: between(rng, tree.radius), kind: 'tree' });
      else if (ch === 'o') {
        out.own.push({ x: x + jitter(rng, boulder.jitter), y: y + jitter(rng, boulder.jitter), radius: between(rng, boulder.radius), kind: 'boulder' });
      } else if (SLOT_OF[ch]) {
        out.slots.push({ kind: SLOT_OF[ch]!, x, y });
        if (ch === 'B') out.future.push({ x, y, radius: berryTreeRadius });
      }
    }
  }
  return out;
}

/** Share of the chunk that blocks a walker: tall circles plus deep-water tiles (R7). */
function blocking(tiles: readonly string[], circles: readonly Circle[]): number {
  const { chunkSize, tileSize } = MAP_TUNING;
  let area = 0;
  for (const c of circles) area += Math.PI * c.radius * c.radius;
  for (const row of tiles) for (const ch of row) if (ch === 'w') area += tileSize * tileSize;
  return area / (chunkSize * chunkSize);
}

/**
 * The lane check (R1, README §5.4 as built). Rasterises the chunk into 50 px cells (deep water and cells whose centre
 * is within `laneMargin` of a tall circle are blocked), then requires every door cell on every edge to be open and
 * every open cell to be reachable from them.
 */
export function lanesOpen(tiles: readonly string[], circles: readonly Circle[], cx: number, cy: number): boolean {
  const { chunkSize, cellSize, tileSize, laneMargin, doorTiles } = MAP_TUNING;
  const left = (cx - 0.5) * chunkSize;
  const top = (cy - 0.5) * chunkSize;
  const open = new Uint8Array(CELLS * CELLS);
  let openCount = 0;
  for (let i = 0; i < CELLS; i++) {
    for (let j = 0; j < CELLS; j++) {
      const tile = tiles[Math.floor((i * cellSize) / tileSize)]![Math.floor((j * cellSize) / tileSize)];
      if (tile === 'w') continue;
      const x = left + (j + 0.5) * cellSize;
      const y = top + (i + 0.5) * cellSize;
      if (circles.some((c) => (x - c.x) ** 2 + (y - c.y) ** 2 < (c.radius + laneMargin) ** 2)) continue;
      open[i * CELLS + j] = 1;
      openCount++;
    }
  }
  const per = tileSize / cellSize;
  const doors: number[] = [];
  for (const d of doorTiles) {
    for (let k = 0; k < per; k++) {
      const a = d * per + k;
      doors.push(a, (CELLS - 1) * CELLS + a, a * CELLS, a * CELLS + CELLS - 1); // top, bottom, left, right edge
    }
  }
  if (doors.some((cell) => !open[cell])) return false;
  // Flood fill from one door; every open cell must be reached.
  const seen = new Uint8Array(CELLS * CELLS);
  const queue = [doors[0]!];
  seen[doors[0]!] = 1;
  let reached = 0;
  while (queue.length > 0) {
    const cell = queue.pop()!;
    reached++;
    const i = Math.floor(cell / CELLS);
    const j = cell % CELLS;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= CELLS || nj >= CELLS) continue;
      const next = ni * CELLS + nj;
      if (open[next] && !seen[next]) {
        seen[next] = 1;
        queue.push(next);
      }
    }
  }
  return reached === openCount;
}

/** Tiles a filler may take: empty, away from the chunk edge, with nothing tall, wet or reserved around it. */
function fillerTiles(tiles: readonly string[]): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 1; r < N - 1; r++) {
    for (let c = 1; c < N - 1; c++) {
      let clear = true;
      for (let dr = -1; dr <= 1 && clear; dr++) for (let dc = -1; dc <= 1 && clear; dc++) clear = '.gr'.includes(tiles[r + dr]![c + dc]!);
      if (clear) out.push([r, c]);
    }
  }
  return out;
}

function chunkRng(mapSeed: number, cx: number, cy: number): Rng {
  return createSeededRng((Math.imul(cx, 83492791) ^ Math.imul(cy, 50331653) ^ mapSeed ^ 0x2f6b4e1d) >>> 0);
}

function pickPiece(rng: Rng, pieces: readonly { readonly id: string; readonly weight: number }[]): string {
  const total = pieces.reduce((sum, p) => sum + p.weight, 0);
  let roll = rng.next() * total;
  for (const p of pieces) {
    roll -= p.weight;
    if (roll < 0) return p.id;
  }
  return pieces[pieces.length - 1]!.id;
}

/**
 * One chunk, from the map seed alone (the same seed, chunk and forced biome always give the same layout). The picked
 * piece is tried in its 8 orientations in a seeded order; the first that fits the coverage cap and passes the lane
 * check is used, fillers are added if the check still passes with them, and `open` is the fallback.
 */
export function generateChunk(mapSeed: number, cx: number, cy: number, forceBiome: BiomeId | null = null): MapChunk {
  const rng = chunkRng(mapSeed, cx, cy);
  const start = isStart(cx, cy) && !forceBiome;
  const biome = forceBiome ?? biomeAt(mapSeed, cx, cy);
  const def = BIOMES[biome];
  const cap = start ? MAP_TUNING.startMaxBlocking : def.maxBlocking;
  const picked = pickPiece(rng, start ? def.pieces.filter((p) => SET_PIECES[p.id]!.startSafe) : def.pieces);
  const order = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let i = order.length - 1; i > 0; i--) {
    const k = Math.floor(rng.next() * (i + 1));
    [order[i], order[k]] = [order[k]!, order[i]!];
  }
  for (const piece of [picked, 'open']) {
    for (const transform of order) {
      const tiles = thinTall(transformTiles(SET_PIECES[piece]!.rows, transform));
      if (tiles.some((row) => row.includes('^'))) continue;
      const placed = stamp(tiles, cx, cy, rng);
      if (start) placed.own = placed.own.filter((o) => Math.hypot(o.x, o.y) >= MAP_TUNING.startClear + o.radius);
      const circles = [...placed.own, ...placed.future];
      if (blocking(tiles, circles) > cap || !lanesOpen(tiles, circles, cx, cy)) continue;
      const own = [...placed.own, ...fillers(rng, tiles, circles, cap, def.filler, cx, cy, start)];
      const cells = cellsOf(tiles);
      return { cx, cy, biome, piece, transform, tiles, own, near: null, slots: placed.slots, cells, water: cells.includes(CELL.water), patches: null, ledges: ledgesOf(tiles, cx, cy), nearLedges: null };
    }
  }
  throw new Error(`map: no layout fits chunk ${cx},${cy}`); // `open` always fits, so this can't happen
}

/** The chunk's 50 px cells from its 100 px tiles (each tile is 2 × 2 cells). */
export function cellsOf(tiles: readonly string[]): Uint8Array {
  const cells = new Uint8Array(CELLS * CELLS);
  for (let i = 0; i < CELLS; i++) {
    for (let j = 0; j < CELLS; j++) cells[i * CELLS + j] = CELL_OF_TILE[tiles[i >> 1]![j >> 1]!] ?? CELL.open;
  }
  return cells;
}

/** Lone fillers in clear tiles, kept only if the cap and the lane check still hold with them. */
function fillers(
  rng: Rng,
  tiles: readonly string[],
  circles: readonly Circle[],
  cap: number,
  filler: { readonly kind: ObstacleKind; readonly max: number } | null,
  cx: number,
  cy: number,
  start: boolean,
): Obstacle[] {
  if (!filler) return [];
  const { chunkSize, tileSize } = MAP_TUNING;
  const free = fillerTiles(tiles);
  const count = Math.floor(rng.next() * (filler.max + 1));
  const added: Obstacle[] = [];
  for (let n = 0; n < count && free.length > 0; n++) {
    const [r, c] = free.splice(Math.floor(rng.next() * free.length), 1)[0]!;
    const { jitter: amount } = MAP_TUNING.filler;
    const o: Obstacle = {
      x: (cx - 0.5) * chunkSize + (c + 0.5) * tileSize + jitter(rng, amount),
      y: (cy - 0.5) * chunkSize + (r + 0.5) * tileSize + jitter(rng, amount),
      radius: between(rng, MAP_TUNING.filler[filler.kind]),
      kind: filler.kind,
    };
    if (start && Math.hypot(o.x, o.y) < MAP_TUNING.startClear + o.radius) continue;
    if (blocking(tiles, [...circles, ...added, o]) > cap) continue;
    added.push(o);
    // Fillers stand alone (D47 amendment 2026-10-26): no other filler in the 8 tiles around this one.
    for (let k = free.length - 1; k >= 0; k--) if (Math.max(Math.abs(free[k]![0] - r), Math.abs(free[k]![1] - c)) <= 1) free.splice(k, 1);
  }
  return lanesOpen(tiles, [...circles, ...added], cx, cy) ? added : [];
}

// ---- Lookups ---------------------------------------------------------------------------------------------------

/** The chunk record, generated the first time anything asks. */
export function mapChunk(world: World, cx: number, cy: number): MapChunk {
  const key = chunkKey(cx, cy);
  let chunk = world.map.chunks.get(key);
  if (!chunk) {
    chunk = generateChunk(world.mapSeed, cx, cy, world.map.forceBiome);
    world.map.chunks.set(key, chunk);
  }
  return chunk;
}

/** Own obstacles plus every neighbour's obstacle that comes within `reach` of this chunk. */
function nearList(world: World, chunk: MapChunk): Obstacle[] {
  const { chunkSize, reach } = MAP_TUNING;
  const left = (chunk.cx - 0.5) * chunkSize;
  const top = (chunk.cy - 0.5) * chunkSize;
  const list = [...chunk.own];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      for (const o of mapChunk(world, chunk.cx + dx, chunk.cy + dy).own) {
        const nx = Math.max(left, Math.min(o.x, left + chunkSize));
        const ny = Math.max(top, Math.min(o.y, top + chunkSize));
        if (Math.hypot(o.x - nx, o.y - ny) <= o.radius + reach) list.push(o);
      }
    }
  }
  return list;
}

/** Every obstacle a mover in the chunk holding (x, y) could touch. */
export function obstaclesAt(world: World, x: number, y: number): readonly Obstacle[] {
  if (world.map.density <= 0) return EMPTY;
  const chunk = mapChunk(world, chunkOf(x), chunkOf(y));
  if (!chunk.near) chunk.near = nearList(world, chunk);
  return chunk.near;
}

/** The chunk's site slot, if its set piece has one (sites use it instead of a random spot). */
export function siteSlot(world: World, cx: number, cy: number): MapSlot | null {
  if (world.map.density <= 0) return null;
  return mapChunk(world, cx, cy).slots.find((s) => s.kind === 'site') ?? null;
}

/**
 * Where an arena entrance opens (D47 15-4): the nearest entrance slot in a biome that suits it, between
 * `entranceSlot.min` and `.max` px from the player; null when there's none (the caller falls back to today's rule).
 */
export function entranceSlot(world: World, kind: ArenaEntranceKind): MapSlot | null {
  const biome = ENTRANCE_BIOME[kind];
  if (world.map.density <= 0 || !biome) return null;
  const { min, max } = MAP_TUNING.entranceSlot;
  const { x: px, y: py } = world.player;
  let best: MapSlot | null = null;
  let bestDist = Infinity;
  for (let cy = chunkOf(py - max); cy <= chunkOf(py + max); cy++) {
    for (let cx = chunkOf(px - max); cx <= chunkOf(px + max); cx++) {
      const chunk = mapChunk(world, cx, cy);
      if (chunk.biome !== biome) continue;
      for (const slot of chunk.slots) {
        if (slot.kind !== 'entrance') continue;
        const d = Math.hypot(slot.x - px, slot.y - py);
        if (d >= min && d <= max && d < bestDist) {
          best = slot;
          bestDist = d;
        }
      }
    }
  }
  return best;
}

// ---- Terrain cells (M3) ----------------------------------------------------------------------------------------

const CELL_SIZE = MAP_TUNING.cellSize;
/** Enemy species that fly over low terrain (README §4.2: Flying types). */
const FLYING_KINDS = new Set(Object.values(ENEMIES).filter((e) => e.types.includes('Flying')).map((e) => e.id));

/** Numeric key of global cell (gx, gy); unique within ±1M cells. */
export function cellKey(gx: number, gy: number): number {
  return (gx + 1048576) * 2097152 + (gy + 1048576);
}

/**
 * Class of global cell (gx, gy); cell 0 spans 0…50 px, and chunk edges fall on cell edges. Water under a standing ice
 * bridge reads as open floor (M3b).
 */
function cellAtCell(world: World, gx: number, gy: number): CellClass {
  const cx = chunkOf(gx * CELL_SIZE + CELL_SIZE / 2);
  const cy = chunkOf(gy * CELL_SIZE + CELL_SIZE / 2);
  const chunk = mapChunk(world, cx, cy);
  const cell = chunk.cells[(gy - cy * CELLS + CELLS / 2) * CELLS + (gx - cx * CELLS + CELLS / 2)] as CellClass;
  if (cell === CELL.water && world.map.bridges.length > 0 && onBridge(world, gx, gy)) return CELL.open;
  return cell;
}

/** Whether global cell (gx, gy) lies under a standing ice bridge. */
export function onBridge(world: World, gx: number, gy: number): boolean {
  const key = cellKey(gx, gy);
  return world.map.bridges.some((b) => b.cells.has(key));
}

/** The ground's own class at (x, y), ignoring ice bridges: what a reaction sees. */
export function groundAt(world: World, x: number, y: number): CellClass {
  if (world.arena || world.map.density <= 0) return CELL.open;
  const gx = Math.floor(x / CELL_SIZE);
  const gy = Math.floor(y / CELL_SIZE);
  const cx = chunkOf(gx * CELL_SIZE + CELL_SIZE / 2);
  const cy = chunkOf(gy * CELL_SIZE + CELL_SIZE / 2);
  return mapChunk(world, cx, cy).cells[(gy - cy * CELLS + CELLS / 2) * CELLS + (gx - cx * CELLS + CELLS / 2)] as CellClass;
}

/**
 * Where (x, y) sits in a terrain patch: the patch's key (0 on open floor), and the cell's index inside its chunk.
 * A patch is a 4-connected group of same-class cells inside one chunk. shortcut: patches stop at chunk edges (a set
 * piece rarely puts water, marsh or grass on a door); join them across chunks if a playtest shows a seam.
 */
export function patchAt(world: World, x: number, y: number): { key: number; index: number; chunk: MapChunk | null } {
  if (world.arena || world.map.density <= 0) return { key: 0, index: 0, chunk: null };
  const gx = Math.floor(x / CELL_SIZE);
  const gy = Math.floor(y / CELL_SIZE);
  const cx = chunkOf(gx * CELL_SIZE + CELL_SIZE / 2);
  const cy = chunkOf(gy * CELL_SIZE + CELL_SIZE / 2);
  const chunk = mapChunk(world, cx, cy);
  if (!chunk.patches) chunk.patches = patchLabels(chunk.cells);
  const index = (gy - cy * CELLS + CELLS / 2) * CELLS + (gx - cx * CELLS + CELLS / 2);
  const label = chunk.patches[index]!;
  return { key: label === 0 ? 0 : chunkKey(cx, cy) * 1024 + label, index, chunk };
}

/** Labels each non-open cell with its patch (1, 2, …) by flood fill; open cells stay 0. */
export function patchLabels(cells: Uint8Array): Uint16Array {
  const labels = new Uint16Array(cells.length);
  let next = 0;
  for (let start = 0; start < cells.length; start++) {
    if (cells[start] === CELL.open || labels[start]) continue;
    labels[start] = ++next;
    const queue = [start];
    while (queue.length > 0) {
      const cell = queue.pop()!;
      const i = Math.floor(cell / CELLS);
      const j = cell % CELLS;
      for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const) {
        if (ni < 0 || nj < 0 || ni >= CELLS || nj >= CELLS) continue;
        const n = ni * CELLS + nj;
        if (!labels[n] && cells[n] === cells[start]) {
          labels[n] = next;
          queue.push(n);
        }
      }
    }
  }
  return labels;
}

/** Every cell index in `chunk` that shares the patch of cell `index` (call `patchAt` first, it builds the labels). */
export function patchCells(chunk: MapChunk, index: number): number[] {
  const label = chunk.patches![index]!;
  const out: number[] = [];
  if (label === 0) return out;
  chunk.patches!.forEach((l, i) => {
    if (l === label) out.push(i);
  });
  return out;
}

/** World centre of cell `index` of `chunk`. */
export function cellCentre(chunk: MapChunk, index: number): { x: number; y: number } {
  return {
    x: (chunk.cx - 0.5) * MAP_TUNING.chunkSize + ((index % CELLS) + 0.5) * CELL_SIZE,
    y: (chunk.cy - 0.5) * MAP_TUNING.chunkSize + (Math.floor(index / CELLS) + 0.5) * CELL_SIZE,
  };
}

/** What the ground holds at (x, y): water, marsh, tall grass or open. Always open in an arena or on an empty map. */
export function cellAt(world: World, x: number, y: number): CellClass {
  if (world.arena || world.map.density <= 0) return CELL.open;
  return cellAtCell(world, Math.floor(x / CELL_SIZE), Math.floor(y / CELL_SIZE));
}

/** The player's traversal flag, from the current stage (Charizard flies; the Squirtle line and Lapras swim). */
export function playerTraversal(world: World): Traversal {
  return POKEMON[world.player.pokemonId].stages[world.player.stage]!.traversal ?? 'ground';
}

/** An enemy's traversal flag: Flying types fly, an Elite Gastly levitates, the rest walk (README §4.2). */
export function enemyTraversal(enemy: Enemy): Traversal {
  if (FLYING_KINDS.has(enemy.kind)) return 'fly';
  return enemy.elite && ELITE_ABILITY[enemy.kind] === 'levitate' ? 'levitate' : 'ground';
}

function waterBlocks(flag: Traversal): boolean {
  return flag === 'ground' || flag === 'levitate';
}

/** Speed factor of the ground under (x, y) for a mover: marsh slows walkers, swimmers move at their water speed. */
export function terrainSpeed(world: World, x: number, y: number, flag: Traversal, swimSpeed = 1): number {
  if (flag === 'fly' || flag === 'levitate') return 1;
  const cell = cellAt(world, x, y);
  if (cell === CELL.slow) return flag === 'ground' && !marshFrozen(world, x, y) ? 1 - MAP_TUNING.marsh.slow : 1;
  return cell === CELL.water && flag === 'swim' ? swimSpeed : 1;
}

/** The player's water speed (D47 15-2: Lapras ×1.0, Squirtle line ×0.85). */
export function playerSwimSpeed(world: World): number {
  return (MAP_TUNING.swim.speed as Partial<Record<string, number>>)[world.player.pokemonId] ?? 1;
}

/**
 * Centre of the nearest cell whose class passes `ok`, searching outward up to `MAP_TUNING.shoreSearch` cells; (x, y)
 * itself when its own cell passes, null when nothing within reach does.
 */
export function nearestCell(world: World, x: number, y: number, ok: (cell: CellClass) => boolean): { x: number; y: number } | null {
  const gx = Math.floor(x / CELL_SIZE);
  const gy = Math.floor(y / CELL_SIZE);
  if (ok(cellAtCell(world, gx, gy))) return { x, y };
  for (let ring = 1; ring <= MAP_TUNING.shoreSearch; ring++) {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring || !ok(cellAtCell(world, gx + dx, gy + dy))) continue;
        const cx = (gx + dx + 0.5) * CELL_SIZE;
        const cy = (gy + dy + 0.5) * CELL_SIZE;
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x: cx, y: cy };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

const notWater = (cell: CellClass): boolean => cell !== CELL.water;
const dryFloor = (cell: CellClass): boolean => cell === CELL.open || cell === CELL.grass;

/** Where a pickup dropped at (x, y) comes to rest: the nearest dry cell if it fell in water (README §5.5). */
export function shore(world: World, x: number, y: number): { x: number; y: number } {
  return (cellAt(world, x, y) === CELL.water && nearestCell(world, x, y, notWater)) || { x, y };
}

/**
 * Moves a circle out of every deep-water cell it overlaps, for a mover water stops (README §11.1); says whether it
 * moved. Like the circles, only the part of the motion that went in is undone, so movers slide along the shore. A
 * centre that ends up inside water (a spawn, a recycle) is lifted to the nearest dry cell.
 */
export function pushOutOfWater(world: World, body: { x: number; y: number }, radius: number, flag: Traversal): boolean {
  if (!waterBlocks(flag) || world.map.density <= 0) return false;
  // Fast path: wholly inside a chunk with no water (the common case, and every woods or canyon chunk).
  const cx = chunkOf(body.x);
  const cy = chunkOf(body.y);
  const half = MAP_TUNING.chunkSize / 2;
  const inside = Math.abs(body.x - cx * MAP_TUNING.chunkSize) < half - radius && Math.abs(body.y - cy * MAP_TUNING.chunkSize) < half - radius;
  if (inside && !mapChunk(world, cx, cy).water) return false;
  if (cellAt(world, body.x, body.y) === CELL.water) {
    const dry = nearestCell(world, body.x, body.y, notWater);
    if (!dry) return false;
    body.x = dry.x;
    body.y = dry.y;
    return true;
  }
  let moved = false;
  for (let gy = Math.floor((body.y - radius) / CELL_SIZE); gy <= Math.floor((body.y + radius) / CELL_SIZE); gy++) {
    for (let gx = Math.floor((body.x - radius) / CELL_SIZE); gx <= Math.floor((body.x + radius) / CELL_SIZE); gx++) {
      if (cellAtCell(world, gx, gy) !== CELL.water) continue;
      const qx = Math.max(gx * CELL_SIZE, Math.min(body.x, (gx + 1) * CELL_SIZE));
      const qy = Math.max(gy * CELL_SIZE, Math.min(body.y, (gy + 1) * CELL_SIZE));
      const dx = body.x - qx;
      const dy = body.y - qy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius || d2 === 0) continue;
      const d = Math.sqrt(d2);
      body.x = qx + (dx / d) * radius;
      body.y = qy + (dy / d) * radius;
      moved = true;
    }
  }
  return moved;
}

// ---- Ledges (M4) ------------------------------------------------------------------------------------------------

/**
 * Ledge lips from the tiles (README §7.5): `v` drops south (lip on the tile's south edge), `<` west and `>` east (lip
 * on that edge). Neighbouring ledge tiles in a line merge into one segment.
 */
export function ledgesOf(tiles: readonly string[], cx: number, cy: number): Ledge[] {
  const { chunkSize, tileSize: t } = MAP_TUNING;
  const left = (cx - 0.5) * chunkSize;
  const top = (cy - 0.5) * chunkSize;
  const out: Ledge[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (tiles[r]![c] !== 'v' || (c > 0 && tiles[r]![c - 1] === 'v')) continue;
      let end = c;
      while (end + 1 < N && tiles[r]![end + 1] === 'v') end++;
      out.push({ x1: left + c * t, y1: top + (r + 1) * t, x2: left + (end + 1) * t, y2: top + (r + 1) * t, nx: 0, ny: 1 });
    }
  }
  for (const [ch, nx, edge] of [['<', -1, 0], ['>', 1, 1]] as const) {
    for (let c = 0; c < N; c++) {
      for (let r = 0; r < N; r++) {
        if (tiles[r]![c] !== ch || (r > 0 && tiles[r - 1]![c] === ch)) continue;
        let end = r;
        while (end + 1 < N && tiles[end + 1]![c] === ch) end++;
        const x = left + (c + edge) * t;
        out.push({ x1: x, y1: top + r * t, x2: x, y2: top + (end + 1) * t, nx, ny: 0 });
      }
    }
  }
  return out;
}

/** Ledges a mover in the chunk holding (x, y) could touch: its chunk's own and its neighbours' near the edges. */
export function ledgesNear(world: World, x: number, y: number): readonly Ledge[] {
  if (world.arena || world.map.density <= 0) return EMPTY_LEDGES;
  const chunk = mapChunk(world, chunkOf(x), chunkOf(y));
  if (!chunk.nearLedges) {
    const { chunkSize, reach } = MAP_TUNING;
    const left = (chunk.cx - 0.5) * chunkSize - reach;
    const top = (chunk.cy - 0.5) * chunkSize - reach;
    const size = chunkSize + 2 * reach;
    const list: Ledge[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const l of mapChunk(world, chunk.cx + dx, chunk.cy + dy).ledges) {
          if (Math.max(l.x1, l.x2) >= left && Math.min(l.x1, l.x2) <= left + size && Math.max(l.y1, l.y2) >= top && Math.min(l.y1, l.y2) <= top + size) list.push(l);
        }
      }
    }
    chunk.nearLedges = list;
  }
  return chunk.nearLedges;
}
const EMPTY_LEDGES: readonly Ledge[] = [];

/** (x, y) lies beside the lip's length (its extent along the segment). */
function alongside(l: Ledge, x: number, y: number): boolean {
  return l.ny !== 0 ? x >= Math.min(l.x1, l.x2) && x <= Math.max(l.x1, l.x2) : y >= Math.min(l.y1, l.y2) && y <= Math.max(l.y1, l.y2);
}

/** Signed distance of (x, y) from the lip: positive on the side it drops to. */
function side(l: Ledge, x: number, y: number): number {
  return (x - l.x1) * l.nx + (y - l.y1) * l.ny;
}

/**
 * Speed factor for climbing (README §7.5): a mover on the ground or swimming, heading against a ledge's drop within
 * `band` px below its lip, climbs at `climbFactor`. Everything else: 1.
 */
export function ledgeFactor(world: World, x: number, y: number, dirX: number, dirY: number, flag: Traversal): number {
  if (flag === 'fly' || flag === 'levitate' || (dirX === 0 && dirY === 0)) return 1;
  const { band, climbFactor } = MAP_TUNING.ledge;
  for (const l of ledgesNear(world, x, y)) {
    const s = side(l, x, y);
    if (s >= 0 && s <= band && dirX * l.nx + dirY * l.ny < 0 && alongside(l, x, y)) return climbFactor;
  }
  return 1;
}

/** The ledge a mover went over the edge of, moving from (x0, y0) to (x1, y1) toward its drop; null if none. */
export function ledgeDropped(world: World, x0: number, y0: number, x1: number, y1: number, flag: Traversal): Ledge | null {
  if (flag === 'fly' || flag === 'levitate') return null;
  for (const l of ledgesNear(world, x1, y1)) {
    if (side(l, x0, y0) < 0 && side(l, x1, y1) >= 0 && alongside(l, x1, y1)) return l;
  }
  return null;
}

// ---- Collision -------------------------------------------------------------------------------------------------

/**
 * Moves a circle out of any obstacle it overlaps and says whether it moved. Only the part of the motion that went
 * into the obstacle is undone, so whatever moves along its edge slides round it (R4).
 */
export function pushOut(world: World, body: { x: number; y: number }, radius: number): boolean {
  let moved = false;
  for (const o of obstaclesAt(world, body.x, body.y)) {
    const dx = body.x - o.x;
    const dy = body.y - o.y;
    const min = o.radius + radius;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2);
    body.x = o.x + (d > 0 ? dx / d : 1) * min;
    body.y = o.y + (d > 0 ? dy / d : 0) * min;
    moved = true;
  }
  return moved;
}

/**
 * A free spot for something placed on the map (a site, an entrance): (x, y) moved onto dry floor (never water or
 * marsh, README §5.5), then out of any obstacle.
 */
export function clearSpot(world: World, x: number, y: number, radius: number): { x: number; y: number } {
  const spot = { x, y };
  if (!dryFloor(cellAt(world, x, y))) Object.assign(spot, nearestCell(world, x, y, dryFloor) ?? spot);
  pushOut(world, spot, radius);
  return spot;
}

/** Whether a circle touches an obstacle: shots of both sides stop there (README §7.6–§7.7). Main map only. */
export function hitsObstacle(world: World, x: number, y: number, radius: number): boolean {
  if (world.arena) return false;
  for (const o of obstaclesAt(world, x, y)) {
    const reach = o.radius + radius;
    if ((x - o.x) ** 2 + (y - o.y) ** 2 < reach * reach) return true;
  }
  return false;
}

/**
 * Whether an obstacle stands on the straight line between two points: you can't shoot across it (stuck recycling,
 * D47 amendment). shortcut: sampled every 20 px, so a line that only clips the very edge of a circle can slip past;
 * fine for obstacles 30+ px in radius, use a segment test if smaller ones arrive. With a traversal flag, deep water
 * counts too when it stops that mover (a walker's way along a shore); without one, ponds don't block (you shoot
 * across them).
 */
export function lineBlocked(world: World, x1: number, y1: number, x2: number, y2: number, radius = 0, flag?: Traversal): boolean {
  const water = flag !== undefined && waterBlocks(flag);
  const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 20);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (hitsObstacle(world, x, y, radius) || (water && cellAt(world, x, y) === CELL.water)) return true;
  }
  return false;
}

/**
 * Keeps the player and every enemy out of obstacles, after all movement and knockback this step. An enemy spawned or
 * recycled onto an obstacle is pushed clear here too. An enemy pushed while getting nowhere builds up `blockedFor`;
 * every pushed enemy records which way is out of the wall, and a wall-follower touching it keeps following.
 */
export function collideWithMap(world: World, dt: number): void {
  if (world.arena || world.map.density <= 0) return;
  const { player } = world;
  pushOut(world, player, player.radius);
  pushOutOfWater(world, player, player.radius, playerTraversal(world));
  const { progress } = MAP_TUNING.stuck;
  for (const enemy of world.enemies) {
    const flag = enemyTraversal(enemy);
    // Both always run: a mover on a shore next to a rock is pushed out of each.
    const hitRock = pushOut(world, enemy, enemy.radius);
    const pushed = pushOutOfWater(world, enemy, enemy.radius, flag) || hitRock;
    if (pushed) {
      wallNormal(world, enemy, flag);
      if (enemy.followSign !== 0) enemy.followLeft = MAP_TUNING.follow.hold;
    }
    const moved = Math.hypot(enemy.x - enemy.prevX, enemy.y - enemy.prevY);
    if (pushed && moved < progress * enemy.speed * dt) enemy.blockedFor += dt;
    else enemy.blockedFor = Math.max(0, enemy.blockedFor - dt);
    enemy.prevX = enemy.x;
    enemy.prevY = enemy.y;
  }
}

/**
 * Sum of the outward directions of every obstacle the enemy touches: between two trees it points out of the gap. A
 * shore counts as one more touch, whatever the number of water cells along it (they line up into one edge).
 */
function wallNormal(world: World, enemy: Enemy, flag: Traversal): void {
  let nx = 0;
  let ny = 0;
  let touches = 0;
  for (const o of obstaclesAt(world, enemy.x, enemy.y)) {
    const dx = enemy.x - o.x;
    const dy = enemy.y - o.y;
    const reach = o.radius + enemy.radius + 1;
    const d2 = dx * dx + dy * dy;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2) || 1;
    nx += dx / d;
    ny += dy / d;
    touches++;
  }
  if (waterBlocks(flag)) {
    const r = enemy.radius + 1;
    let wx = 0;
    let wy = 0;
    for (let gy = Math.floor((enemy.y - r) / CELL_SIZE); gy <= Math.floor((enemy.y + r) / CELL_SIZE); gy++) {
      for (let gx = Math.floor((enemy.x - r) / CELL_SIZE); gx <= Math.floor((enemy.x + r) / CELL_SIZE); gx++) {
        if (cellAtCell(world, gx, gy) !== CELL.water) continue;
        const dx = enemy.x - Math.max(gx * CELL_SIZE, Math.min(enemy.x, (gx + 1) * CELL_SIZE));
        const dy = enemy.y - Math.max(gy * CELL_SIZE, Math.min(enemy.y, (gy + 1) * CELL_SIZE));
        const d = Math.hypot(dx, dy);
        if (d > r || d === 0) continue;
        wx += dx / d;
        wy += dy / d;
      }
    }
    const w = Math.hypot(wx, wy);
    if (w > 0) {
      nx += wx / w;
      ny += wy / w;
      touches++;
    }
  }
  const n = Math.hypot(nx, ny);
  if (n === 0) return;
  enemy.wallX = nx / n;
  enemy.wallY = ny / n;
  enemy.wallTouches = touches;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
