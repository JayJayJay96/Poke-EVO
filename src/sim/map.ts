import type { ArenaEntranceKind } from '../data/arena';
import { BIOME_IDS, BIOMES, ENTRANCE_BIOME, MAP_TUNING, SET_PIECES, type BiomeId, type ObstacleKind, type SlotKind } from '../data/map';
import { createSeededRng, type Rng } from './rng';
import type { Enemy, MapChunk, MapSlot, Obstacle, World } from './types';

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
      const tiles = transformTiles(SET_PIECES[piece]!.rows, transform);
      if (tiles.some((row) => row.includes('^'))) continue;
      const placed = stamp(tiles, cx, cy, rng);
      if (start) placed.own = placed.own.filter((o) => Math.hypot(o.x, o.y) >= MAP_TUNING.startClear + o.radius);
      const circles = [...placed.own, ...placed.future];
      if (blocking(tiles, circles) > cap || !lanesOpen(tiles, circles, cx, cy)) continue;
      const own = [...placed.own, ...fillers(rng, tiles, circles, cap, def.filler, cx, cy, start)];
      return { cx, cy, biome, piece, transform, tiles, own, near: null, slots: placed.slots };
    }
  }
  throw new Error(`map: no layout fits chunk ${cx},${cy}`); // `open` always fits, so this can't happen
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

/** A free spot for something placed on the map (a site, an entrance): (x, y) moved out of any obstacle. */
export function clearSpot(world: World, x: number, y: number, radius: number): { x: number; y: number } {
  const spot = { x, y };
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
 * fine for obstacles 30+ px in radius, use a segment test if smaller ones arrive.
 */
export function lineBlocked(world: World, x1: number, y1: number, x2: number, y2: number, radius = 0): boolean {
  const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 20);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (hitsObstacle(world, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, radius)) return true;
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
  const { progress } = MAP_TUNING.stuck;
  for (const enemy of world.enemies) {
    const pushed = pushOut(world, enemy, enemy.radius);
    if (pushed) {
      wallNormal(world, enemy);
      if (enemy.followSign !== 0) enemy.followLeft = MAP_TUNING.follow.hold;
    }
    const moved = Math.hypot(enemy.x - enemy.prevX, enemy.y - enemy.prevY);
    if (pushed && moved < progress * enemy.speed * dt) enemy.blockedFor += dt;
    else enemy.blockedFor = Math.max(0, enemy.blockedFor - dt);
    enemy.prevX = enemy.x;
    enemy.prevY = enemy.y;
  }
}

/** Sum of the outward directions of every obstacle the enemy touches: between two trees it points out of the gap. */
function wallNormal(world: World, enemy: Enemy): void {
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
