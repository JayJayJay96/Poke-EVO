import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { canTrap, findNearestEnemy, pushEnemy } from '../combat';
import { cutAt, ringAt } from '../forms/zoneCast';
import { defineMutation } from '../hooks';
import type { MoveSlot, World } from '../types';
import { dirTo, forEachEnemyIn, nearestEnemies, ranked, signatureTier } from './util';

// Abra signature Mutations: Confusion → Psychic → Expanding Force (docs/moveset/abra §4, D56).
// Each keeps its earlier tiers (rule 10).

function zoneDef(slot: MoveSlot): ZoneMoveDef {
  return MOVES[slot.moveId] as ZoneMoveDef;
}

/** The burst at one spot, with the Expanding Force ring when the move has one. */
function burstAt(world: World, slot: MoveSlot, x: number, y: number, damage: number, ring: boolean): void {
  const def = zoneDef(slot);
  const radius = def.radius * slot.stats.area;
  cutAt(world, slot, x, y, radius, damage);
  if (ring && def.ring) ringAt(world, slot, x, y, radius, def.ring.radius * slot.stats.area, damage * def.ring.damageFraction);
}

// ── A. Mind Lock ────────────────────────────────────────────────────────
const lock = ranked('confusion.mindLock');
defineMutation('confusion.mindLock', {
  stats: (s, _world, slot) => {
    s.damage *= lock(slot).damageMult;
  },
  onHit: (world, slot, enemy) => {
    const v = lock(slot);
    const tier = signatureTier(world, slot);
    enemy.psyMarkLeft = Math.max(enemy.psyMarkLeft, tier >= 1 ? v.tier1.markSeconds : v.markSeconds);
    enemy.psyMarkPct = v.markPct + (tier >= 2 ? v.tier2.markBonus : 0);
  },
});

// ── B. Gravity Well ─────────────────────────────────────────────────────
const well = ranked('confusion.gravityWell');
defineMutation('confusion.gravityWell', {
  stats: (s, _world, slot) => {
    s.cooldown *= well(slot).cooldownMult;
  },
  cast: (world, slot) => {
    const def = zoneDef(slot);
    const target = findNearestEnemy(world, def.range);
    if (!target) return false;
    const v = well(slot);
    const tier = signatureTier(world, slot);
    const { x, y } = target;
    const pullRadius = (tier >= 1 ? v.tier1.pullRadius : v.pullRadius) * slot.stats.area;
    const pullPx = tier >= 1 ? v.tier1.pullPx : v.pullPx;
    // Light enemies are drawn in before the burst lands.
    forEachEnemyIn(world, x, y, pullRadius, (e) => {
      if (e === target || !canTrap(e)) return;
      const step = Math.min(pullPx, Math.hypot(e.x - x, e.y - y));
      const [dx, dy] = dirTo(e.x, e.y, x, y);
      e.x += dx * step;
      e.y += dy * step;
    });
    burstAt(world, slot, x, y, slot.stats.damage, true);
    if (tier >= 2 && def.ring) {
      forEachEnemyIn(world, x, y, def.ring.radius * slot.stats.area, (e) => {
        const [dx, dy] = dirTo(x, y, e.x, e.y);
        pushEnemy(e, dx, dy, v.tier2.pushPx);
      });
    }
    return true;
  },
});

// ── C. Psy Split ────────────────────────────────────────────────────────
const split = ranked('confusion.psySplit');
defineMutation('confusion.psySplit', {
  cast: (world, slot) => {
    const v = split(slot);
    const tier = signatureTier(world, slot);
    const { x, y } = world.player;
    const targets = nearestEnemies(world, x, y, zoneDef(slot).range, tier >= 1 ? v.tier1.targets : v.targets);
    if (targets.length === 0) return false;
    for (const e of targets) burstAt(world, slot, e.x, e.y, slot.stats.damage * v.burstMult, tier >= 2 && v.tier2.ringBursts);
    return true;
  },
});
