import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { findNearestEnemy } from '../combat';
import { castProjectile } from '../forms/projectile';
import { defineMutation, movingFor } from '../hooks';
import { dirTo, ranked } from './util';

// Air Slash Mutations (docs/moveset/shared/air-slash.md, charmander/README.md). Charizard only.

const airSlash = MOVES.airSlash as ProjectileMoveDef;

/** Crosscut (generic): the blades converge on the target from either side; the second one always crits. */
const cross = ranked('airSlash.crosscut');
defineMutation('airSlash.crosscut', {
  stats: (s, _world, slot) => {
    s.damage *= cross(slot).damageMult;
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
      p.x = x - dy * cross(slot).crossOffset * side;
      p.y = y + dx * cross(slot).crossOffset * side;
      const [vx, vy] = dirTo(p.x, p.y, target.x, target.y);
      p.vx = vx * p.speed;
      p.vy = vy * p.speed;
      if (i > 0) p.hit.critChance = 1; // the second cut lands on an open wound
    });
    return true;
  },
});

/** Tailwind (generic): each blade hit gives a short burst of move speed, stacking to a cap. */
const tail = ranked('airSlash.tailwind');
defineMutation('airSlash.tailwind', {
  stats: (s, _world, slot) => {
    s.damage *= tail(slot).damageMult;
  },
  onHit: (world, slot) => {
    const v = tail(slot);
    const active = (slot.mutState.until ?? 0) > world.time;
    const stacks = active ? (slot.mutState.stacks ?? 0) : 0;
    slot.mutState.stacks = Math.min(v.maxSpeedPct / v.speedPctPerHit, stacks + 1);
    slot.mutState.until = world.time + v.speedSeconds;
  },
  moveSpeedMult: (world, slot) =>
    (slot.mutState.until ?? 0) > world.time ? 1 + tail(slot).speedPctPerHit * (slot.mutState.stacks ?? 0) : 1,
});

/** Aerial Ace (Bond, moving, Charizard): after a second of flying, the blades home and crit more; standing still costs. */
const ace = ranked('airSlash.aerialAce');
defineMutation('airSlash.aerialAce', {
  live: (s, world, slot) => {
    const v = ace(slot);
    if (movingFor(world, v.movingSeconds)) {
      s.homing = true;
      s.critChance = Math.min(1, s.critChance + v.critBonus);
    } else if (world.player.movingFor === 0) {
      s.damage *= v.damageMultStill;
    }
  },
});
