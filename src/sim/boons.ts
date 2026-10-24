// Legendary Boons (D49): runtime effects of the boss rewards. No Phaser.
import type { ArenaBossId } from '../data/arena';
import { BOON_TUNING as B, boonsOf, type BoonId } from '../data/boons';
import { ENEMIES, type PokemonType } from '../data/content';
import { BLAST_SECONDS } from './forms/projectile';
import { applyNewStun, applySlow, damageEnemy, findNearestEnemy, procHit, pushEnemy, queryEnemies } from './combat';
import type { BoonState, Enemy, LevelUpOffer, MoveSlot, World } from './types';

export function emptyBoonState(): BoonState {
  return { quakeLeft: B.bodySlamQuake.every, thunderLeft: B.thunderCall.every, auraLeft: 0, bulkKills: 0, bulkLeft: 0, charge: 0, mistLeft: 0, casts: [] };
}

export function hasBoon(world: World, id: BoonId): boolean {
  return world.boons.includes(id);
}

/** The boon pick after beating `boss`: its 3 boons not owned yet (★ always included while unowned). */
export function boonOffer(world: World, boss: ArenaBossId): LevelUpOffer | null {
  const cards = boonsOf(boss).filter((id) => !hasBoon(world, id));
  return cards.length > 0 ? { kind: 'boon', boss, cards } : null;
}

export function learnBoon(world: World, id: BoonId): void {
  if (!hasBoon(world, id)) world.boons.push(id);
}

const signatureDamage = (world: World) => world.moves[0]?.stats.damage ?? 0;

const near: number[] = [];

/** A boon's area hit: plain proc damage that triggers nothing (D29), plus a flash. */
function boonBlast(world: World, x: number, y: number, radius: number, damage: number, type: PokemonType | null, each?: (e: Enemy) => void): void {
  world.blasts.push({ x, y, radius, lifeLeft: BLAST_SECONDS * 2, type });
  world.tech.procDepth++;
  near.length = 0;
  for (const i of queryEnemies(world, x, y, radius, near)) {
    const e = world.enemies[i];
    if (!e || e.hp <= 0 || (e.x - x) ** 2 + (e.y - y) ** 2 > (radius + e.radius) ** 2) continue;
    damageEnemy(world, e, damage, procHit(type));
    if (e.hp > 0) each?.(e);
  }
  world.tech.procDepth--;
}

/** Timers: Body Slam Quake, Thunder Call, Blizzard Aura, Bulk Up, Mist. */
export function updateBoons(world: World, dt: number): void {
  if (world.boons.length === 0) return;
  const s = world.boon;
  const p = world.player;
  if (s.bulkLeft > 0) s.bulkLeft = Math.max(0, s.bulkLeft - dt);
  if (s.mistLeft > 0) s.mistLeft = Math.max(0, s.mistLeft - dt);
  if (hasBoon(world, 'bodySlamQuake')) {
    s.quakeLeft -= dt;
    if (s.quakeLeft <= 0) {
      s.quakeLeft = B.bodySlamQuake.every;
      const { radius, damage, push } = B.bodySlamQuake;
      boonBlast(world, p.x, p.y, radius, signatureDamage(world) * damage, null, (e) => {
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        pushEnemy(e, (e.x - p.x) / d, (e.y - p.y) / d, push);
      });
    }
  }
  if (hasBoon(world, 'thunderCall')) {
    s.thunderLeft -= dt;
    if (s.thunderLeft <= 0) {
      s.thunderLeft = B.thunderCall.every;
      const { radius, damage, stun } = B.thunderCall;
      for (const c of densestClusters(world)) {
        boonBlast(world, c.x, c.y, radius, signatureDamage(world) * damage, 'Electric', (e) => applyNewStun(e, stun, 'paralysis'));
      }
    }
  }
  if (hasBoon(world, 'blizzardAura')) {
    s.auraLeft -= dt;
    if (s.auraLeft <= 0) {
      const { tick, radius, slow, dpsFactor } = B.blizzardAura;
      s.auraLeft = tick;
      world.tech.procDepth++;
      near.length = 0;
      for (const i of queryEnemies(world, p.x, p.y, radius, near)) {
        const e = world.enemies[i];
        if (!e || e.hp <= 0 || (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > (radius + e.radius) ** 2) continue;
        applySlow(e, slow, tick + 0.2);
        damageEnemy(world, e, signatureDamage(world) * dpsFactor * tick, procHit('Ice'));
      }
      world.tech.procDepth--;
    }
  }
}

/** Thunder Call: up to N strike points on the densest groups near the player (sampled, never the same group twice). */
function densestClusters(world: World): { x: number; y: number }[] {
  const { strikes, radius, searchRadius } = B.thunderCall;
  const p = world.player;
  const alive = world.enemies.filter((e) => e.hp > 0 && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= searchRadius ** 2);
  // shortcut: samples at most 40 centres (every 8 s); use the spatial hash if hordes grow far past 300.
  const step = Math.max(1, Math.floor(alive.length / 40));
  const scored: { x: number; y: number; n: number }[] = [];
  for (let i = 0; i < alive.length; i += step) {
    const c = alive[i]!;
    let n = 0;
    for (const e of alive) if ((e.x - c.x) ** 2 + (e.y - c.y) ** 2 <= radius * radius) n++;
    scored.push({ x: c.x, y: c.y, n });
  }
  scored.sort((a, b) => b.n - a.n);
  const picks: { x: number; y: number }[] = [];
  for (const c of scored) {
    if (picks.length >= strikes) break;
    if (picks.every((q) => (q.x - c.x) ** 2 + (q.y - c.y) ** 2 > (2 * radius) ** 2)) picks.push(c);
  }
  return picks;
}

/** Charge Beam's factor for the cast happening now. */
export function chargeBeamMult(world: World): number {
  return hasBoon(world, 'chargeBeam') && world.boon.charge >= B.chargeBeam.casts ? B.chargeBeam.mult : 1;
}

/** A move cast went off: Charge Beam charges (or spends), Dynamic Punch counts toward its slam. */
export function onBoonCast(world: World, slot: MoveSlot, charged: boolean): void {
  if (world.boons.length === 0) return;
  const s = world.boon;
  if (hasBoon(world, 'chargeBeam')) s.charge = charged ? 0 : s.charge + 1;
  if (hasBoon(world, 'dynamicPunch')) {
    const i = world.moves.indexOf(slot);
    s.casts[i] = (s.casts[i] ?? 0) + 1;
    if (s.casts[i]! % B.dynamicPunch.everyCasts === 0) {
      const target = findNearestEnemy(world, B.dynamicPunch.range);
      if (target) boonBlast(world, target.x, target.y, B.dynamicPunch.radius, slot.stats.damage * B.dynamicPunch.damage, 'Fighting');
    }
  }
}

/** Bulk Up and Guts on every hit. */
export function boonDamageMult(world: World): number {
  if (world.boons.length === 0) return 1;
  let mult = 1;
  if (world.boon.bulkLeft > 0) mult *= 1 + B.bulkUp.damagePct;
  if (hasBoon(world, 'guts') && world.player.hp < world.player.maxHp * B.guts.belowHp) mult *= 1 + B.guts.damagePct;
  return mult;
}

/** Guts' speed while low. */
export function boonMoveSpeedMult(world: World): number {
  return hasBoon(world, 'guts') && world.player.hp < world.player.maxHp * B.guts.belowHp ? 1 + B.guts.speedPct : 1;
}

/** An enemy died: Bulk Up counts toward its burst. */
export function onBoonKill(world: World): void {
  if (!hasBoon(world, 'bulkUp')) return;
  const s = world.boon;
  if (++s.bulkKills >= B.bulkUp.kills) {
    s.bulkKills = 0;
    s.bulkLeft = B.bulkUp.seconds;
  }
}

/** Mist: once per cooldown, a landed hit is ignored. True if it was. */
export function mistBlocks(world: World): boolean {
  if (!hasBoon(world, 'mist') || world.boon.mistLeft > 0) return false;
  world.boon.mistLeft = B.mist.every;
  world.player.invulnLeft = B.mist.invulnSeconds;
  return true;
}

/** Sheer Cold: a move's own hit on a slowed, low, non-boss enemy finishes it. */
export function sheerColdExecutes(world: World, enemy: Enemy, slot: MoveSlot | null): boolean {
  return (
    slot !== null &&
    hasBoon(world, 'sheerCold') &&
    enemy.hp > 0 &&
    enemy.slowLeft > 0 &&
    !ENEMIES[enemy.kind].boss &&
    enemy.hp < enemy.maxHp * B.sheerCold.belowHp
  );
}

/** Seconds without damage before rest regen starts (Thick Fat shortens it). */
export function restAfterSeconds(world: World, base: number): number {
  return hasBoon(world, 'thickFat') ? B.thickFat.restAfterSeconds : base;
}

/** Gluttony's berry drop and heal factor. */
export function gluttonyMult(world: World, which: 'drop' | 'heal'): number {
  if (!hasBoon(world, 'gluttony')) return 1;
  return which === 'drop' ? B.gluttony.dropMult : B.gluttony.healMult;
}
