import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { MAX_ENEMY_RADIUS, damageEnemy, findNearestEnemy, makeHitInfo, queryEnemies } from '../combat';
import { SWING_SECONDS } from '../forms/melee';
import { defineMutation } from '../hooks';
import type { MoveSlot, World } from '../types';

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
const spiked = MUTATIONS['withdraw.spikedShell'].values;
defineMutation('withdraw.spikedShell', {
  stats: (s) => {
    s.cooldown *= spiked.cooldownMult;
    s.stun = 0;
  },
  cast: (world, slot) => {
    if (!findNearestEnemy(world, reachOf(slot) + MAX_ENEMY_RADIUS)) return false;
    slot.activeLeft = spiked.auraSeconds * slot.stats.duration;
    slot.tickLeft = 0;
    return true;
  },
  update: (world, slot, dt) => {
    if (slot.activeLeft <= 0) return;
    slot.activeLeft -= dt;
    slot.tickLeft -= dt;
    if (slot.tickLeft > 0) return;
    slot.tickLeft += spiked.tickInterval;
    bashAround(world, slot, spiked.tickDamageFraction);
  },
  moveSpeedMult: (_world, slot) => (slot.activeLeft > 0 ? spiked.moveSpeedMult : 1),
});

/** Counter Shell (Bond, Shell blocks): every block resets Withdraw, and that bash staggers ×2. */
const counter = MUTATIONS['withdraw.counterShell'].values;
defineMutation('withdraw.counterShell', {
  stats: (s) => {
    s.damage *= counter.damageMult;
  },
  onEvent: (_world, slot, event) => {
    if (event !== 'shellBlock') return;
    slot.cooldownLeft = 0;
    slot.mutState.armed = 1;
  },
  live: (s, _world, slot) => {
    if (slot.mutState.armed) s.knockback *= counter.staggerMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.armed = 0;
  },
});
