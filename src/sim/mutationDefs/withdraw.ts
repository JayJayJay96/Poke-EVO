import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { MAX_ENEMY_RADIUS, damageEnemy, findNearestEnemy, makeHitInfo, pushEnemy, queryEnemies } from '../combat';
import { SWING_SECONDS } from '../forms/melee';
import { defineMutation } from '../hooks';
import type { MoveSlot, World } from '../types';
import { dirTo, ranked } from './util';

// Withdraw Mutations (docs/moveset/shared/withdraw.md, squirtle/README.md).

const withdraw = MOVES.withdraw as MeleeMoveDef;
const neighbours: number[] = [];

function reachOf(slot: MoveSlot): number {
  return withdraw.reach * slot.stats.area * slot.stats.reachMult;
}

/** One 360° hit on everything within reach, knocked away from the player (drawn as a full swing). */
function bashAround(world: World, slot: MoveSlot, damageFraction: number): void {
  const { player, enemies } = world;
  const reach = reachOf(slot);
  const hit = makeHitInfo(slot.stats, slot);
  queryEnemies(world, player.x, player.y, reach, neighbours);
  for (const j of neighbours) {
    const enemy = enemies[j]!;
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist - enemy.radius > reach) continue;
    hit.dirX = dist > 0 ? dx / dist : 1;
    hit.dirY = dist > 0 ? dy / dist : 0;
    damageEnemy(world, enemy, slot.stats.damage * damageFraction, hit);
  }
  world.swings.push({ x: player.x, y: player.y, dirX: 1, dirY: 0, reach, halfArc: Math.PI, lifeLeft: SWING_SECONDS });
}

/**
 * Spiked Shell (generic): Withdraw becomes a 3 s aura that hits everything touching you every
 * 0.5 s and staggers it (no stun, or it would lock the crowd). You move slower while it's up.
 */
const spiked = ranked('withdraw.spikedShell');
defineMutation('withdraw.spikedShell', {
  stats: (s, _world, slot) => {
    s.cooldown *= spiked(slot).cooldownMult;
    s.stun = 0;
  },
  cast: (world, slot) => {
    if (!findNearestEnemy(world, reachOf(slot) + MAX_ENEMY_RADIUS)) return false;
    slot.activeLeft = spiked(slot).auraSeconds * slot.stats.duration;
    slot.tickLeft = 0;
    return true;
  },
  update: (world, slot, dt) => {
    if (slot.activeLeft <= 0) return;
    slot.activeLeft -= dt;
    slot.tickLeft -= dt;
    if (slot.tickLeft > 0) return;
    slot.tickLeft += spiked(slot).tickInterval;
    bashAround(world, slot, spiked(slot).tickDamageFraction);
  },
  moveSpeedMult: (_world, slot) => (slot.activeLeft > 0 ? spiked(slot).moveSpeedMult : 1),
});

/** Counter Shell (Bond, Shell blocks): every block resets Withdraw, and that bash staggers ×2 (III: hits harder too). */
const counter = ranked('withdraw.counterShell');
defineMutation('withdraw.counterShell', {
  stats: (s, _world, slot) => {
    s.damage *= counter(slot).damageMult;
  },
  onEvent: (_world, slot, event) => {
    if (event !== 'shellBlock') return;
    slot.cooldownLeft = 0;
    slot.mutState.armed = 1;
  },
  live: (s, _world, slot) => {
    if (!slot.mutState.armed) return;
    s.knockback *= counter(slot).staggerMult;
    s.damage *= counter(slot).resetHitMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.armed = 0;
  },
});

/** Hunker Down (generic): for a moment after each cast you take much less damage, but crawl (III: hits taken stagger back). */
const hunker = ranked('withdraw.hunkerDown');
defineMutation('withdraw.hunkerDown', {
  stats: (s, _world, slot) => {
    s.damage *= hunker(slot).damageMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.buff = hunker(slot).buffSeconds;
  },
  update: (_world, slot, dt) => {
    if (slot.mutState.buff) slot.mutState.buff = Math.max(0, slot.mutState.buff - dt);
  },
  onEvent: (world, slot, event, _amount, enemy) => {
    const stagger = hunker(slot).hitStagger;
    if (event !== 'hitTaken' || !slot.mutState.buff || stagger <= 0 || !enemy) return;
    const [dx, dy] = dirTo(world.player.x, world.player.y, enemy.x, enemy.y);
    pushEnemy(enemy, dx, dy, stagger);
  },
  damageTakenMult: (_world, slot) => (slot.mutState.buff ? hunker(slot).damageTakenMult : 1),
  moveSpeedMult: (_world, slot) => (slot.mutState.buff ? hunker(slot).moveSpeedMult : 1),
});
