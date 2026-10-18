import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { MAX_ENEMY_RADIUS, applyNewStun, damageEnemy, findNearestEnemy, makeHitInfo, procHit } from '../combat';
import { ARC_SECONDS } from '../forms/projectile';
import { defineMutation, targetParalysed } from '../hooks';
import { dirTo, entitiesOf, forEachEnemyIn, nearestEnemies, spawnEntity } from './util';

// Iron Tail Mutations (docs/moveset/shared/iron-tail.md, pikachu/README.md).

const ironTail = MOVES.ironTail as MeleeMoveDef;

/** Iron Spin (generic): a full 360° tail spin, shorter and weaker. */
const spin = MUTATIONS['ironTail.spin'].values;
defineMutation('ironTail.spin', {
  stats: (s) => {
    s.arcMult *= 360 / ironTail.arcDegrees;
    s.reachMult *= spin.reachMult;
    s.damage *= spin.damageMult;
  },
});

/** Iron Slam (generic): the tail slams the ground at the target after a short telegraph, stunning what it hits. */
const slam = MUTATIONS['ironTail.slam'].values;
defineMutation('ironTail.slam', {
  stats: (s) => {
    s.cooldown *= slam.cooldownMult;
  },
  cast: (world, slot) => {
    const target = findNearestEnemy(world, ironTail.reach * slot.stats.area * slot.stats.reachMult + MAX_ENEMY_RADIUS);
    if (!target) return false;
    const mark = spawnEntity(world, 'ironTail.slam', target.x, target.y, slam.telegraphSeconds);
    mark.radius = slam.radius * slot.stats.area;
    return true;
  },
  update: (world, slot, dt) => {
    for (const mark of entitiesOf(world, 'ironTail.slam')) {
      mark.lifeLeft -= dt;
      if (mark.lifeLeft > 0) continue;
      const hit = makeHitInfo(slot.stats, slot);
      forEachEnemyIn(world, mark.x, mark.y, mark.radius, (e) => {
        [hit.dirX, hit.dirY] = dirTo(mark.x, mark.y, e.x, e.y);
        damageEnemy(world, e, slot.stats.damage, hit);
        if (e.hp > 0) applyNewStun(e, slam.stunSeconds);
      });
    }
  },
});

/** Shock Shatter (Bond, target paralysed): hitting a paralysed enemy shatters the paralysis for big damage that leaps on. */
const shatter = MUTATIONS['ironTail.shockShatter'].values;
defineMutation('ironTail.shockShatter', {
  damageMult: (_world, _slot, enemy) => (targetParalysed(enemy) ? shatter.shatterMult : shatter.damageMultNotParalysed),
  onHit: (world, _slot, enemy, dealt) => {
    if (!targetParalysed(enemy)) return;
    enemy.stunLeft = 0;
    enemy.stunKind = null;
    const next = nearestEnemies(world, enemy.x, enemy.y, shatter.leapRadius, 2).find((e) => e !== enemy);
    if (!next) return;
    damageEnemy(world, next, dealt * shatter.leapDamageFraction, procHit('Electric'));
    world.arcs.push({ x1: enemy.x, y1: enemy.y, x2: next.x, y2: next.y, lifeLeft: ARC_SECONDS });
  },
});
