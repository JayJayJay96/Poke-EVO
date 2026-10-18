import { MOVES, type OrbitMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { damageEnemy, procHit } from '../combat';
import { orbitBalls, orbitCenter } from '../forms/orbit';
import { BLAST_SECONDS } from '../forms/projectile';
import { defineMutation, hpBelow } from '../hooks';
import { spawnScorch } from '../terrain';
import { dirTo, forEachEnemyIn } from './util';

// Fire Spin Mutations (docs/moveset/shared/fire-spin.md, charmander/README.md).

const fireSpin = MOVES.fireSpin as OrbitMoveDef;

/** Vortex (generic): when the spin ends, the flames collapse onto you and blast outward once. */
const vortex = MUTATIONS['fireSpin.vortex'].values;
defineMutation('fireSpin.vortex', {
  stats: (s) => {
    s.cooldown *= vortex.cooldownMult;
  },
  onExpire: (world, slot) => {
    const { x, y } = orbitCenter(slot, world.player);
    const radius = vortex.burstRadius * slot.stats.area;
    const hit = procHit(slot.stats.attackType);
    forEachEnemyIn(world, x, y, radius, (e) => {
      [hit.dirX, hit.dirY] = dirTo(x, y, e.x, e.y);
      damageEnemy(world, e, slot.stats.damage * vortex.burstDamageMult, hit);
    });
    world.blasts.push({ x, y, radius, lifeLeft: BLAST_SECONDS * 2, type: 'Fire' });
  },
});

/** Flame Trail (generic): each flame drops Scorch along its path (shared Fire terrain, cap 6). */
const trail = MUTATIONS['fireSpin.flameTrail'].values;
defineMutation('fireSpin.flameTrail', {
  stats: (s) => {
    s.damage *= trail.damageMult;
  },
  update: (world, slot, dt) => {
    if (slot.activeLeft <= 0) return;
    slot.mutState.trail = (slot.mutState.trail ?? 0) - dt;
    if (slot.mutState.trail > 0) return;
    slot.mutState.trail = trail.scorchEvery;
    for (const ball of orbitBalls(slot, fireSpin, world.player)) spawnScorch(world, ball.x, ball.y, slot.stats.damage);
  },
});

/** Tail Flame (Bond, missing HP): like Charmander's tail, the flames grow as HP drops, and burn when low. */
const tail = MUTATIONS['fireSpin.tailFlame'].values;
defineMutation('fireSpin.tailFlame', {
  stats: (s) => {
    s.damage *= tail.damageMult;
  },
  live: (s, world) => {
    if (hpBelow(world, tail.hpTwoFlames)) {
      s.extraCount += 2;
      s.burnPct += tail.burnPct;
    } else if (hpBelow(world, tail.hpOneFlame)) {
      s.extraCount += 1;
    }
  },
});
