import { POKEMON, TUNING, type PokemonType } from '../data/content';
import { CELL, MAP_TUNING } from '../data/map';
import { applyBurn, applyNewStun, canTrap, damageEnemy, procHit } from './combat';
import { cellKey, enemyTraversal, groundAt, patchAt } from './map';
import type { IceBridge, MapChunk, PatchState, World } from './types';

// Map reactions (D47, docs/map/README.md §7–§8), build step M3b. A player move hit landing on terrain can react:
// Fire ignites tall grass, Electric charges marsh (and shows on water), Ice freezes marsh or builds a bridge over
// water, and Fire / Ice melt / refresh a bridge. Reactions apply statuses through the normal status code with plain
// proc hits, so they never trigger hooks, Techniques or other reactions (R5), and never touch the player (R6).

const CS = MAP_TUNING.cellSize;
const CELLS = MAP_TUNING.chunkSize / CS;
const REACTIVE: ReadonlySet<PokemonType> = new Set<PokemonType>(['Fire', 'Electric', 'Ice']);

/** Whether a hit of this type can react with terrain at all (lets the hot paths skip everything else). */
export function reacts(type: PokemonType | null): type is PokemonType {
  return type !== null && REACTIVE.has(type);
}

function stateOf(world: World, key: number): PatchState {
  let st = world.map.patches.get(key);
  if (!st) {
    st = { igniteAt: -Infinity, burnDps: 0, dist: new Map(), maxDist: 0, chargedUntil: -Infinity, frozenUntil: -Infinity, readyAt: new Map() };
    world.map.patches.set(key, st);
  }
  return st;
}

/** Takes the patch's cooldown for this reaction kind; false if it's still cooling down. */
function ready(world: World, st: PatchState, kind: string, cooldown: number): boolean {
  if (world.time < (st.readyAt.get(kind) ?? -Infinity)) return false;
  st.readyAt.set(kind, world.time + cooldown);
  return true;
}

// ---- Grass fire ------------------------------------------------------------------------------------------------

/** When the last cell of a lit patch stops burning, and when the whole patch has regrown. */
function burnEnd(st: PatchState): number {
  return st.igniteAt + st.maxDist / MAP_TUNING.grass.spreadCellsPerSec + MAP_TUNING.grass.burnSeconds;
}
function regrownAt(st: PatchState): number {
  const { ashSeconds, regrowSeconds } = MAP_TUNING.grass;
  return burnEnd(st) + ashSeconds + regrowSeconds;
}

export type GrassPhase = 'grass' | 'burning' | 'ash' | 'regrow';

/** The tall-grass state at (x, y) (README §7.1), or null when it isn't tall grass. */
export function grassPhase(world: World, x: number, y: number): GrassPhase | null {
  if (groundAt(world, x, y) !== CELL.grass) return null;
  const { key, index } = patchAt(world, x, y);
  const st = world.map.patches.get(key);
  const d = st?.dist.get(index);
  if (!st || d === undefined) return 'grass';
  const { spreadCellsPerSec, burnSeconds, ashSeconds, regrowSeconds } = MAP_TUNING.grass;
  const t = world.time - (st.igniteAt + d / spreadCellsPerSec);
  if (t < 0) return 'grass';
  if (t < burnSeconds) return 'burning';
  if (t < burnSeconds + ashSeconds) return 'ash';
  return t < burnSeconds + ashSeconds + regrowSeconds ? 'regrow' : 'grass';
}

/** A Grass-type player standing in living tall grass rests sooner (README §7.1). */
export function restsInGrass(world: World): boolean {
  const { player } = world;
  const types = POKEMON[player.pokemonId].stages[player.stage]!.types;
  return types.includes('Grass') && grassPhase(world, player.x, player.y) === 'grass';
}

function ignite(world: World, st: PatchState, chunk: MapChunk, index: number, damage: number): void {
  // A lit patch can't take fire again until it has burnt out and regrown; at most `maxBurning` burn at once.
  if (st.igniteAt > -Infinity && world.time < regrownAt(st)) return;
  let burning = 0;
  for (const other of world.map.patches.values()) if (world.time < burnEnd(other)) burning++;
  if (burning >= MAP_TUNING.grass.maxBurning || !ready(world, st, 'ignite', MAP_TUNING.reactionCooldown)) return;
  // Spread distance of every cell of the patch from where the fire landed (breadth-first, 4-connected).
  const label = chunk.patches![index]!;
  st.dist.clear();
  st.dist.set(index, 0);
  const queue = [index];
  let maxDist = 0;
  for (let q = 0; q < queue.length; q++) {
    const cell = queue[q]!;
    const d = st.dist.get(cell)!;
    maxDist = Math.max(maxDist, d);
    const i = Math.floor(cell / CELLS);
    const j = cell % CELLS;
    for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const) {
      if (ni < 0 || nj < 0 || ni >= CELLS || nj >= CELLS) continue;
      const n = ni * CELLS + nj;
      if (chunk.patches![n] === label && !st.dist.has(n)) {
        st.dist.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  st.igniteAt = world.time;
  st.maxDist = maxDist;
  st.burnDps = damage * MAP_TUNING.grass.burnFraction;
  world.map.activeUntil = Math.max(world.map.activeUntil, burnEnd(st));
}

// ---- Marsh -----------------------------------------------------------------------------------------------------

/** Electric on marsh (README §7.4): every grounded enemy in the patch is paralysed and takes a share of the hit. */
function chargeMarsh(world: World, st: PatchState, key: number, damage: number): void {
  const { paralyse, damageFraction, cooldown, shows } = MAP_TUNING.marsh.charge;
  if (!ready(world, st, 'charge', cooldown)) return;
  st.chargedUntil = world.time + shows;
  const hit = procHit('Electric');
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0 || enemyTraversal(enemy) !== 'ground' || patchAt(world, enemy.x, enemy.y).key !== key) continue;
    applyNewStun(enemy, paralyse, 'paralysis');
    damageEnemy(world, enemy, damage * damageFraction, hit);
  }
}

function freezeMarsh(world: World, st: PatchState): void {
  if (!ready(world, st, 'freeze', MAP_TUNING.reactionCooldown)) return;
  st.frozenUntil = world.time + MAP_TUNING.marsh.freeze.seconds;
  world.map.activeUntil = Math.max(world.map.activeUntil, st.frozenUntil);
}

// ---- Water and ice bridges -------------------------------------------------------------------------------------

/**
 * Ice on deep water (README §7.3): a strip along the hit's direction, `cells` long while it stays over water, plus
 * one cell to its side. Over the cap, the oldest bridge melts first.
 */
function buildBridge(world: World, st: PatchState, x: number, y: number, dirX: number, dirY: number): void {
  const { cells: length, width, seconds, crack, max } = MAP_TUNING.iceBridge;
  if (!ready(world, st, 'bridge', MAP_TUNING.reactionCooldown)) return;
  const cells = new Set<number>();
  for (let k = 0; k < length; k++) {
    const px = x + dirX * k * CS;
    const py = y + dirY * k * CS;
    if (groundAt(world, px, py) !== CELL.water) break;
    for (let w = 0; w < width; w++) {
      const sx = px - dirY * w * CS;
      const sy = py + dirX * w * CS;
      if (groundAt(world, sx, sy) === CELL.water) cells.add(cellKey(Math.floor(sx / CS), Math.floor(sy / CS)));
    }
  }
  if (cells.size === 0) return;
  if (world.map.bridges.length >= max) melt(world, world.map.bridges.shift()!);
  world.map.bridges.push({ cells, frozenLeft: seconds, crackLeft: crack });
}

/** A bridge turns back into water: grounded enemies on it are stunned (the shore push happens in collision). */
function melt(world: World, bridge: IceBridge): void {
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0 || enemyTraversal(enemy) === 'fly') continue;
    if (bridge.cells.has(cellKey(Math.floor(enemy.x / CS), Math.floor(enemy.y / CS)))) applyNewStun(enemy, MAP_TUNING.iceBridge.pushStun);
  }
}

// ---- Entry points ----------------------------------------------------------------------------------------------

/**
 * A player move hit of `type` lands at (x, y) for `damage` (README §8.1 trigger points call this). (dirX, dirY) is the
 * hit's heading, used to lay an ice bridge; zero means "away from the player". Returns whether it landed on a feature
 * (grass, marsh, water or a bridge), reacting or not: what the per-hit trigger caps count.
 */
export function reactAt(world: World, x: number, y: number, type: PokemonType | null, damage: number, dirX = 0, dirY = 0): boolean {
  if (!reacts(type) || world.arena || world.map.density <= 0) return false;
  const bridge = world.map.bridges.find((b) => b.cells.has(cellKey(Math.floor(x / CS), Math.floor(y / CS))));
  if (bridge) {
    // Fire cracks a bridge at once; Ice refreshes it.
    if (type === 'Fire' && bridge.frozenLeft > 0) bridge.frozenLeft = 0;
    else if (type === 'Ice') {
      bridge.frozenLeft = MAP_TUNING.iceBridge.seconds;
      bridge.crackLeft = MAP_TUNING.iceBridge.crack;
    }
    return true;
  }
  const ground = groundAt(world, x, y);
  if (ground === CELL.open) return false;
  const { key, index, chunk } = patchAt(world, x, y);
  const st = stateOf(world, key);
  if (ground === CELL.grass) {
    if (type === 'Fire') ignite(world, st, chunk!, index, damage);
  } else if (ground === CELL.slow) {
    if (type === 'Electric') chargeMarsh(world, st, key, damage);
    else if (type === 'Ice') freezeMarsh(world, st);
  } else if (type === 'Electric') {
    // Charged water only shows for now: it matters for swimming enemies, and none exist yet (README §7.2).
    if (ready(world, st, 'waterCharge', MAP_TUNING.reactionCooldown)) st.chargedUntil = world.time + MAP_TUNING.waterCharge.seconds;
  } else if (type === 'Ice') {
    let dx = dirX;
    let dy = dirY;
    if (dx === 0 && dy === 0) {
      dx = x - world.player.x;
      dy = y - world.player.y;
    }
    const len = Math.hypot(dx, dy);
    if (len === 0) buildBridge(world, st, x, y, 1, 0);
    else buildBridge(world, st, x, y, dx / len, dy / len);
  }
  return true;
}

/** An area hit (a zone, README §8.1): its centre, then up to `zoneCells` more cells inside its radius. */
export function reactArea(world: World, x: number, y: number, radius: number, type: PokemonType | null, damage: number): void {
  if (!reacts(type) || world.arena || world.map.density <= 0) return;
  reactAt(world, x, y, type, damage);
  let left = MAP_TUNING.trigger.zoneCells;
  for (let cy = Math.floor((y - radius) / CS); cy <= Math.floor((y + radius) / CS) && left > 0; cy++) {
    for (let cx = Math.floor((x - radius) / CS); cx <= Math.floor((x + radius) / CS) && left > 0; cx++) {
      const px = (cx + 0.5) * CS;
      const py = (cy + 0.5) * CS;
      if ((px - x) ** 2 + (py - y) ** 2 > radius * radius || groundAt(world, px, py) === CELL.open) continue;
      reactAt(world, px, py, type, damage);
      left--;
    }
  }
}

/** A line hit (a beam, README §8.1): sample points every 50 px from (x, y) along (dirX, dirY), at most `beamSamples`. */
export function reactLine(world: World, x: number, y: number, dirX: number, dirY: number, length: number, type: PokemonType | null, damage: number): void {
  if (!reacts(type)) return;
  const n = Math.min(MAP_TUNING.trigger.beamSamples, Math.floor(length / CS));
  for (let k = 1; k <= n; k++) reactAt(world, x + dirX * k * CS, y + dirY * k * CS, type, damage, dirX, dirY);
}

/**
 * Ice bridges thaw; burning grass Burns the enemies in it and frozen marsh makes grounded enemies slip, on the 0.25 s
 * status cadence. The effect pass is skipped while nothing burns or is frozen.
 */
export function updateMapReactions(world: World, dt: number): void {
  if (world.arena) return;
  const { bridges } = world.map;
  for (let i = bridges.length - 1; i >= 0; i--) {
    const b = bridges[i]!;
    if (b.frozenLeft > 0) b.frozenLeft -= dt;
    else if ((b.crackLeft -= dt) <= 0) {
      melt(world, b);
      bridges.splice(i, 1);
    }
  }
  if (world.time >= world.map.activeUntil) return;
  world.map.tickLeft -= dt;
  if (world.map.tickLeft > 0) return;
  const tick = TUNING.status.burnTick;
  world.map.tickLeft += tick;
  const { slipPerSec, slipStun } = MAP_TUNING.marsh.freeze;
  const slipChance = 1 - Math.pow(1 - slipPerSec, tick);
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const ground = groundAt(world, enemy.x, enemy.y);
    if (ground === CELL.grass) {
      if (grassPhase(world, enemy.x, enemy.y) !== 'burning') continue;
      const st = world.map.patches.get(patchAt(world, enemy.x, enemy.y).key)!;
      applyBurn(enemy, st.burnDps * (enemyTraversal(enemy) === 'fly' ? MAP_TUNING.grass.flyerBurnMult : 1));
    } else if (ground === CELL.slow && enemyTraversal(enemy) === 'ground' && marshFrozen(world, enemy.x, enemy.y)) {
      if (canTrap(enemy) && world.rng.next() < slipChance) applyNewStun(enemy, slipStun);
    }
  }
}

/** Whether the marsh at (x, y) is frozen (no slow while it lasts). */
export function marshFrozen(world: World, x: number, y: number): boolean {
  if (world.time >= world.map.activeUntil) return false;
  const st = world.map.patches.get(patchAt(world, x, y).key);
  return st !== undefined && world.time < st.frozenUntil;
}

/** Whether the marsh or water patch at (x, y) shows its Electric charge right now (drawing only). */
export function patchCharged(world: World, x: number, y: number): boolean {
  if (world.map.patches.size === 0) return false;
  const st = world.map.patches.get(patchAt(world, x, y).key);
  return st !== undefined && world.time < st.chargedUntil;
}
