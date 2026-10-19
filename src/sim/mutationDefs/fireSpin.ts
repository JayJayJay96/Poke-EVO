import { MOVES, type OrbitMoveDef } from '../../data/moves';
import { damageEnemy, procHit } from '../combat';
import { orbitBalls, orbitCenter } from '../forms/orbit';
import { BLAST_SECONDS } from '../forms/projectile';
import { defineMutation, hpBelow } from '../hooks';
import { spawnScorch } from '../terrain';
import { dirTo, forEachEnemyIn, ranked } from './util';

// Fire Spin Mutations (docs/moveset/shared/fire-spin.md, charmander/README.md).

const fireSpin = MOVES.fireSpin as OrbitMoveDef;

/** Vortex (generic): when the spin ends, the flames collapse onto you and blast outward once. */
const vortex = ranked('fireSpin.vortex');
defineMutation('fireSpin.vortex', {
  stats: (s, _world, slot) => {
    s.cooldown *= vortex(slot).cooldownMult;
  },
  onExpire: (world, slot) => {
    const { x, y } = orbitCenter(slot, world.player);
    const v = vortex(slot);
    const radius = v.burstRadius * slot.stats.area;
    const hit = procHit(slot.stats.attackType);
    forEachEnemyIn(world, x, y, radius, (e) => {
      [hit.dirX, hit.dirY] = dirTo(x, y, e.x, e.y);
      damageEnemy(world, e, slot.stats.damage * v.burstDamageMult, hit);
    });
    world.blasts.push({ x, y, radius, lifeLeft: BLAST_SECONDS * 2, type: 'Fire' });
  },
});

/** Flame Trail (generic): each flame drops Scorch along its path (shared Fire terrain, cap 6). */
const trail = ranked('fireSpin.flameTrail');
defineMutation('fireSpin.flameTrail', {
  stats: (s, _world, slot) => {
    s.damage *= trail(slot).damageMult;
  },
  update: (world, slot, dt) => {
    if (slot.activeLeft <= 0) return;
    slot.mutState.trail = (slot.mutState.trail ?? 0) - dt;
    if (slot.mutState.trail > 0) return;
    slot.mutState.trail = trail(slot).scorchEvery;
    for (const ball of orbitBalls(slot, fireSpin, world.player)) spawnScorch(world, ball.x, ball.y, slot.stats.damage);
  },
});

/** Tail Flame (Bond, missing HP): like Charmander's tail, the flames grow as HP drops, and burn when low. */
const tail = ranked('fireSpin.tailFlame');
defineMutation('fireSpin.tailFlame', {
  stats: (s, _world, slot) => {
    s.damage *= tail(slot).damageMult;
  },
  live: (s, world, slot) => {
    const v = tail(slot);
    if (hpBelow(world, v.hpTwoFlames)) {
      s.extraCount += 2;
      s.burnPct += v.burnPct;
    } else if (hpBelow(world, v.hpOneFlame)) {
      s.extraCount += 1;
    }
  },
});
