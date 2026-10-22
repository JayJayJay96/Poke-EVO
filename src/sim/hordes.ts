import { ENEMIES, TUNING, type EnemyId } from '../data/content';
import { ABILITY_TUNING, ELITE, ELITE_ABILITY, HORDE, HORDE_FOLLOWERS, PACING, type EliteAbility } from '../data/hordes';
import type { Enemy, World } from './types';
import { pickEnemyKind, runClock, spawnEnemy, waveAt } from './world';

// Spawn pacing, horde events and Elites (D34; docs/enemies/README.md §7–§8). The spawner in world.ts asks this
// module how fast to spawn and from where; hordes are their own events on top.

/** Spawn-rate multiplier now: the pressure cycle (build-up, surge, lull), and the lull after a horde leader falls. */
export function spawnRateMult(world: World): number {
  const t = runClock(world) % PACING.cycle;
  const cycle = t >= PACING.lullAt ? PACING.lullRate : t >= PACING.surgeAt ? PACING.surgeRate : 1;
  return world.lullLeft > 0 ? Math.min(cycle, PACING.lullRate) : cycle;
}

/** Whether the pressure cycle is in its surge (enemies come from every side). */
export function surging(world: World): boolean {
  const t = runClock(world) % PACING.cycle;
  return t >= PACING.surgeAt && t < PACING.lullAt;
}

/** The angle the next spawn comes from: packs from one side, or anywhere during a surge. */
export function nextSpawnAngle(world: World): number {
  const { rng } = world;
  if (surging(world)) return rng.next() * Math.PI * 2;
  if (world.packLeft <= 0) {
    world.packAngle = rng.next() * Math.PI * 2;
    world.packLeft = PACING.pack.min + Math.floor(rng.next() * (PACING.pack.max - PACING.pack.min + 1));
  }
  world.packLeft--;
  return world.packAngle + (rng.next() - 0.5) * PACING.pack.arcDeg * (Math.PI / 180);
}

/** The ability an enemy has on (Elites only). */
export function eliteAbility(enemy: Enemy): EliteAbility | undefined {
  return enemy.elite ? ELITE_ABILITY[enemy.kind] : undefined;
}

/** Turns a freshly spawned enemy into its Elite: tougher, bigger, its ability on (README §7). */
export function makeElite(enemy: Enemy): void {
  enemy.elite = true;
  enemy.maxHp *= ELITE.hpMult;
  enemy.hp = enemy.maxHp;
  enemy.contactDamage *= ELITE.contactMult;
  enemy.radius *= ELITE.radiusMult;
}

/** Contact damage multiplier from Elite abilities (Guts, Sniper, Anger Point). */
export function eliteContactMult(world: World, enemy: Enemy): number {
  const ability = eliteAbility(enemy);
  if (ability === 'guts') {
    const statused = enemy.burnLeft > 0 || enemy.poisonLeft > 0 || (enemy.stunLeft > 0 && enemy.stunKind === 'paralysis');
    return statused ? ABILITY_TUNING.guts.contactMult : 1;
  }
  if (ability === 'sniper') {
    const { player } = world;
    return player.hp < player.maxHp * ABILITY_TUNING.sniper.belowPct ? ABILITY_TUNING.sniper.contactMult : 1;
  }
  if (ability === 'angerPoint') return enemy.rageLeft > 0 ? ABILITY_TUNING.angerPoint.contactMult : 1;
  return 1;
}

/** A horde leader of `leader`'s species: who follows it, spawned around it, all at the slowest member's speed. */
function spawnHorde(world: World, angle: number, leader: EnemyId): void {
  const { player, rng } = world;
  const t = runClock(world);
  const wave = waveAt(t);
  const cx = player.x + Math.cos(angle) * world.spawnRadius;
  const cy = player.y + Math.sin(angle) * world.spawnRadius;
  const scaled = (e: Enemy): Enemy => {
    e.contactDamage *= wave.damageScale;
    e.speed *= wave.speedScale;
    return e;
  };
  const boss = scaled(spawnEnemy(world, leader, cx, cy, wave.hpScale));
  makeElite(boss);
  const id = world.nextId++;
  boss.hordeId = id;
  const members = [boss];
  const { base, perMinute, max } = HORDE.followers;
  const followers = HORDE_FOLLOWERS[leader] ?? [leader];
  const room = Math.max(0, TUNING.spawn.maxEnemies - world.enemies.length);
  const count = Math.min(max, base + Math.floor((t / 60) * perMinute), room);
  for (let i = 0; i < count; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * HORDE.spread;
    const kind = followers[Math.floor(rng.next() * followers.length)]!;
    const e = scaled(spawnEnemy(world, kind, cx + Math.cos(a) * d, cy + Math.sin(a) * d, wave.hpScale));
    e.hordeId = id;
    members.push(e);
  }
  // They march together at the slowest member's speed (ROSTER horde block `hordeSpeed`).
  const pace = Math.min(...members.map((e) => e.speed));
  for (const e of members) e.speed = pace;
  world.hordes.push({ id, leaderId: boss.id });
}

/** Each spawner step: warn of the next horde, send it, and scatter a horde whose leader fell. */
export function updateHordes(world: World, dt: number): void {
  world.lullLeft = Math.max(0, world.lullLeft - dt);
  const t = runClock(world);
  if (!world.hordeWarning && t >= world.nextHordeAt) {
    world.nextHordeAt += HORDE.every;
    // The leader comes from the species of this point of the run that have a horde line.
    const weights = waveAt(t).weights;
    const eligible = Object.fromEntries(Object.entries(weights).filter(([kind]) => HORDE_FOLLOWERS[kind as EnemyId]));
    if (Object.keys(eligible).length > 0) {
      world.hordeWarning = { angle: world.rng.next() * Math.PI * 2, left: HORDE.warning, leader: pickEnemyKind(eligible, world.rng) };
    }
  }
  if (world.hordeWarning) {
    world.hordeWarning.left -= dt;
    if (world.hordeWarning.left <= 0) {
      spawnHorde(world, world.hordeWarning.angle, world.hordeWarning.leader);
      world.hordeWarning = null;
    }
  }
  // Leader down: the pack flees until it's far enough, then turns back at its own speed; a lull follows.
  for (const horde of world.hordes) {
    const leader = world.enemies.find((e) => e.id === horde.leaderId);
    if (leader && leader.hp > 0) continue;
    const wave = waveAt(t);
    for (const e of world.enemies) {
      if (e.hordeId !== horde.id || e.hp <= 0) continue;
      e.hordeId = 0;
      e.fleeTo = HORDE.fleeDistance;
      e.speed = ENEMIES[e.kind].speed * wave.speedScale;
    }
    world.lullLeft = HORDE.lullAfterLeader;
  }
  world.hordes = world.hordes.filter((h) => world.enemies.some((e) => e.id === h.leaderId && e.hp > 0));
}
