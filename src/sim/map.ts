import { MAP_TUNING, type ObstacleKind } from '../data/map';
import { createSeededRng } from './rng';
import type { Obstacle, World } from './types';

// Main-map obstacles (D47, docs/map/README.md, build step M1). Boulders and trees are circles scattered per chunk
// from the map seed. Every obstacle keeps `gap` px of free ground to every other one and `gap / 2` to its chunk's
// edges, so no lane can close (R1) and a mover narrower than `gap / 2` only ever touches its own chunk's obstacles:
// a lookup is one chunk's short list, no spatial hash needed. Arenas sit on the same coordinates, so the map is
// switched off while a fight runs.

const EMPTY: readonly Obstacle[] = [];

/** Chunk index for a world coordinate; chunk (0, 0) is centred on the start (same chunks as sites). */
export function chunkOf(v: number): number {
  return Math.floor(v / MAP_TUNING.chunkSize + 0.5);
}

/** Numeric chunk key, so lookups in the hot path build no strings; unique within ±32k chunks. */
export function chunkKey(cx: number, cy: number): number {
  return (cx + 32768) * 65536 + (cy + 32768);
}

/** One chunk's obstacles: the same seed, chunk and density always give the same layout. */
export function generateObstacles(mapSeed: number, cx: number, cy: number, density: number): Obstacle[] {
  const rng = createSeededRng((Math.imul(cx, 83492791) ^ Math.imul(cy, 50331653) ^ mapSeed ^ 0x2f6b4e1d) >>> 0);
  const { chunkSize, gap, startClear, boulderShare, radius } = MAP_TUNING;
  const nearStart = Math.abs(cx) <= 1 && Math.abs(cy) <= 1;
  const tries = Math.round((nearStart ? MAP_TUNING.startPerChunk : MAP_TUNING.perChunk) * density);
  const left = (cx - 0.5) * chunkSize;
  const top = (cy - 0.5) * chunkSize;
  const list: Obstacle[] = [];
  for (let i = 0; i < tries; i++) {
    const kind: ObstacleKind = rng.next() < boulderShare ? 'boulder' : 'tree';
    const [lo, hi] = radius[kind];
    const r = lo + rng.next() * (hi - lo);
    const margin = r + gap / 2;
    const x = left + margin + rng.next() * (chunkSize - 2 * margin);
    const y = top + margin + rng.next() * (chunkSize - 2 * margin);
    if (Math.hypot(x, y) < startClear + r) continue;
    if (list.some((o) => Math.hypot(o.x - x, o.y - y) < o.radius + r + gap)) continue;
    list.push({ x, y, radius: r, kind });
  }
  return list;
}

/** The obstacles of the chunk holding (x, y), generated the first time anything asks. */
export function obstaclesAt(world: World, x: number, y: number): readonly Obstacle[] {
  const { map } = world;
  if (map.density <= 0) return EMPTY;
  const cx = chunkOf(x);
  const cy = chunkOf(y);
  const key = chunkKey(cx, cy);
  let list = map.chunks.get(key);
  if (!list) {
    list = generateObstacles(world.mapSeed, cx, cy, map.density);
    map.chunks.set(key, list);
  }
  return list;
}

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
 * Keeps the player and every enemy out of obstacles, after all movement and knockback this step. An enemy spawned or
 * recycled onto an obstacle is pushed clear here too. Enemies pressed against one build up `blockedFor`.
 */
export function collideWithMap(world: World, dt: number): void {
  if (world.arena || world.map.density <= 0) return;
  const { player } = world;
  pushOut(world, player, player.radius);
  for (const enemy of world.enemies) {
    if (pushOut(world, enemy, enemy.radius)) enemy.blockedFor += dt;
    else enemy.blockedFor = Math.max(0, enemy.blockedFor - dt);
  }
}
