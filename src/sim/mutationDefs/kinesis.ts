import { MOVES, type OrbitMoveDef } from '../../data/moves';
import { damageEnemy, procHit } from '../combat';
import { orbitBalls } from '../forms/orbit';
import { ARC_SECONDS } from '../forms/projectile';
import { defineMutation, targetConfused } from '../hooks';
import { nearestEnemies, ranked } from './util';

// Kinesis Mutations (docs/moveset/abra §5, D56).

const kinesis = MOVES.kinesis as OrbitMoveDef;
/** How far Fling Spoons looks for targets. */
const FLING_RANGE = 300;

/** Spoon Guard (generic): spoons eat the enemy shots they touch. */
const guard = ranked('kinesis.spoonGuard');
defineMutation('kinesis.spoonGuard', {
  stats: (s, _world, slot) => {
    s.damage *= guard(slot).damageMult;
  },
  update: (world, slot) => {
    if (slot.activeLeft <= 0 || world.enemyShots.length === 0) return;
    const balls = orbitBalls(slot, kinesis, world.player);
    for (const shot of world.enemyShots) {
      if (balls.some((b) => (b.x - shot.x) ** 2 + (b.y - shot.y) ** 2 <= (b.r + shot.radius) ** 2)) shot.left = 0;
    }
  },
});

/** Fling Spoons (generic): when the orbit ends, the spoons fly at the nearest enemies. */
const fling = ranked('kinesis.fling');
defineMutation('kinesis.fling', {
  stats: (s, _world, slot) => {
    s.cooldown *= fling(slot).cooldownMult;
  },
  onExpire: (world, slot) => {
    const v = fling(slot);
    const { x, y } = world.player;
    const hit = procHit(slot.stats.attackType);
    for (const e of nearestEnemies(world, x, y, FLING_RANGE, v.targets)) {
      damageEnemy(world, e, slot.stats.damage * v.flingFraction, hit);
      world.arcs.push({ x1: x, y1: y, x2: e.x, y2: e.y, lifeLeft: ARC_SECONDS });
    }
  },
});

/** Spoon Bender (Bond, target Confused): spoons always crit Confused enemies and keep them Confused longer. */
const bender = ranked('kinesis.spoonBender');
defineMutation('kinesis.spoonBender', {
  stats: (s, _world, slot) => {
    s.damage *= bender(slot).damageMult;
  },
  forceCrit: (_world, _slot, enemy) => targetConfused(enemy),
  onHit: (_world, slot, enemy) => {
    if (targetConfused(enemy)) enemy.confuseLeft += bender(slot).extendSeconds;
  },
});
