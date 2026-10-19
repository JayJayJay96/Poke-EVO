import { REROLLS_PER_RUN } from '../data/augments';
import { ABILITIES, ENEMIES, POKEMON, TUNING, type EnemyId, type PokemonId } from '../data/content';
import { MOVES, type MoveDef } from '../data/moves';
import { BOOST_IDS, type BoostId } from '../data/upgrades';
import { WAVES, type WaveKeyframe } from '../data/waves';
import {
  addCharge,
  chargedShotMult,
  chargePerParalysis,
  chargePerPx,
  onLowHpHit,
  onShellBlock,
  onShellHitTaken,
  updateAbilities,
} from './abilities';
import { enemySpeedFactor, pickWanderPoint, queryEnemies, updateStatuses } from './combat';
import { startEvolutionIfDue, upgradeSignatureByLevel } from './evolution';
import { castBeam, updateBeam } from './forms/beam';
import { castMelee } from './forms/melee';
import { castOrbit, updateOrbit } from './forms/orbit';
import { castProjectile, updateProjectiles } from './forms/projectile';
import { castZone } from './forms/zoneCast';
import { emit, healPlayer, hooksOf, mutationDamageTakenMult, mutationMoveSpeedMult } from './hooks';
import './mutationDefs';
import { gainXp, makeOffer } from './progression';
import type { Rng } from './rng';
import { SpatialHash } from './spatialHash';
import { updateSites } from './sites';
import { createSlot, emptyModifiers, refreshStats } from './stats';
import type { Enemy, InputState, MoveSlot, World } from './types';
import { updateTerrain } from './terrain';
import { updateZones } from './zones';

const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];

const neighbours: number[] = [];

export interface CreateWorldOptions {
  rng: Rng;
  pokemonId?: PokemonId;
  spawnRadius?: number;
  spawnEnabled?: boolean;
  /** Seeds Mutation Site placement (D23); the scene passes a random one. */
  mapSeed?: number;
}

export function createWorld({
  rng,
  pokemonId = 'charmander',
  spawnRadius = 600,
  spawnEnabled = true,
  mapSeed = 1,
}: CreateWorldOptions): World {
  const def = POKEMON[pokemonId];
  const firstStage = def.stages[0]!;
  const world: World = {
    time: 0,
    status: 'running',
    player: {
      pokemonId,
      stage: 0,
      ability: def.ability,
      x: 0,
      y: 0,
      radius: firstStage.radius,
      speed: firstStage.speed,
      hp: firstStage.maxHp,
      maxHp: firstStage.maxHp,
      invulnLeft: 0,
      hurtFlashLeft: 0,
      pickupRadius: TUNING.player.baseMagnetRadius,
      blockReadyLeft: 0,
      movingFor: 0,
      stillFor: 0,
      faceX: 1,
      faceY: 0,
      shellBlocks: 0,
      flareCooldownLeft: 0,
      bulb: 0,
      bloomCooldownLeft: 0,
      emergencyCooldownLeft: 0,
      charge: 0,
    },
    enemies: [],
    projectiles: [],
    projectilePool: [],
    gems: [],
    berries: [],
    zones: [],
    puddles: [],
    scorches: [],
    entities: [],
    sites: [],
    siteChunks: new Set(),
    mapSeed,
    terrainTickLeft: 0,
    swings: [],
    cuts: [],
    blasts: [],
    arcs: [],
    moves: [createSlot(firstStage.signatureMove)],
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
    evolution: null,
    signatureTierUp: null,
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
 * Does nothing once the run has ended, while level-up cards wait for a choice,
 * or while an evolution plays.
 */
export function step(world: World, input: InputState, dt: number): void {
  if (world.status !== 'running' || world.offer || world.evolution) return;
  world.time += dt;
  tickTimers(world, dt);
  movePlayer(world, input, dt);
  if (world.spawnEnabled) updateSpawner(world, dt);
  rebuildHash(world);
  moveEnemies(world, dt);
  updateStatuses(world, dt);
  updateAbilities(world, dt);
  updateMoves(world, dt);
  updateProjectiles(world, dt);
  updateZones(world, dt);
  updateTerrain(world, dt);
  updateGems(world, dt);
  pickUpBerries(world);
  applyContactDamage(world);
  removeDead(world);
  if (world.status !== 'running') return;
  upgradeSignatureByLevel(world);
  updateSites(world, dt);
  if (world.time >= TUNING.runSeconds) world.status = 'survived';
  // A captured site opens first; then evolution, whose summary card hands over to queued level-up cards.
  else if (!world.offer && !startEvolutionIfDue(world) && world.pendingLevelUps > 0) world.offer = makeOffer(world);
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
    kbX: 0,
    kbY: 0,
    burnDps: 0,
    burnLeft: 0,
    burnTickLeft: 0,
    poisonDps: 0,
    poisonLeft: 0,
    poisonTickLeft: 0,
    slow: 0,
    slowLeft: 0,
    stunLeft: 0,
    lastEffectiveness: 1,
    seedDps: 0,
    seedLeft: 0,
    seedTickLeft: 0,
    soakLeft: 0,
    stunFatigueLeft: 0,
    fatigueOnEnd: false,
    stunKind: null,
    trapLeft: 0,
    trapDamage: 0,
    seedJumps: 0,
    poisonStacks: 0,
    vulnPct: 0,
    vulnLeft: 0,
    vulnType: null,
    vulnAllPct: 0,
    vulnAllLeft: 0,
    weakenMult: 1,
    weakenLeft: 0,
    blindLeft: 0,
    wanderX: 0,
    wanderY: 0,
  };
  world.enemies.push(enemy);
  return enemy;
}

function tickTimers(world: World, dt: number): void {
  const p = world.player;
  p.invulnLeft = Math.max(0, p.invulnLeft - dt);
  p.hurtFlashLeft = Math.max(0, p.hurtFlashLeft - dt);
  if (world.mods.regenPerSec > 0) healPlayer(world, world.mods.regenPerSec * dt);
  // Solar Power's drain never takes the last HP point.
  const drain = ABILITIES[p.ability].hpDrainPerSec ?? 0;
  if (drain > 0 && p.hp > 1) p.hp = Math.max(1, p.hp - drain * dt);
  for (const enemy of world.enemies) {
    enemy.hitFlashLeft = Math.max(0, enemy.hitFlashLeft - dt);
  }
  for (const swing of world.swings) swing.lifeLeft -= dt;
  for (const cut of world.cuts) cut.lifeLeft -= dt;
  for (const blast of world.blasts) blast.lifeLeft -= dt;
  for (const arc of world.arcs) arc.lifeLeft -= dt;
  p.blockReadyLeft = Math.max(0, p.blockReadyLeft - dt);
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
  const len2 = Math.hypot(mx, my);
  if (len2 > 0) {
    p.movingFor += dt;
    p.stillFor = 0;
    p.faceX = mx / len2;
    p.faceY = my / len2;
  } else {
    p.stillFor += dt;
    p.movingFor = 0;
  }
  const speed = p.speed * mutationMoveSpeedMult(world);
  p.x += mx * speed * dt;
  p.y += my * speed * dt;
  // Pikachu's Charge fills with distance run.
  if (len2 > 0) addCharge(world, Math.min(1, len2) * speed * dt * chargePerPx(world));
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
    // Stunned enemies stay put (knockback still moves them, in updateStatuses).
    if (enemy.stunLeft > 0) continue;
    // Blinded enemies lost you: they head for their own random point instead.
    const blind = enemy.blindLeft > 0;
    if (blind && Math.hypot(enemy.wanderX - enemy.x, enemy.wanderY - enemy.y) < enemy.radius) pickWanderPoint(world, enemy);
    const dx = (blind ? enemy.wanderX : player.x) - enemy.x;
    const dy = (blind ? enemy.wanderY : player.y) - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = enemy.speed * enemySpeedFactor(enemy);
    let vx = (dx / dist) * speed;
    let vy = (dy / dist) * speed;

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
    const hooks = hooksOf(slot);
    if (hooks?.live) {
      Object.assign(slot.stats, slot.baseStats);
      hooks.live(slot.stats, world, slot);
    }
    slot.cooldownLeft = Math.max(0, slot.cooldownLeft - dt);
    // A move with no valid target stays ready and fires the moment one appears.
    if (slot.cooldownLeft <= 0) {
      // Pikachu at full Charge: the next signature cast is a Charged shot.
      const charged = slot === world.moves[0] ? chargedShotMult(world) : 1;
      slot.stats.damage *= charged;
      const cast = hooks?.cast ? hooks.cast(world, slot) : castMove(world, slot, def);
      slot.stats.damage /= charged;
      if (cast && charged > 1) world.player.charge = 0;
      if (cast) {
        slot.cooldownLeft = slot.stats.cooldown;
        hooks?.onCast?.(world, slot);
      }
    }
    // Orbits and beams act from the step they are cast.
    if (def.form === 'orbit') updateOrbit(world, slot, def, dt);
    else if (def.form === 'beam') updateBeam(world, slot, def, dt);
    hooks?.update?.(world, slot, dt);
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
    case 'zone':
      return castZone(world, slot, def);
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

/** Oran Berries heal when the player walks over them (D12). */
function pickUpBerries(world: World): void {
  const p = world.player;
  const reach = p.radius + TUNING.heal.pickupPadding;
  for (const berry of world.berries) {
    if (berry.collected) continue;
    const dx = berry.x - p.x;
    const dy = berry.y - p.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    berry.collected = true;
    healPlayer(world, TUNING.heal.berryHeal);
  }
}

/**
 * Touching enemies hurt the player, once per invulnerability window. Stunned enemies
 * don't hurt. Static stuns everything touching the player; Shell blocks one hit then recharges.
 */
function applyContactDamage(world: World): void {
  const { player, enemies } = world;
  const ability = ABILITIES[player.ability];
  queryEnemies(world, player.x, player.y, player.radius, neighbours);
  let hurt = false;
  for (const j of neighbours) {
    const enemy = enemies[j]!;
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const reach = enemy.radius + player.radius;
    if (dx * dx + dy * dy > reach * reach) continue;
    const wasStunned = enemy.stunLeft > 0;
    if (ability.contactStun) {
      enemy.stunLeft = Math.max(enemy.stunLeft, ability.contactStun);
      enemy.stunKind = 'paralysis';
      if (!wasStunned) {
        addCharge(world, chargePerParalysis(world));
        emit(world, 'staticProc', 1);
      }
    }
    if (hurt || wasStunned || player.invulnLeft > 0) continue;
    hurt = true; // one hit per step
    player.invulnLeft = TUNING.player.invulnSeconds;
    if (ability.blockEvery && player.blockReadyLeft <= 0) {
      // Shell: this hit is blocked; the shell recharges.
      player.blockReadyLeft = ability.blockEvery;
      onShellBlock(world);
      emit(world, 'shellBlock', enemy.contactDamage);
      continue;
    }
    const contact =
      enemy.contactDamage *
      (enemy.weakenLeft > 0 ? enemy.weakenMult : 1) *
      (enemy.blindLeft > 0 ? TUNING.status.blindContactMult : 1);
    const taken = contact * world.mods.damageTakenMult * mutationDamageTakenMult(world);
    const hpBefore = player.hp;
    player.hp = Math.max(0, player.hp - taken);
    onShellHitTaken(world);
    onLowHpHit(world, hpBefore);
    player.hurtFlashLeft = TUNING.player.hurtFlashSeconds;
    // Shell Armor's share of the reduction, for armorAbsorb (Lapras).
    const armor = -(ability.damageTakenPct ?? 0);
    if (armor > 0) emit(world, 'armorAbsorb', contact * armor);
    emit(world, 'hitTaken', taken, enemy);
    if (player.hp <= 0) world.status = 'fainted';
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
  compact(world.berries, (b) => !b.collected);
  compact(world.zones, (z) => z.lifeLeft > 0);
  compact(world.puddles, (t) => t.lifeLeft > 0);
  compact(world.scorches, (t) => t.lifeLeft > 0);
  compact(world.entities, (e) => e.lifeLeft > 0);
  compact(world.swings, (s) => s.lifeLeft > 0);
  compact(world.cuts, (c) => c.lifeLeft > 0);
  compact(world.blasts, (b) => b.lifeLeft > 0);
  compact(world.arcs, (a) => a.lifeLeft > 0);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
