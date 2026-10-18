import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { findNearestEnemy } from '../combat';
import { castProjectile } from '../forms/projectile';
import { defineMutation, movingFor } from '../hooks';
import { dirTo } from './util';

// Air Slash Mutations (docs/moveset/shared/air-slash.md, charmander/README.md). Charizard only.

const airSlash = MOVES.airSlash as ProjectileMoveDef;

/** Crosscut (generic): the blades converge on the target from either side; the second one always crits. */
const cross = MUTATIONS['airSlash.crosscut'].values;
defineMutation('airSlash.crosscut', {
  stats: (s) => {
    s.damage *= cross.damageMult;
  },
  cast: (world, slot) => {
    const target = findNearestEnemy(world, airSlash.range);
    if (!target) return false;
    const before = world.projectiles.length;
    if (!castProjectile(world, slot, airSlash)) return false;
    const fired = world.projectiles.slice(before);
    const { x, y } = world.player;
    const [dx, dy] = dirTo(x, y, target.x, target.y);
    fired.forEach((p, i) => {
      const side = fired.length > 1 ? (i / (fired.length - 1)) * 2 - 1 : 0;
      p.x = x - dy * cross.crossOffset * side;
      p.y = y + dx * cross.crossOffset * side;
      const [vx, vy] = dirTo(p.x, p.y, target.x, target.y);
      p.vx = vx * p.speed;
      p.vy = vy * p.speed;
      if (i > 0) p.hit.critChance = 1; // the second cut lands on an open wound
    });
    return true;
  },
});

/** Tailwind (generic): each blade hit gives a short burst of move speed, stacking to a cap. */
const tail = MUTATIONS['airSlash.tailwind'].values;
defineMutation('airSlash.tailwind', {
  stats: (s) => {
    s.damage *= tail.damageMult;
  },
  onHit: (world, slot) => {
    const active = (slot.mutState.until ?? 0) > world.time;
    const stacks = active ? (slot.mutState.stacks ?? 0) : 0;
    slot.mutState.stacks = Math.min(tail.maxSpeedPct / tail.speedPctPerHit, stacks + 1);
    slot.mutState.until = world.time + tail.speedSeconds;
  },
  moveSpeedMult: (world, slot) =>
    (slot.mutState.until ?? 0) > world.time ? 1 + tail.speedPctPerHit * (slot.mutState.stacks ?? 0) : 1,
});

/** Aerial Ace (Bond, moving, Charizard): after a second of flying, the blades home and crit more; standing still costs. */
const ace = MUTATIONS['airSlash.aerialAce'].values;
defineMutation('airSlash.aerialAce', {
  live: (s, world) => {
    if (movingFor(world, ace.movingSeconds)) {
      s.homing = true;
      s.critChance = Math.min(1, s.critChance + ace.critBonus);
    } else if (world.player.movingFor === 0) {
      s.damage *= ace.damageMultStill;
    }
  },
});
