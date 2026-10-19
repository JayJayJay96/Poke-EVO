import { TUNING } from '../../data/content';
import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { enemySpeedFactor } from '../combat';
import { ARC_SECONDS } from '../forms/projectile';
import { defineMutation, mutationMoveSpeedMult } from '../hooks';
import type { Enemy } from '../types';
import { dirTo, ranked } from './util';

// Electro Ball Mutations (docs/moveset/shared/electro-ball.md, pikachu/README.md).

const electroBall = MOVES.electroBall as ProjectileMoveDef;

/** Ricochet (generic): instead of rolling through, the ball bounces from enemy to enemy (inside the chain cap). */
const ricochet = ranked('electroBall.ricochet');
defineMutation('electroBall.ricochet', {
  stats: (s, _world, slot) => {
    s.pierce -= electroBall.pierce ?? 0; // the bounce replaces the innate pierce
    s.damage *= ricochet(slot).damageMult;
  },
  onProjectileHit: (world, slot, proj, from) => {
    if (proj.tag >= ricochet(slot).maxBounces) return;
    let next: Enemy | null = null;
    let best = TUNING.chain.range * TUNING.chain.range;
    for (const e of world.enemies) {
      if (e.hp <= 0 || e === from || proj.hitIds.includes(e.id)) continue;
      const d2 = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d2 <= best) {
        best = d2;
        next = e;
      }
    }
    const target = next as Enemy | null;
    if (!target) return;
    const [dx, dy] = dirTo(proj.x, proj.y, target.x, target.y);
    proj.vx = dx * proj.speed;
    proj.vy = dy * proj.speed;
    proj.pierceLeft += 1; // survives this hit
    proj.tag += 1;
    world.arcs.push({ x1: from.x, y1: from.y, x2: target.x, y2: target.y, lifeLeft: ARC_SECONDS });
  },
});

/** Plasma Orb (generic): the ball grows and hits harder as it rolls; slower. */
const plasma = ranked('electroBall.plasma');
defineMutation('electroBall.plasma', {
  stats: (s, _world, slot) => {
    s.speedMult *= plasma(slot).speedMult;
    s.damage *= plasma(slot).damageMult;
  },
  update: (world, slot) => {
    const total = electroBall.projectileLifetime * slot.stats.duration;
    const v = plasma(slot);
    for (const p of world.projectiles) {
      if (p.dead || p.hit.slot !== slot) continue;
      const progress = Math.min(1, Math.max(0, 1 - p.lifeLeft / total));
      p.radius = electroBall.projectileRadius * slot.stats.area * (1 + (v.maxRadiusMult - 1) * progress);
      p.damage = slot.stats.damage * (1 + v.maxDamageBonus * progress);
    }
  },
});

/** Velocity Ball (Bond, move speed): like the real move: the faster you are than the target, the harder it hits. */
const velocity = ranked('electroBall.velocityBall');
defineMutation('electroBall.velocityBall', {
  stats: (s, _world, slot) => {
    s.damage *= velocity(slot).damageMult;
  },
  damageMult: (world, slot, enemy) => {
    const v = velocity(slot);
    const mine = world.player.speed * mutationMoveSpeedMult(world);
    const theirs = enemy.speed * enemySpeedFactor(enemy);
    const ratio = theirs > 0 ? mine / theirs : Infinity;
    return 1 + Math.min(v.maxBonus, Math.max(0, (ratio - 1) * v.bonusPerSpeedRatio));
  },
});
