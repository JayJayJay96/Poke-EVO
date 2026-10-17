import { ENEMIES, MOVES, POKEMON, TUNING, type EnemyId, type PokemonId } from '../data/content';
import { WAVES, type WaveKeyframe } from '../data/waves';
import type { Rng } from './rng';
import { SpatialHash } from './spatialHash';
import type { Enemy, Gem, InputState, World } from './types';

const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];
const MAX_ENEMY_RADIUS = Math.max(...Object.values(ENEMIES).map((e) => e.radius));
/** Enemies move after the hash is built, so queries look a little wider than needed. */
const HASH_MARGIN = 8;

const neighbours: number[] = [];

export interface CreateWorldOptions {
  rng: Rng;
  pokemonId?: PokemonId;
  spawnRadius?: number;
  spawnEnabled?: boolean;
}

export function createWorld({
  rng,
  pokemonId = 'charmander',
  spawnRadius = 600,
  spawnEnabled = true,
}: CreateWorldOptions): World {
  const def = POKEMON[pokemonId];
  return {
    time: 0,
    status: 'running',
    player: {
      pokemonId,
      x: 0,
      y: 0,
      radius: def.radius,
      speed: def.speed,
      hp: def.maxHp,
      maxHp: def.maxHp,
      invulnLeft: 0,
      hurtFlashLeft: 0,
      pickupRadius: TUNING.player.baseMagnetRadius,
    },
    enemies: [],
    projectiles: [],
    gems: [],
    moves: [{ moveId: def.signatureMove, cooldownLeft: 0 }],
    kills: 0,
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    nextId: 1,
    spawnEnabled,
    spawnTimer: WAVES[0]!.spawnInterval,
    spawnRadius,
    rng,
    hash: new SpatialHash(TUNING.spatialCellSize),
  };
}

/** Advances the run by one fixed step. Does nothing once the player has fainted. */
export function step(world: World, input: InputState, dt: number): void {
  if (world.status !== 'running') return;
  world.time += dt;
  tickTimers(world, dt);
  movePlayer(world, input, dt);
  if (world.spawnEnabled) updateSpawner(world, dt);
  rebuildHash(world);
  moveEnemies(world, dt);
  fireMoves(world, dt);
  updateProjectiles(world, dt);
  updateGems(world, dt);
  applyContactDamage(world);
  removeDead(world);
  if (world.status === 'running' && world.time >= TUNING.runSeconds) world.status = 'survived';
}

export interface WaveState {
  spawnInterval: number;
  hpScale: number;
  weights: WaveKeyframe['weights'];
}

/** Spawn settings at a given run time, interpolated between keyframes. */
export function waveAt(time: number): WaveState {
  let i = 0;
  while (i + 1 < WAVES.length && WAVES[i + 1]!.at <= time) i++;
  const a = WAVES[i]!;
  const b = WAVES[i + 1];
  if (!b) return { spawnInterval: a.spawnInterval, hpScale: a.hpScale, weights: a.weights };
  const t = (time - a.at) / (b.at - a.at);
  return {
    spawnInterval: lerp(a.spawnInterval, b.spawnInterval, t),
    hpScale: lerp(a.hpScale, b.hpScale, t),
    weights: a.weights,
  };
}

/** Weighted random enemy kind. */
export function pickEnemyKind(weights: WaveKeyframe['weights'], rng: Rng): EnemyId {
  let total = 0;
  for (const kind of ENEMY_IDS) total += weights[kind] ?? 0;
  if (total <= 0) throw new Error('Wave keyframe has no enemy weights');
  let roll = rng.next() * total;
  let last: EnemyId | undefined;
  for (const kind of ENEMY_IDS) {
    const weight = weights[kind] ?? 0;
    if (weight <= 0) continue;
    if (roll < weight) return kind;
    roll -= weight;
    last = kind;
  }
  return last!; // only reachable through floating-point rounding
}

export function spawnEnemy(world: World, kind: EnemyId, x: number, y: number, hpScale = 1): Enemy {
  const def = ENEMIES[kind];
  const maxHp = def.maxHp * hpScale;
  const enemy: Enemy = {
    id: world.nextId++,
    kind,
    x,
    y,
    radius: def.radius,
    speed: def.speed,
    hp: maxHp,
    maxHp,
    contactDamage: def.contactDamage,
    hitFlashLeft: 0,
  };
  world.enemies.push(enemy);
  return enemy;
}

/** Nearest living enemy within `range` of the player, or undefined. */
export function findNearestEnemy(world: World, range: number): Enemy | undefined {
  const { x, y } = world.player;
  let best: Enemy | undefined;
  let bestDist2 = range * range;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= bestDist2) {
      best = enemy;
      bestDist2 = dist2;
    }
  }
  return best;
}

function tickTimers(world: World, dt: number): void {
  const p = world.player;
  p.invulnLeft = Math.max(0, p.invulnLeft - dt);
  p.hurtFlashLeft = Math.max(0, p.hurtFlashLeft - dt);
  for (const enemy of world.enemies) {
    enemy.hitFlashLeft = Math.max(0, enemy.hitFlashLeft - dt);
  }
}

function movePlayer(world: World, input: InputState, dt: number): void {
  let mx = input.moveX;
  let my = input.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const p = world.player;
  p.x += mx * p.speed * dt;
  p.y += my * p.speed * dt;
}

function updateSpawner(world: World, dt: number): void {
  world.spawnTimer -= dt;
  while (world.spawnTimer <= 0) {
    const wave = waveAt(world.time);
    world.spawnTimer += wave.spawnInterval;
    if (world.enemies.length >= TUNING.spawn.maxEnemies) continue;
    const angle = world.rng.next() * Math.PI * 2;
    spawnEnemy(
      world,
      pickEnemyKind(wave.weights, world.rng),
      world.player.x + Math.cos(angle) * world.spawnRadius,
      world.player.y + Math.sin(angle) * world.spawnRadius,
      wave.hpScale,
    );
  }
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  const n = level - 1;
  const { base, linear, quadratic } = TUNING.xp.curve;
  return Math.round(base + linear * n + quadratic * n * n);
}

export function gainXp(world: World, amount: number): void {
  world.xp += amount;
  while (world.xp >= xpToNext(world.level)) {
    world.xp -= xpToNext(world.level);
    world.level++;
    world.pendingLevelUps++;
  }
}

export function dropGem(world: World, x: number, y: number, value: number): void {
  if (world.gems.length >= TUNING.xp.maxGems) {
    // Budget reached: fold the XP into the oldest gem instead of adding an entity.
    world.gems[0]!.value += value;
    return;
  }
  const gem: Gem = { id: world.nextId++, x, y, value, magnetized: false, collected: false };
  world.gems.push(gem);
}

function updateGems(world: World, dt: number): void {
  const { player } = world;
  const pickup2 = player.pickupRadius * player.pickupRadius;
  const collectReach = player.radius + TUNING.xp.collectPadding;
  const pull = TUNING.xp.gemPullSpeed * dt;
  for (const gem of world.gems) {
    if (gem.collected) continue;
    const dx = player.x - gem.x;
    const dy = player.y - gem.y;
    const dist2 = dx * dx + dy * dy;
    if (!gem.magnetized && dist2 <= pickup2) gem.magnetized = true;
    if (!gem.magnetized) continue;
    const dist = Math.sqrt(dist2);
    if (dist <= collectReach + pull) {
      gem.collected = true;
      gainXp(world, gem.value);
      continue;
    }
    gem.x += (dx / dist) * pull;
    gem.y += (dy / dist) * pull;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rebuildHash(world: World): void {
  world.hash.clear();
  world.enemies.forEach((enemy, index) => world.hash.insert(index, enemy.x, enemy.y));
}

function moveEnemies(world: World, dt: number): void {
  const { player, enemies, hash } = world;
  const strength = TUNING.enemy.separationStrength;
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]!;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    let vx = (dx / dist) * enemy.speed;
    let vy = (dy / dist) * enemy.speed;

    // Push apart from overlapping neighbours so the horde spreads instead of stacking.
    hash.query(enemy.x, enemy.y, enemy.radius + MAX_ENEMY_RADIUS + HASH_MARGIN, neighbours);
    for (const j of neighbours) {
      if (j === i) continue;
      const other = enemies[j]!;
      let ox = enemy.x - other.x;
      let oy = enemy.y - other.y;
      let d = Math.hypot(ox, oy);
      const minDist = enemy.radius + other.radius;
      if (d >= minDist) continue;
      if (d === 0) {
        // Exactly stacked: separate along x, direction decided by index order.
        ox = i < j ? -1 : 1;
        oy = 0;
        d = 1;
      }
      const push = (1 - d / minDist) * strength;
      vx += (ox / d) * push;
      vy += (oy / d) * push;
    }

    enemy.x += vx * dt;
    enemy.y += vy * dt;
  }
}

function fireMoves(world: World, dt: number): void {
  const { player } = world;
  for (const slot of world.moves) {
    slot.cooldownLeft = Math.max(0, slot.cooldownLeft - dt);
    if (slot.cooldownLeft > 0) continue;
    const move = MOVES[slot.moveId];
    const target = findNearestEnemy(world, move.range);
    if (!target) continue; // stays ready and fires the moment something is in range
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);
    const dirX = dist > 0 ? dx / dist : 1;
    const dirY = dist > 0 ? dy / dist : 0;
    world.projectiles.push({
      id: world.nextId++,
      moveId: move.id,
      x: player.x,
      y: player.y,
      vx: dirX * move.projectileSpeed,
      vy: dirY * move.projectileSpeed,
      radius: move.projectileRadius,
      damage: move.damage,
      lifeLeft: move.projectileLifetime,
      dead: false,
    });
    slot.cooldownLeft = move.cooldown;
  }
}

function updateProjectiles(world: World, dt: number): void {
  const { enemies, hash } = world;
  for (const proj of world.projectiles) {
    if (proj.dead) continue;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.lifeLeft -= dt;
    if (proj.lifeLeft <= 0) {
      proj.dead = true;
      continue;
    }
    hash.query(proj.x, proj.y, proj.radius + MAX_ENEMY_RADIUS + HASH_MARGIN, neighbours);
    for (const j of neighbours) {
      const enemy = enemies[j]!;
      if (enemy.hp <= 0) continue;
      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const reach = enemy.radius + proj.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      damageEnemy(world, enemy, proj.damage);
      proj.dead = true; // no pierce yet
      break;
    }
  }
}

function damageEnemy(world: World, enemy: Enemy, damage: number): void {
  if (enemy.hp <= 0) return;
  enemy.hp -= damage;
  enemy.hitFlashLeft = TUNING.enemy.hitFlashSeconds;
  if (enemy.hp <= 0) {
    world.kills++;
    dropGem(world, enemy.x, enemy.y, ENEMIES[enemy.kind].xp);
  }
}

function applyContactDamage(world: World): void {
  const { player, enemies, hash } = world;
  if (player.invulnLeft > 0) return;
  hash.query(player.x, player.y, player.radius + MAX_ENEMY_RADIUS + HASH_MARGIN, neighbours);
  for (const j of neighbours) {
    const enemy = enemies[j]!;
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const reach = enemy.radius + player.radius;
    if (dx * dx + dy * dy > reach * reach) continue;
    player.hp = Math.max(0, player.hp - enemy.contactDamage);
    player.invulnLeft = TUNING.player.invulnSeconds;
    player.hurtFlashLeft = TUNING.player.hurtFlashSeconds;
    if (player.hp <= 0) world.status = 'fainted';
    return; // one hit per invulnerability window
  }
}

/** Order-preserving in-place filter: no new array per step. */
function compact<T>(items: T[], keep: (item: T) => boolean): void {
  let write = 0;
  for (let read = 0; read < items.length; read++) {
    const item = items[read]!;
    if (keep(item)) items[write++] = item;
  }
  items.length = write;
}

function removeDead(world: World): void {
  compact(world.enemies, (e) => e.hp > 0);
  compact(world.projectiles, (p) => !p.dead);
  compact(world.gems, (g) => !g.collected);
}
