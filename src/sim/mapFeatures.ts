import { TUNING } from '../data/content';
import { MAP_TUNING } from '../data/map';
import { dropGem, dropsOnGround } from './combat';
import { cellKey, chunkOf, mapChunk, shore } from './map';
import type { BerryTreeState, ItemBallState, MapSlot, Obstacle, World } from './types';
import { runClock, spawnEnemy, waveAt } from './world';

// Map features with state (D47, docs/map/README.md §7.8–§7.9), build step M4: berry trees you stand at to shake
// down Oran Berries, and item balls you walk over for loot (or that turn out to be a Voltorb). Only features in the
// player's chunk and its 8 neighbours tick; their state is kept by position, so it survives walking away.

const CS = MAP_TUNING.cellSize;

function keyOf(x: number, y: number): number {
  return cellKey(Math.floor(x / CS), Math.floor(y / CS));
}

export function berryTreeState(world: World, tree: Obstacle): BerryTreeState | undefined {
  return world.map.berryTrees.get(keyOf(tree.x, tree.y));
}

export function itemBallState(world: World, ball: MapSlot): ItemBallState | undefined {
  return world.map.balls.get(keyOf(ball.x, ball.y));
}

/** An Oran Berry or Magnet on the ground near (x, y), within its cap; false if the cap is full. */
function dropPickup(world: World, kind: 'oran' | 'magnet', x: number, y: number): boolean {
  const cap = kind === 'oran' ? TUNING.heal.maxBerries : TUNING.magnet.maxMagnets;
  if (dropsOnGround(world, kind) >= cap) return false;
  const expiresAt = world.time + TUNING.heal.dropLifetimeSeconds;
  world.berries.push({ id: world.nextId++, kind, ...shore(world, x, y), collected: false, expiresAt });
  return true;
}

/** README §7.8: stand in the ring while it's ripe; the harvest drops 1–2 berries, then the tree is bare a while. */
function updateBerryTree(world: World, tree: Obstacle, dt: number): void {
  const { ring, capture, drain, shake, regrow, berries, dropOut } = MAP_TUNING.berryTree;
  const key = keyOf(tree.x, tree.y);
  const { player } = world;
  const inside = (player.x - tree.x) ** 2 + (player.y - tree.y) ** 2 <= ring * ring;
  let st = world.map.berryTrees.get(key);
  if (!st) {
    if (!inside) return; // untouched trees need no state
    st = { progress: 0, bareUntil: -Infinity, shakeUntil: -Infinity };
    world.map.berryTrees.set(key, st);
  }
  const ripe = world.time >= st.bareUntil;
  st.progress = ripe && inside ? st.progress + dt : Math.max(0, st.progress - drain * dt);
  if (st.progress < capture) return;
  st.progress = 0;
  st.shakeUntil = world.time + shake;
  st.bareUntil = world.time + regrow;
  const count = berries[0] + Math.floor(world.rng.next() * (berries[1] - berries[0] + 1));
  for (let i = 0; i < count; i++) {
    const a = world.rng.next() * Math.PI * 2;
    const d = tree.radius + dropOut;
    dropPickup(world, 'oran', tree.x + Math.cos(a) * d, tree.y + Math.sin(a) * d);
  }
}

/**
 * README §7.9: the first time you come within wake range, an item ball may turn out to be a Voltorb Ambusher (from
 * 3:00, while Voltorb is in season): it wobbles, then wakes as a normal Voltorb. Otherwise walking over it gives an
 * XP cluster, an Oran Berry or a Magnet.
 */
function updateItemBall(world: World, ball: MapSlot, dt: number): void {
  const t = MAP_TUNING.itemBall;
  const key = keyOf(ball.x, ball.y);
  const { player } = world;
  const d2 = (player.x - ball.x) ** 2 + (player.y - ball.y) ** 2;
  let st = world.map.balls.get(key);
  if (!st) {
    if (d2 > t.wakeRange * t.wakeRange) return;
    st = { taken: false, rolled: false, wobbleLeft: -1 };
    world.map.balls.set(key, st);
  }
  if (st.taken) return;
  if (st.wobbleLeft >= 0) {
    st.wobbleLeft -= dt;
    if (st.wobbleLeft < 0) {
      st.taken = true;
      const wave = waveAt(runClock(world));
      const voltorb = spawnEnemy(world, 'voltorb', ball.x, ball.y, wave.hpScale);
      voltorb.contactDamage *= wave.damageScale;
      voltorb.speed *= wave.speedScale;
    }
    return;
  }
  if (!st.rolled) {
    st.rolled = true;
    const inSeason = (waveAt(runClock(world)).weights.voltorb ?? 0) > 0;
    if (runClock(world) >= t.ambusherFrom && inSeason && world.rng.next() < t.ambusherChance) {
      st.wobbleLeft = t.wobble; // the wobble is the Ambusher's only tell (R2)
      return;
    }
  }
  const reach = player.radius + t.radius;
  if (d2 > reach * reach) return;
  st.taken = true;
  const { xp, berry } = t.loot;
  const roll = world.rng.next() * (xp + berry + t.loot.magnet);
  if (roll < xp) {
    for (let i = 0; i < t.xpGems; i++) {
      const a = (i / t.xpGems) * Math.PI * 2;
      dropGem(world, ball.x + Math.cos(a) * 20, ball.y + Math.sin(a) * 20, 1);
    }
  } else dropPickup(world, roll < xp + berry ? 'oran' : 'magnet', ball.x, ball.y);
}

/** Ticks the berry trees and item balls in the player's chunk and its 8 neighbours (main map only). */
export function updateMapFeatures(world: World, dt: number): void {
  if (world.arena || world.map.density <= 0) return;
  const cx = chunkOf(world.player.x);
  const cy = chunkOf(world.player.y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const chunk = mapChunk(world, cx + dx, cy + dy);
      for (const o of chunk.own) if (o.kind === 'berryTree') updateBerryTree(world, o, dt);
      for (const ball of chunk.itemBalls) updateItemBall(world, ball, dt);
    }
  }
}
