import { ENEMY_ATTACKS, ENEMY_SHOT_CAP, WEB } from '../data/enemyAttacks';
import { BLAST_SECONDS } from './forms/projectile';
import { eliteAbility } from './hordes';
import { applyPlayerStatus } from './playerStatus';
import type { Enemy, World } from './types';
import { hitPlayer } from './world';

// Telegraphed attacks of normal enemies (D35, D37; README §9.2, ROSTER.md). Every attack locks its aim or spot
// when its telegraph appears and never re-aims (fairness, BOSSES.md §2). Movement during them is in world.ts
// (`attackVelocity`); this module runs the steps, resolves them, and moves darts and webs.

const dist2 = (x: number, y: number): number => x * x + y * y;

/** Whether an enemy can't attack right now: stunned, blinded (lost you) or fleeing. */
function disrupted(enemy: Enemy): boolean {
  return enemy.stunLeft > 0 || enemy.blindLeft > 0 || enemy.fleeTo > 0 || enemy.fleeLeft > 0;
}

/** Whether the player is inside a circle (counting their own radius). */
function playerIn(world: World, x: number, y: number, radius: number): boolean {
  const { player } = world;
  return dist2(player.x - x, player.y - y) <= (radius + player.radius) ** 2;
}

/** A hit on the player from an enemy attack (respects invulnerability); true if it landed (not Shell-blocked). */
function strike(world: World, enemy: Enemy, damage: number): boolean {
  if (world.player.invulnLeft > 0) return false;
  return hitPlayer(world, damage, enemy);
}

/** Where a teleporter lands: ahead of where you're walking, or just beside you if you stand still. */
function blinkSpot(world: World, enemy: Enemy, ahead: number): { x: number; y: number } {
  const { player } = world;
  const v = Math.hypot(player.vx, player.vy);
  if (v > 1) return { x: player.x + (player.vx / v) * ahead, y: player.y + (player.vy / v) * ahead };
  const d = Math.hypot(enemy.x - player.x, enemy.y - player.y) || 1;
  return { x: player.x + ((enemy.x - player.x) / d) * 60, y: player.y + ((enemy.y - player.y) / d) * 60 };
}

/** Each step: start, advance or cancel attacks, resolve them, and move darts and webs. */
export function updateEnemyAttacks(world: World, dt: number): void {
  const { player } = world;
  for (const enemy of world.enemies) {
    const atk = ENEMY_ATTACKS[enemy.kind];
    if (!atk || enemy.hp <= 0) continue;
    enemy.atkCooldown -= dt;
    // A fusing Voltorb can't be stunned out of it (ROSTER); anything else drops its telegraph.
    const fusing = atk.kind === 'explode' && enemy.atkPhase === 'windup';
    if (disrupted(enemy) && !fusing) {
      if (enemy.atkPhase === 'windup') enemy.atkPhase = null;
      if (enemy.atkPhase !== 'dash') continue;
    }
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (enemy.atkPhase === null) {
      if (enemy.atkCooldown > 0 || dist > atk.range) continue;
      // Lock the aim and the spot when the telegraph appears (it never re-aims).
      enemy.atkPhase = 'windup';
      enemy.atkTimer = atk.telegraph;
      enemy.aimX = dx / dist;
      enemy.aimY = dy / dist;
      const spot =
        atk.kind === 'blink'
          ? blinkSpot(world, enemy, atk.ahead)
          : atk.kind === 'dive' || atk.kind === 'web'
            ? { x: player.x, y: player.y }
            : { x: enemy.x, y: enemy.y };
      enemy.markX = spot.x;
      enemy.markY = spot.y;
      continue;
    }
    if (enemy.atkPhase === 'windup') {
      enemy.atkTimer -= dt;
      if (enemy.atkTimer > 0) continue;
      resolve(world, enemy);
    } else if (enemy.atkPhase === 'dash') {
      if (enemy.dashLeft <= 0) {
        enemy.atkPhase = 'recover';
        enemy.atkTimer = 'recover' in atk ? atk.recover : 0;
      }
    } else {
      enemy.atkTimer -= dt;
      if (enemy.atkTimer <= 0) {
        enemy.atkPhase = null;
        enemy.atkCooldown = atk.cooldown;
      }
    }
  }
  for (const shot of world.enemyShots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.left -= dt;
    if (!playerIn(world, shot.x, shot.y, shot.radius)) continue;
    if (strike(world, shot.owner, shot.damage) && shot.status) applyPlayerStatus(world, shot.status);
    shot.left = 0;
  }
  world.enemyShots = world.enemyShots.filter((shot) => shot.left > 0);
  for (const web of world.webs) web.left -= dt;
  world.webs = world.webs.filter((web) => web.left > 0);
  // Aftermath rings (Elite Voltorb): they explode when their delay runs out.
  for (const b of world.delayedBlasts) {
    b.left -= dt;
    if (b.left > 0) continue;
    world.blasts.push({ x: b.x, y: b.y, radius: b.radius, lifeLeft: BLAST_SECONDS, type: 'Electric' });
    if (playerIn(world, b.x, b.y, b.radius)) strike(world, b.owner, b.damage);
  }
  world.delayedBlasts = world.delayedBlasts.filter((b) => b.left > 0);
}

/** The telegraph ran out: the attack happens. */
function resolve(world: World, enemy: Enemy): void {
  const atk = ENEMY_ATTACKS[enemy.kind]!;
  const { player } = world;
  const done = (): void => {
    enemy.atkPhase = null;
    enemy.atkCooldown = atk.cooldown;
  };
  switch (atk.kind) {
    case 'ranged':
      if (world.enemyShots.length < ENEMY_SHOT_CAP) {
        world.enemyShots.push({
          x: enemy.x + enemy.aimX * enemy.radius,
          y: enemy.y + enemy.aimY * enemy.radius,
          vx: enemy.aimX * atk.shotSpeed,
          vy: enemy.aimY * atk.shotSpeed,
          radius: atk.shotRadius,
          left: atk.shotLife,
          damage: enemy.contactDamage * atk.damageFactor,
          owner: enemy,
          status: atk.status,
        });
      }
      done();
      break;
    case 'charge':
      enemy.atkPhase = 'dash';
      enemy.dashLeft = atk.dashDistance;
      break;
    case 'dive':
      // Lands on the marked ring: a hit for anyone inside, then a short recover.
      enemy.x = enemy.markX;
      enemy.y = enemy.markY;
      world.blasts.push({ x: enemy.markX, y: enemy.markY, radius: atk.radius, lifeLeft: BLAST_SECONDS, type: 'Flying' });
      if (playerIn(world, enemy.markX, enemy.markY, atk.radius)) strike(world, enemy, enemy.contactDamage * atk.damageFactor);
      enemy.atkPhase = 'recover';
      enemy.atkTimer = atk.recover;
      break;
    case 'web':
      world.webs.push({ x: enemy.markX, y: enemy.markY, radius: atk.radius, left: atk.seconds });
      if (world.webs.length > WEB.max) world.webs.shift();
      done();
      break;
    case 'cone': {
      const a = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const aim = Math.atan2(enemy.aimY, enemy.aimX);
      const gap = Math.abs(Math.atan2(Math.sin(a - aim), Math.cos(a - aim)));
      const reach = atk.reach + player.radius;
      if (gap <= (atk.arcDeg * Math.PI) / 360 && dist2(player.x - enemy.x, player.y - enemy.y) <= reach * reach) {
        applyPlayerStatus(world, atk.status);
      }
      done();
      break;
    }
    case 'pulse':
      world.blasts.push({ x: enemy.markX, y: enemy.markY, radius: atk.radius, lifeLeft: BLAST_SECONDS, type: 'Poison' });
      if (playerIn(world, enemy.markX, enemy.markY, atk.radius)) {
        applyPlayerStatus(world, atk.status, { hit: enemy.contactDamage, powder: atk.powder });
      }
      done();
      break;
    case 'blink':
      enemy.x = enemy.markX;
      enemy.y = enemy.markY;
      world.blasts.push({ x: enemy.markX, y: enemy.markY, radius: atk.radius, lifeLeft: BLAST_SECONDS, type: 'Psychic' });
      if (playerIn(world, enemy.markX, enemy.markY, atk.radius) && strike(world, enemy, enemy.contactDamage * atk.damageFactor)) {
        applyPlayerStatus(world, atk.status);
      }
      done();
      break;
    case 'explode':
      // Self-Destruct: it faints and pays no XP (lore: no exp for a self-KO).
      world.blasts.push({ x: enemy.x, y: enemy.y, radius: atk.radius, lifeLeft: BLAST_SECONDS, type: 'Electric' });
      if (playerIn(world, enemy.x, enemy.y, atk.radius)) strike(world, enemy, enemy.contactDamage * atk.damageFactor);
      enemy.hp = 0;
      done();
      break;
    case 'heal':
      world.blasts.push({ x: enemy.x, y: enemy.y, radius: atk.radius, lifeLeft: BLAST_SECONDS, type: 'Grass' });
      for (const other of world.enemies) {
        if (other === enemy || other.hp <= 0) continue;
        if (dist2(other.x - enemy.x, other.y - enemy.y) > atk.radius * atk.radius) continue;
        other.hp = Math.min(other.maxHp, other.hp + other.maxHp * atk.healPct);
        // Healer (Elite Chansey): the pulse also clears their statuses.
        if (eliteAbility(enemy) === 'healer') {
          other.burnLeft = other.poisonLeft = other.seedLeft = other.slowLeft = other.stunLeft = other.blindLeft = 0;
        }
      }
      done();
      break;
  }
}

/**
 * How an attacking or keep-away enemy moves this step, or null to walk at you as usual: still while winding up or
 * recovering, along the locked line while dashing, and ranged and healers keep their distance.
 */
export function attackVelocity(enemy: Enemy, dirX: number, dirY: number, dist: number, speed: number, dt: number): { vx: number; vy: number } | null {
  const atk = ENEMY_ATTACKS[enemy.kind];
  if (!atk) return null;
  if (enemy.atkPhase === 'windup' || enemy.atkPhase === 'recover') return { vx: 0, vy: 0 };
  if (enemy.atkPhase === 'dash' && atk.kind === 'charge') {
    const v = speed * atk.dashSpeedMult;
    enemy.dashLeft -= v * dt;
    return { vx: enemy.aimX * v, vy: enemy.aimY * v };
  }
  if ((atk.kind === 'ranged' || atk.kind === 'heal') && !disrupted(enemy)) {
    if (dist < atk.keepMin) return { vx: -dirX * speed * atk.backOffMult, vy: -dirY * speed * atk.backOffMult };
    if (dist <= atk.keepMax) return { vx: 0, vy: 0 };
  }
  return null;
}

/** Contact damage multiplier while charging (Take Down, Rollout hit harder). */
export function attackContactMult(enemy: Enemy): number {
  const atk = ENEMY_ATTACKS[enemy.kind];
  return atk?.kind === 'charge' && enemy.atkPhase === 'dash' ? atk.damageFactor : 1;
}

/** The slow from standing in a String Shot web. */
export function webSlow(world: World): number {
  return world.webs.some((web) => playerIn(world, web.x, web.y, web.radius)) ? WEB.slow : 0;
}
