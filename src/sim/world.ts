import { ZAPDOS_KIT } from '../data/arena';
import { CONTACT_STATUS, ENEMY_ATTACKS, PHASERS } from '../data/enemyAttacks';
import { ABILITY_TUNING, HORDE } from '../data/hordes';
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
import { arenaSchedule, resolveArena, updateArena } from './arena';
import { comboCooldown } from './combo';
import { startEvolutionIfDue, upgradeSignatureByLevel } from './evolution';
import { castBeam, updateBeam } from './forms/beam';
import { castMelee } from './forms/melee';
import { castOrbit, updateOrbit } from './forms/orbit';
import { castProjectile, updateProjectiles } from './forms/projectile';
import { castZone } from './forms/zoneCast';
import { emit, healPlayer, hooksOf, mutationDamageTakenMult, mutationMoveSpeedMult } from './hooks';
import './mutationDefs';
import { attackContactMult, attackVelocity, updateEnemyAttacks, webSlow } from './enemyAttacks';
import { eliteAbility, eliteContactMult, nextSpawnAngle, spawnRateMult, updateHordes } from './hordes';
import { applyPlayerStatus, emptyPlayerStatus, playerStatusSlow, updatePlayerStatus } from './playerStatus';
import { gainXp, makeOffer } from './progression';
import type { Rng } from './rng';
import { SpatialHash } from './spatialHash';
import { updateSites } from './sites';
import { createSlot, emptyModifiers, refreshStats } from './stats';
import {
  cooldownRate,
  emptyTechniqueState,
  endureSaves,
  onGemCollected,
  onPlayerHit,
  rolloutMult,
  updateTechniques,
} from './techniques';
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
    arenaSeconds: 0,
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
      calmFor: 0,
      stillFor: 0,
      faceX: 1,
      vx: 0,
      vy: 0,
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
    arenaSchedule: arenaSchedule(mapSeed),
    arenaEventsDone: 0,
    arenaBossesUsed: [],
    entrance: null,
    arena: null,
    arenaNotice: null,
    terrainTickLeft: 0,
    swings: [],
    cuts: [],
    blasts: [],
    arcs: [],
    moves: [createSlot(firstStage.signatureMove)],
    combo: [],
    boosts: Object.fromEntries(BOOST_IDS.map((id) => [id, 0])) as Record<BoostId, number>,
    techniques: [],
    tech: emptyTechniqueState(),
    items: [],
    bigBoosts: 0,
    surgeLeft: 0,
    rerollsLeft: REROLLS_PER_RUN,
    mods: emptyModifiers(),
    kills: 0,
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    levelUpWait: 0,
    openLevelUps: false,
    offer: null,
    evolution: null,
    signatureTierUp: null,
    nextId: 1,
    spawnEnabled,
    spawnTimer: WAVES[0]!.spawnInterval,
    spawnRadius,
    packAngle: 0,
    packLeft: 0,
    lullLeft: 0,
    nextHordeAt: HORDE.firstAt,
    hordeWarning: null,
    hordes: [],
    enemyShots: [],
    webs: [],
    delayedBlasts: [],
    playerStatus: emptyPlayerStatus(),
    rng,
    hash: new SpatialHash(TUNING.spatialCellSize),
  };
  refreshStats(world);
  return world;
}

/**
 * The run clock: time on the main map only. Arena fights don't count (owner 2026-10-23), so the run's end, the
 * wave ramp and the arena schedule follow it; `world.time` keeps running for every timer inside a fight.
 */
export function runClock(world: World): number {
  return world.time - world.arenaSeconds;
}

/**
 * Advances the run by one fixed step.
 * Does nothing once the run has ended, while level-up cards wait for a choice,
 * or while an evolution plays.
 */
export function step(world: World, input: InputState, dt: number): void {
  if (world.status !== 'running' || world.offer || world.evolution) return;
  world.time += dt;
  if (world.arena) world.arenaSeconds += dt;
  tickTimers(world, dt);
  updatePlayerStatus(world, dt);
  movePlayer(world, input, dt);
  updateArena(world, dt);
  // The arena is a closed fight: no horde spawns and no sites while it runs (D28).
  if (world.spawnEnabled && !world.arena) updateSpawner(world, dt);
  rebuildHash(world);
  moveEnemies(world, dt);
  updateEnemyAttacks(world, dt);
  updateStatuses(world, dt);
  updateAbilities(world, dt);
  updateTechniques(world, dt);
  updateMoves(world, dt);
  updateProjectiles(world, dt);
  updateZones(world, dt);
  updateTerrain(world, dt);
  updateGems(world, dt);
  pickUpBerries(world);
  applyContactDamage(world);
  removeDead(world);
  if (world.status !== 'running') return;
  resolveArena(world);
  upgradeSignatureByLevel(world);
  if (!world.arena) updateSites(world, dt);
  if (runClock(world) >= TUNING.runSeconds) world.status = 'survived';
  // A captured site opens first; then evolution (never mid arena fight), whose summary card hands over to
  // the banked level-ups; otherwise the bank decides.
  else if (!world.offer && (world.arena || !startEvolutionIfDue(world))) updateLevelBank(world, dt);
}

/**
 * Banked level-ups (owner 2026-10-23): they open when the player asks, or on their own once enough are banked or
 * the bank has waited long enough. Never on their own during an arena fight. Opening resolves the whole bank.
 */
function updateLevelBank(world: World, dt: number): void {
  const { autoOpenAt, autoOpenSeconds } = TUNING.levelUpBank;
  world.levelUpWait = world.pendingLevelUps > 0 ? world.levelUpWait + dt : 0;
  const auto = !world.arena && (world.pendingLevelUps >= autoOpenAt || world.levelUpWait >= autoOpenSeconds);
  if (world.pendingLevelUps > 0 && (world.openLevelUps || auto)) {
    world.offer = makeOffer(world);
    world.levelUpWait = 0;
  }
  world.openLevelUps = false;
}

export interface WaveState {
  spawnInterval: number;
  hpScale: number;
  damageScale: number;
  speedScale: number;
  weights: WaveKeyframe['weights'];
}

/** Spawn settings at a given run time, interpolated between keyframes. */
export function waveAt(time: number): WaveState {
  let i = 0;
  while (i + 1 < WAVES.length && WAVES[i + 1]!.at <= time) i++;
  const a = WAVES[i]!;
  const b = WAVES[i + 1];
  if (!b) {
    const { spawnInterval, hpScale, damageScale, speedScale, weights } = a;
    return { spawnInterval, hpScale, damageScale, speedScale, weights };
  }
  const t = (time - a.at) / (b.at - a.at);
  return {
    spawnInterval: lerp(a.spawnInterval, b.spawnInterval, t),
    hpScale: lerp(a.hpScale, b.hpScale, t),
    damageScale: lerp(a.damageScale, b.damageScale, t),
    speedScale: lerp(a.speedScale, b.speedScale, t),
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
    elite: false,
    hordeId: 0,
    fleeTo: 0,
    fleeLeft: 0,
    abilityUsed: false,
    rageLeft: 0,
    // Telegraphed attackers start half-way through their cooldown (D35).
    atkCooldown: (ENEMY_ATTACKS[kind]?.cooldown ?? 0) / 2,
    atkPhase: null,
    atkTimer: 0,
    aimX: 0,
    aimY: 0,
    dashLeft: 0,
    markX: 0,
    markY: 0,
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
  if (world.surgeLeft > 0) {
    world.surgeLeft = Math.max(0, world.surgeLeft - dt);
    if (world.surgeLeft === 0) refreshStats(world); // the site surge wears off (D25)
  }
  if (world.mods.regenPerSec > 0) healPlayer(world, world.mods.regenPerSec * dt);
  // Rest regen (D43): out of combat long enough, a share of max HP comes back.
  p.calmFor += dt;
  const rest = TUNING.restRegen;
  if (p.calmFor >= rest.afterSeconds && p.hp > 0 && p.hp < p.maxHp) healPlayer(world, p.maxHp * rest.maxHpPctPerSec * dt);
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
  // Snorlax's Yawn cloud slows the player (D28, B2).
  // Slows don't stack: the strongest of a boss's (Yawn) and the player's statuses (D36) wins.
  const slow = Math.max(world.arena?.playerSlow ?? 0, playerStatusSlow(world), webSlow(world));
  const speed = p.speed * mutationMoveSpeedMult(world) * (1 - slow);
  p.vx = mx * speed;
  p.vy = my * speed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  // Pikachu's Charge fills with distance run.
  if (len2 > 0) addCharge(world, Math.min(1, len2) * speed * dt * chargePerPx(world));
}

/**
 * Enemies left far behind reappear on the spawn ring ahead of the player, keeping HP and statuses,
 * so they don't sit out of play and fill the enemy cap (owner 2026-10-21).
 */
function recycleStragglers(world: World): void {
  const { player } = world;
  const limit = world.spawnRadius * TUNING.spawn.recycleFactor;
  const facing = Math.atan2(player.faceY, player.faceX);
  for (const enemy of world.enemies) {
    // A fleeing pack is meant to run off for a while (D34).
    if (enemy.fleeTo > 0 || enemy.fleeLeft > 0) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    if (dx * dx + dy * dy <= limit * limit) continue;
    const angle = facing + (world.rng.next() - 0.5) * TUNING.spawn.recycleSpread;
    enemy.x = player.x + Math.cos(angle) * world.spawnRadius;
    enemy.y = player.y + Math.sin(angle) * world.spawnRadius;
    enemy.kbX = 0;
    enemy.kbY = 0;
  }
}

function updateSpawner(world: World, dt: number): void {
  recycleStragglers(world);
  updateHordes(world, dt);
  // Pressure cycle (D34): build-up, surge, lull; packs from one side except in a surge.
  world.spawnTimer -= dt * spawnRateMult(world);
  while (world.spawnTimer <= 0) {
    const wave = waveAt(runClock(world));
    world.spawnTimer += wave.spawnInterval;
    if (world.enemies.length >= TUNING.spawn.maxEnemies) continue;
    const angle = nextSpawnAngle(world);
    const enemy = spawnEnemy(
      world,
      pickEnemyKind(wave.weights, world.rng),
      world.player.x + Math.cos(angle) * world.spawnRadius,
      world.player.y + Math.sin(angle) * world.spawnRadius,
      wave.hpScale,
    );
    enemy.contactDamage *= wave.damageScale;
    enemy.speed *= wave.speedScale;
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
    // An arena boss may head for something else (Snorlax going for a berry, D28).
    const goal = world.arena?.bossEnemyId === enemy.id ? world.arena.goal : null;
    let dx = (goal ? goal.x : blind ? enemy.wanderX : player.x) - enemy.x;
    let dy = (goal ? goal.y : blind ? enemy.wanderY : player.y) - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Fleeing (D34): a pack whose leader fell runs until it's far enough; Run Away sprints off for a while.
    enemy.rageLeft = Math.max(0, enemy.rageLeft - dt);
    enemy.fleeLeft = Math.max(0, enemy.fleeLeft - dt);
    if (enemy.fleeTo > 0 && dist >= enemy.fleeTo) enemy.fleeTo = 0;
    const fleeing = enemy.fleeTo > 0 || enemy.fleeLeft > 0;
    // Telegraphed attacks (D35): still while winding up, along the locked line while charging, ranged keep away.
    const attack = goal || blind ? null : attackVelocity(enemy, dx / dist, dy / dist, dist, enemy.speed * enemySpeedFactor(enemy), dt);
    if (fleeing) {
      dx = -dx;
      dy = -dy;
    }
    // Run Away sprints; Swift Swim (Elite Psyduck, D37) is fast in a puddle.
    const swim = eliteAbility(enemy) === 'swiftSwim' && world.puddles.some((p) => (p.x - enemy.x) ** 2 + (p.y - enemy.y) ** 2 <= p.radius ** 2);
    const sprint = (enemy.fleeLeft > 0 ? ABILITY_TUNING.runAway.speedMult : 1) * (swim ? ABILITY_TUNING.swiftSwim.speedMult : 1);
    const speed = enemy.speed * enemySpeedFactor(enemy) * sprint;
    let vx = attack && !fleeing ? attack.vx : (dx / dist) * speed;
    let vy = attack && !fleeing ? attack.vy : (dy / dist) * speed;

    // Push apart from overlapping neighbours so the horde spreads instead of stacking. Phasers drift through (D37).
    if (PHASERS.has(enemy.kind)) neighbours.length = 0;
    else queryEnemies(world, enemy.x, enemy.y, enemy.radius, neighbours);
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
  const { combo } = world;
  // Pressure (Zapdos's ability, D32): cooldowns run slower during its fight.
  const pressure = world.arena?.zap && world.arena.engaged ? 1 + ZAPDOS_KIT.pressure : 1;
  const rate = cooldownRate(world);
  for (let i = 0; i < world.moves.length; i++) {
    const slot = world.moves[i]!;
    const def = MOVES[slot.moveId];
    const hooks = hooksOf(slot);
    if (hooks?.live) {
      Object.assign(slot.stats, slot.baseStats);
      hooks.live(slot.stats, world, slot);
    }
    slot.cooldownLeft = Math.max(0, slot.cooldownLeft - (dt * rate) / pressure);
    // Combo members (D28) don't fire on their own: they fire with the base on its shared cooldown.
    const member = combo.indexOf(i) > 0;
    // A move with no valid target stays ready and fires the moment one appears.
    if (!member && slot.cooldownLeft <= 0) {
      if (combo[0] === i) {
        const fired = combo.filter((j) => fire(world, world.moves[j]!));
        if (fired.length > 0) {
          slot.cooldownLeft = comboCooldown(world);
          for (const j of fired) hooksOf(world.moves[j]!)?.onCast?.(world, world.moves[j]!);
        }
      } else if (fire(world, slot)) {
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

/** Casts one move now (its onCast hook is left to the caller); true if it found a target. */
function fire(world: World, slot: MoveSlot): boolean {
  const hooks = hooksOf(slot);
  // Volatility: a new damage roll per cast. shortcut: shots still in flight from the last cast use the new
  // roll too; store it per projectile if that ever reads wrong.
  const { volatileMin, volatileMax } = slot.stats;
  if (volatileMax > volatileMin) slot.volatileMult = volatileMin + world.rng.next() * (volatileMax - volatileMin);
  // Pikachu at full Charge: the next signature cast is a Charged shot.
  const charged = slot === world.moves[0] ? chargedShotMult(world) : 1;
  // Rollout (D40): the first cast after 2 s of moving hits harder.
  const rollout = rolloutMult(world);
  slot.stats.damage *= charged * rollout;
  const cast = hooks?.cast ? hooks.cast(world, slot) : castMove(world, slot, MOVES[slot.moveId]);
  slot.stats.damage /= charged * rollout;
  if (cast && charged > 1) world.player.charge = 0;
  if (cast && rollout > 1) world.tech.rollout = 0;
  return cast;
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
    if (!gem.magnetized && world.time >= gem.expiresAt) {
      gem.collected = true; // expired: removed without XP
      continue;
    }
    const dx = player.x - gem.x;
    const dy = player.y - gem.y;
    const dist2 = dx * dx + dy * dy;
    if (!gem.magnetized && dist2 <= pickup2) gem.magnetized = true;
    if (!gem.magnetized) continue;
    const dist = Math.sqrt(dist2);
    if (dist <= collectReach + pull) {
      gem.collected = true;
      gainXp(world, gem.value);
      onGemCollected(world);
      continue;
    }
    gem.x += (dx / dist) * pull;
    gem.y += (dy / dist) * pull;
  }
}

/** Magnet: every gem within `radius` (about the screen) flies to the player. */
export function pullGems(world: World, radius: number): void {
  const r2 = radius * radius;
  for (const gem of world.gems) {
    const dx = gem.x - world.player.x;
    const dy = gem.y - world.player.y;
    if (dx * dx + dy * dy <= r2) gem.magnetized = true;
  }
}

/** Oran Berries heal when the player walks over them (D12); Magnets pull in gems. */
function pickUpBerries(world: World): void {
  const p = world.player;
  const reach = p.radius + TUNING.heal.pickupPadding;
  for (const berry of world.berries) {
    if (berry.collected) continue;
    const dx = berry.x - p.x;
    const dy = berry.y - p.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    berry.collected = true;
    if (berry.kind === 'oran') healPlayer(world, TUNING.heal.berryHeal);
    else pullGems(world, world.spawnRadius);
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
    // Harmless things (Zapdos's generators) never hurt or get Static.
    if (enemy.contactDamage <= 0) continue;
    // Snorlax in the air (Heavy Slam) can't be touched either way.
    const hs = world.arena?.bossEnemyId === enemy.id ? world.arena.heavySlam : null;
    if (hs && (hs.phase === 'air' || hs.phase === 'lock')) continue;
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
    const landed = hitPlayer(world, enemy.contactDamage * eliteContactMult(world, enemy) * attackContactMult(enemy), enemy);
    // Poison Sting, Lick (D37): some contact hits leave a status (not through a Shell block).
    const status = CONTACT_STATUS[enemy.kind];
    if (landed && status) applyPlayerStatus(world, status, { hit: enemy.contactDamage });
  }
}

/**
 * One hit on the player from an enemy: contact, or a boss attack (D28). Starts the invulnerability window;
 * Shell may block it; the enemy's weaken / Blinded and the player's damage-taken modifiers apply.
 * The caller checks invulnerability first.
 */
export function hitPlayer(world: World, damage: number, enemy: Enemy): boolean {
  const { player } = world;
  const ability = ABILITIES[player.ability];
  player.invulnLeft = TUNING.player.invulnSeconds;
  // Infiltrator (Elite Zubat, D37): its hits slip past Shell.
  if (ability.blockEvery && player.blockReadyLeft <= 0 && eliteAbility(enemy) !== 'infiltrator') {
    // Shell: this hit is blocked; the shell recharges.
    player.blockReadyLeft = ability.blockEvery;
    onShellBlock(world);
    emit(world, 'shellBlock', damage);
    return false;
  }
  const contact =
    damage *
    (enemy.weakenLeft > 0 ? enemy.weakenMult : 1) *
    (enemy.blindLeft > 0 ? TUNING.status.blindContactMult : 1);
  const taken = contact * world.mods.damageTakenMult * mutationDamageTakenMult(world);
  const hpBefore = player.hp;
  player.hp = Math.max(0, player.hp - taken);
  player.calmFor = 0;
  onShellHitTaken(world);
  onLowHpHit(world, hpBefore);
  player.hurtFlashLeft = TUNING.player.hurtFlashSeconds;
  // Shell Armor's share of the reduction, for armorAbsorb (Lapras).
  const armor = -(ability.damageTakenPct ?? 0);
  if (armor > 0) emit(world, 'armorAbsorb', contact * armor);
  emit(world, 'hitTaken', taken, enemy);
  onPlayerHit(world);
  if (player.hp <= 0 && !endureSaves(world)) {
    // In an arena a knockout throws you back to the map instead of ending the run (owner 2026-10-21).
    if (world.arena) world.arena.knockedOut = true;
    else world.status = 'fainted';
  }
  return true;
}

/**
 * Damage over time on the player (poison, D36): no invulnerability window, no Shell block, no hit hooks; the
 * damage-taken modifiers apply and a knockout works like any hit's.
 */
export function drainPlayer(world: World, amount: number): void {
  const { player } = world;
  if (amount <= 0 || player.hp <= 0) return;
  player.hp = Math.max(0, player.hp - amount * world.mods.damageTakenMult * mutationDamageTakenMult(world));
  player.calmFor = 0;
  if (player.hp <= 0 && !endureSaves(world)) {
    if (world.arena) world.arena.knockedOut = true;
    else world.status = 'fainted';
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
