import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { MAX_ENEMY_RADIUS, applyNewStun, damageEnemy, findNearestEnemy, makeHitInfo, procHit } from '../combat';
import { ARC_SECONDS } from '../forms/projectile';
import { defineMutation, targetParalysed } from '../hooks';
import { dirTo, entitiesOf, forEachEnemyIn, nearestEnemies, ranked, spawnEntity } from './util';

// Iron Tail Mutations (docs/moveset/shared/iron-tail.md, pikachu/README.md).

const ironTail = MOVES.ironTail as MeleeMoveDef;

/** Iron Spin (generic): a full 360° tail spin, shorter and weaker. */
const spin = ranked('ironTail.spin');
defineMutation('ironTail.spin', {
  stats: (s, _world, slot) => {
    s.arcMult *= 360 / ironTail.arcDegrees;
    s.reachMult *= spin(slot).reachMult;
    s.damage *= spin(slot).damageMult;
  },
});

/** Iron Slam (generic): the tail slams the ground at the target after a short telegraph, stunning what it hits. */
const slam = ranked('ironTail.slam');
defineMutation('ironTail.slam', {
  stats: (s, _world, slot) => {
    s.cooldown *= slam(slot).cooldownMult;
  },
  cast: (world, slot) => {
    const target = findNearestEnemy(world, ironTail.reach * slot.stats.area * slot.stats.reachMult + MAX_ENEMY_RADIUS);
    if (!target) return false;
    const mark = spawnEntity(world, 'ironTail.slam', target.x, target.y, slam(slot).telegraphSeconds);
    mark.radius = slam(slot).radius * slot.stats.area;
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
        if (e.hp > 0) applyNewStun(e, slam(slot).stunSeconds);
      });
    }
  },
});

/** Shock Shatter (Bond, target paralysed): hitting a paralysed enemy shatters the paralysis for big damage that leaps on. */
const shatter = ranked('ironTail.shockShatter');
defineMutation('ironTail.shockShatter', {
  damageMult: (_world, slot, enemy) =>
    targetParalysed(enemy) ? shatter(slot).shatterMult : shatter(slot).damageMultNotParalysed,
  onHit: (world, slot, enemy, dealt) => {
    if (!targetParalysed(enemy)) return;
    const v = shatter(slot);
    enemy.stunLeft = 0;
    enemy.stunKind = null;
    const next = nearestEnemies(world, enemy.x, enemy.y, v.leapRadius, 2).find((e) => e !== enemy);
    if (!next) return;
    damageEnemy(world, next, dealt * v.leapDamageFraction, procHit('Electric'));
    world.arcs.push({ x1: enemy.x, y1: enemy.y, x2: next.x, y2: next.y, lifeLeft: ARC_SECONDS });
  },
});
