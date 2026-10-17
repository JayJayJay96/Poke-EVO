import { REROLLS_PER_RUN } from '../data/augments';
import { ENEMIES, POKEMON, TUNING, type EnemyId, type PokemonId } from '../data/content';
import { MOVES, type MoveDef } from '../data/moves';
import { BOOST_IDS, type BoostId } from '../data/upgrades';
import { WAVES, type WaveKeyframe } from '../data/waves';
import { queryEnemies } from './combat';
import { castBeam, updateBeam } from './forms/beam';
import { castMelee } from './forms/melee';
import { castOrbit, updateOrbit } from './forms/orbit';
import { castProjectile, updateProjectiles } from './forms/projectile';
import { gainXp, makeOffer } from './progression';
import type { Rng } from './rng';
import { SpatialHash } from './spatialHash';
import { createSlot, emptyModifiers, refreshStats } from './stats';
import type { Enemy, InputState, MoveSlot, World } from './types';

const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];

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
  const world: World = {
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
    projectilePool: [],
    gems: [],
    swings: [],
    moves: [createSlot(def.signatureMove)],
    boosts: Object.fromEntries(BOOST_IDS.map((id) => [id, 0])) as Record<BoostId, number>,
    items: [],
    bigBoosts: 0,
    rerollsLeft: REROLLS_PER_RUN,
    mods: emptyModifiers(),
    kills: 0,
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    offer: null,
    nextId: 1,
    spawnEnabled,
    spawnTimer: WAVES[0]!.spawnInterval,
    spawnRadius,
    rng,
    hash: new SpatialHash(TUNING.spatialCellSize),
  };
  refreshStats(world);
  return world;
}

/**
 * Advances the run by one fixed step.
 * Does nothing once the run has ended or while level-up cards wait for a choice.
 */
export function step(world: World, input: InputState, dt: number): void {
  if (world.status !== 'running' || world.offer) return;
  world.time += dt;
  tickTimers(world, dt);
  movePlayer(world, input, dt);
  if (world.spawnEnabled) updateSpawner(world, dt);
  rebuildHash(world);
  moveEnemies(world, dt);
  updateMoves(world, dt);
  updateProjectiles(world, dt);
  updateGems(world, dt);
  applyContactDamage(world);
  removeDead(world);
  if (world.status !== 'running') return;
  if (world.time >= TUNING.runSeconds) world.status = 'survived';
  else if (world.pendingLevelUps > 0) world.offer = makeOffer(world);
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

function tickTimers(world: World, dt: number): void {
  const p = world.player;
  p.invulnLeft = Math.max(0, p.invulnLeft - dt);
  p.hurtFlashLeft = Math.max(0, p.hurtFlashLeft - dt);
  if (world.mods.regenPerSec > 0) p.hp = Math.min(p.maxHp, p.hp + world.mods.regenPerSec * dt);
  for (const enemy of world.enemies) {
    enemy.hitFlashLeft = Math.max(0, enemy.hitFlashLeft - dt);
  }
  for (const swing of world.swings) swing.lifeLeft -= dt;
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

function rebuildHash(world: World): void {
  world.hash.clear();
  world.enemies.forEach((enemy, index) => world.hash.insert(index, enemy.x, enemy.y));
}

function moveEnemies(world: World, dt: number): void {
  const { player, enemies } = world;
  const strength = TUNING.enemy.separationStrength;
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]!;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    let vx = (dx / dist) * enemy.speed;
    let vy = (dy / dist) * enemy.speed;

    // Push apart from overlapping neighbours so the horde spreads instead of stacking.
    queryEnemies(world, enemy.x, enemy.y, enemy.radius, neighbours);
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

function updateMoves(world: World, dt: number): void {
  for (const slot of world.moves) {
    const def = MOVES[slot.moveId];
    slot.cooldownLeft = Math.max(0, slot.cooldownLeft - dt);
    // A move with no valid target stays ready and fires the moment one appears.
    if (slot.cooldownLeft <= 0 && castMove(world, slot, def)) slot.cooldownLeft = slot.stats.cooldown;
    // Orbits and beams act from the step they are cast.
    if (def.form === 'orbit') updateOrbit(world, slot, def, dt);
    else if (def.form === 'beam') updateBeam(world, slot, def, dt);
  }
}

function castMove(world: World, slot: MoveSlot, def: MoveDef): boolean {
  switch (def.form) {
    case 'projectile':
      return castProjectile(world, slot, def);
    case 'melee':
      return castMelee(world, slot, def);
    case 'orbit':
      return castOrbit(world, slot, def);
    case 'beam':
      return castBeam(world, slot, def);
  }
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

function applyContactDamage(world: World): void {
  const { player, enemies } = world;
  if (player.invulnLeft > 0) return;
  queryEnemies(world, player.x, player.y, player.radius, neighbours);
  for (const j of neighbours) {
    const enemy = enemies[j]!;
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const reach = enemy.radius + player.radius;
    if (dx * dx + dy * dy > reach * reach) continue;
    player.hp = Math.max(0, player.hp - enemy.contactDamage * world.mods.damageTakenMult);
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
  compact(world.projectiles, (p) => {
    if (p.dead) world.projectilePool.push(p);
    return !p.dead;
  });
  compact(world.gems, (g) => !g.collected);
  compact(world.swings, (s) => s.lifeLeft > 0);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
