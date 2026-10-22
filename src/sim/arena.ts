import { ARENA_BOSS_IDS, ARENA_BOSSES, ARENA_TUNING, SNORLAX_KIT, type ArenaBossId } from '../data/arena';
import { blockByRubble, holdByBlock, updateBoss } from './bosses';
import { ENEMIES } from '../data/content';
import { effectiveness } from '../data/typeChart';
import { MAX_COMBO_MOVES, comboCandidates } from './combo';
import { applyAugmentCard, applyCard, augmentPool, buildCardPool, gainXp, needsReplace } from './progression';
import { createSeededRng, type Rng } from './rng';
import { applySiteCard, rollSiteCards } from './sites';
import { currentStage, refreshStats } from './stats';
import type { ArenaFight, LevelUpOffer, RewardCard, World } from './types';
import { spawnEnemy, waveAt } from './world';

// Arena boss events (D28). At set times an entrance opens near the player for a while; stepping in
// stores the main map and starts a timed boss fight in a closed arena. Winning gives a reward pick;
// losing (time out) just sends you back. The run clock keeps ticking throughout.

/** Seeded event times for a run, independent of the gameplay RNG. */
export function arenaSchedule(mapSeed: number): number[] {
  const rng = createSeededRng((mapSeed ^ 0x5bd1e995) >>> 0);
  return ARENA_TUNING.eventTimes.map((t) => t + (rng.next() * 2 - 1) * ARENA_TUNING.jitter);
}

/**
 * Bosses the next event may draw: no repeats while others remain, and the first event never draws a
 * boss that resists one of the player's current types (D28 counter rule).
 */
export function arenaBossChoices(world: World): ArenaBossId[] {
  let pool = ARENA_BOSS_IDS.filter((id) => !world.arenaBossesUsed.includes(id));
  if (pool.length === 0) pool = [...ARENA_BOSS_IDS];
  if (world.arenaEventsDone === 0) {
    const types = currentStage(world).types;
    const fair = pool.filter((id) => types.every((t) => effectiveness(t, ENEMIES[ARENA_BOSSES[id].enemy].types) >= 1));
    if (fair.length > 0) pool = fair;
  }
  return pool;
}

function openEntrance(world: World): void {
  const { rng, player } = world;
  const choices = arenaBossChoices(world);
  const bossId = choices[Math.floor(rng.next() * choices.length)]!;
  const { min, max } = ARENA_TUNING.entranceDistance;
  const angle = rng.next() * Math.PI * 2;
  const dist = min + rng.next() * (max - min);
  world.entrance = {
    bossId,
    x: player.x + Math.cos(angle) * dist,
    y: player.y + Math.sin(angle) * dist,
    radius: ARENA_TUNING.entranceRadius,
    closesAt: world.time + ARENA_TUNING.openSeconds,
  };
  world.arenaBossesUsed.push(bossId);
  world.arenaEventsDone++;
  world.arenaNotice = { kind: 'opened', bossId };
}

/** Stores the main map, then puts the player at the arena's edge and the waiting boss in its middle. */
function enterArena(world: World): void {
  const entrance = world.entrance!;
  const def = ARENA_BOSSES[entrance.bossId];
  const { player } = world;
  const stored: ArenaFight['stored'] = {
    enemies: world.enemies,
    gems: world.gems,
    berries: world.berries,
    projectiles: world.projectiles,
    zones: world.zones,
    puddles: world.puddles,
    scorches: world.scorches,
    entities: world.entities,
    x: player.x,
    y: player.y,
  };
  world.enemies = [];
  world.gems = [];
  world.berries = [];
  world.projectiles = [];
  world.zones = [];
  world.puddles = [];
  world.scorches = [];
  world.entities = [];
  const { x, y } = entrance;
  const wave = waveAt(world.time);
  const boss = spawnEnemy(world, def.enemy, x, y, wave.hpScale);
  boss.contactDamage *= wave.damageScale;
  const bossSpeed = boss.speed * wave.speedScale;
  boss.speed = 0; // waits in the middle until the fight starts
  player.x = x;
  player.y = y + ARENA_TUNING.arenaRadius * 0.8;
  world.arena = {
    bossId: def.id,
    bossEnemyId: boss.id,
    x,
    y,
    radius: ARENA_TUNING.arenaRadius,
    engaged: false,
    waitLeft: ARENA_TUNING.engageAfter,
    timeLeft: def.timeLimit,
    bossSpeed,
    goal: null,
    slam: null,
    // shortcut: Snorlax is the only arena boss; move these into its AI's start when a second boss lands.
    slamCooldown: SNORLAX_KIT.bodySlam.firstAfter,
    berryTimer: SNORLAX_KIT.gluttony.interval,
    shakeLeft: 0,
    berryDropped: false,
    phase: 1,
    rest: null,
    snores: [],
    snoreTimer: 0,
    nextSnoreGap: 0,
    yawn: null,
    yawnCooldown: 0,
    playerSlow: 0,
    slamsQueued: 0,
    beam: null,
    beamCooldown: SNORLAX_KIT.hyperBeam.firstAfter,
    rubble: [],
    knockedOut: false,
    moveGap: 0,
    lastMove: null,
    cooldowns: {
      crunch: SNORLAX_KIT.crunch.firstAfter,
      rockSlide: SNORLAX_KIT.rockSlide.firstAfter,
      fling: SNORLAX_KIT.fling.firstAfter,
      heavySlam: SNORLAX_KIT.heavySlam.firstAfter,
      block: SNORLAX_KIT.block.firstAfter,
      earthquake: SNORLAX_KIT.earthquake.firstAfter,
    },
    drumLeft: 0,
    crunch: null,
    rockSlideLeft: 0,
    rocks: [],
    fling: null,
    shots: [],
    heavySlam: null,
    block: null,
    belch: null,
    belchReady: false,
    quake: null,
    stored,
  };
  world.entrance = null;
}

/** Back to the stored main map; XP left lying in the arena is collected on the way out. */
function leaveArena(world: World): void {
  const fight = world.arena!;
  const xp = world.gems.reduce((sum, gem) => sum + (gem.collected ? 0 : gem.value), 0);
  const s = fight.stored;
  world.enemies = s.enemies;
  world.gems = s.gems;
  world.berries = s.berries;
  world.projectiles = s.projectiles;
  world.zones = s.zones;
  world.puddles = s.puddles;
  world.scorches = s.scorches;
  world.entities = s.entities;
  world.player.x = s.x;
  world.player.y = s.y;
  world.player.invulnLeft = Math.max(world.player.invulnLeft, ARENA_TUNING.returnInvulnSeconds);
  world.arena = null;
  if (xp > 0) gainXp(world, xp);
}

/** Each step, after movement: opens, closes and enters entrances; inside, keeps the player in and runs the clock. */
export function updateArena(world: World, dt: number): void {
  const fight = world.arena;
  const { player } = world;
  if (fight) {
    const dx = player.x - fight.x;
    const dy = player.y - fight.y;
    const d = Math.hypot(dx, dy);
    const max = fight.radius - player.radius;
    if (d > max) {
      player.x = fight.x + (dx / d) * max;
      player.y = fight.y + (dy / d) * max;
    }
    blockByRubble(world, fight);
    const boss = world.enemies.find((e) => e.id === fight.bossEnemyId);
    if (boss) holdByBlock(world, fight, boss);
    if (!fight.engaged) {
      fight.waitLeft -= dt;
      if (d <= ARENA_TUNING.engageDistance || fight.waitLeft <= 0) {
        fight.engaged = true;
        if (boss) boss.speed = fight.bossSpeed;
      }
    } else {
      fight.timeLeft = Math.max(0, fight.timeLeft - dt);
      if (boss) updateBoss(world, fight, boss, dt);
    }
    return;
  }
  const entrance = world.entrance;
  if (entrance) {
    if (world.time >= entrance.closesAt) {
      world.arenaNotice = { kind: 'missed', bossId: entrance.bossId };
      world.entrance = null;
    } else if (Math.hypot(player.x - entrance.x, player.y - entrance.y) <= entrance.radius) {
      enterArena(world);
    }
    return;
  }
  const next = world.arenaSchedule[world.arenaEventsDone];
  if (world.spawnEnabled && next !== undefined && world.time >= next) openEntrance(world);
}

/** After deaths are removed: a dead boss wins (combine step, then reward pick), an empty timer loses (nothing). */
export function resolveArena(world: World): void {
  const fight = world.arena;
  if (!fight) return;
  const won = !world.enemies.some((e) => e.id === fight.bossEnemyId);
  if (!won && fight.timeLeft > 0 && !fight.knockedOut) return;
  world.arenaNotice = { kind: won ? 'won' : fight.knockedOut ? 'knockedOut' : 'lost', bossId: fight.bossId };
  leaveArena(world);
  // Knocked out: back on the map with some HP instead of fainting (owner 2026-10-21).
  if (world.player.hp <= 0) world.player.hp = world.player.maxHp * ARENA_TUNING.knockoutHpPct;
  if (won && !world.offer) {
    const slots = comboCandidates(world);
    world.offer = slots.length > 0 ? { kind: 'combine', slots } : rewardOffer(world, world.combo.length < MAX_COMBO_MOVES);
  }
}

function rewardOffer(world: World, combineMissed: boolean): LevelUpOffer {
  return { kind: 'arenaReward', cards: rollRewardCards(world), combineMissed };
}

/** Combine step (D28): the first pick becomes the base, later picks are absorbed into it. Then the reward pick. */
export function chooseCombine(world: World, index: number): void {
  const offer = world.offer;
  if (offer?.kind !== 'combine') return;
  const slot = offer.slots[index];
  if (slot === undefined) return;
  world.combo.push(slot);
  world.offer = rewardOffer(world, false);
}

/** Skips the combine step; the reward pick still follows. */
export function skipCombine(world: World): void {
  if (world.offer?.kind === 'combine') world.offer = rewardOffer(world, false);
}

/** Up to `count` distinct random entries, removed from `pool`. */
function take<T>(rng: Rng, pool: T[], count: number): T[] {
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) picked.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!);
  return picked;
}

/**
 * The mixed reward (D28): cards from the level, augment and site pools, at least one from each pool
 * that has any. Augment cards that would need a socket replaced are left out.
 */
export function rollRewardCards(world: World): RewardCard[] {
  const { rng } = world;
  const level = buildCardPool(world).map((card): RewardCard => ({ pool: 'level', card }));
  const augment = world.moves.flatMap((_, slot) =>
    augmentPool(world, slot)
      .filter((card) => !needsReplace(world, slot, card))
      .map((card): RewardCard => ({ pool: 'augment', slot, card })),
  );
  const site = rollSiteCards(world)
    .filter((card) => card.kind !== 'surge')
    .map((card): RewardCard => ({ pool: 'site', card }));
  const cards = [...take(rng, level, 1), ...take(rng, augment, 1), ...take(rng, site, 1)];
  cards.push(...take(rng, [...level, ...augment, ...site], ARENA_TUNING.rewardCards - cards.length));
  if (cards.length === 0) return [{ pool: 'site', card: { kind: 'surge' } }];
  return take(rng, cards, cards.length);
}

/** Takes one reward card; the window closes. */
export function chooseArenaReward(world: World, index: number): void {
  const offer = world.offer;
  if (offer?.kind !== 'arenaReward') return;
  const reward = offer.cards[index];
  if (!reward) return;
  world.offer = null;
  if (reward.pool === 'level') applyCard(world, reward.card);
  else if (reward.pool === 'augment') applyAugmentCard(world, reward.slot, reward.card);
  else applySiteCard(world, reward.card);
  refreshStats(world);
}
