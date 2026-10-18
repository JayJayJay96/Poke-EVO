import { MOVES, type OrbitMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { damageEnemy, makeHitInfo, procHit } from '../combat';
import { orbitBalls } from '../forms/orbit';
import { defineMutation } from '../hooks';
import type { Enemy } from '../types';
import { entitiesOf, forEachEnemyIn, forEachEnemyOnSegment, spawnEntity } from './util';

// Spark Mutations (docs/moveset/shared/spark.md, pikachu/README.md).

const spark = MOVES.spark as OrbitMoveDef;

/** Arc Pair (generic): the two sparks are joined by a crackling line through you that hits what it sweeps. */
const arc = MUTATIONS['spark.arcPair'].values;
defineMutation('spark.arcPair', {
  stats: (s) => {
    s.damage *= arc.damageMult;
  },
  update: (world, slot) => {
    if (slot.activeLeft <= 0) return;
    const balls = orbitBalls(slot, spark, world.player);
    if (balls.length < 2) return;
    const a = balls[0]!;
    const b = balls[Math.floor(balls.length / 2)]!;
    const hit = makeHitInfo(slot.stats, slot);
    forEachEnemyOnSegment(world, a.x, a.y, b.x, b.y, arc.lineWidth, (e) => {
      if (slot.hitCooldowns.has(e.id)) return;
      damageEnemy(world, e, slot.stats.damage, hit);
      slot.hitCooldowns.set(e.id, spark.hitInterval);
    });
  },
});

/** Spark Shower (generic): when the spin ends, the sparks burst into bolts flying outward. */
const shower = MUTATIONS['spark.shower'].values;
defineMutation('spark.shower', {
  stats: (s) => {
    s.cooldown *= shower.cooldownMult;
  },
  onExpire: (world, slot) => {
    const { x, y } = world.player;
    for (let i = 0; i < shower.bolts; i++) {
      const a = (i / shower.bolts) * Math.PI * 2;
      const bolt = spawnEntity(world, 'spark.shower', x, y, shower.boltRange / shower.boltSpeed);
      bolt.vx = Math.cos(a) * shower.boltSpeed;
      bolt.vy = Math.sin(a) * shower.boltSpeed;
      bolt.radius = shower.boltRadius;
      bolt.damage = slot.stats.damage * shower.boltDamageFraction;
    }
  },
  update: (world, _slot, dt) => {
    const hit = procHit('Electric');
    for (const bolt of entitiesOf(world, 'spark.shower')) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.lifeLeft -= dt;
      let target: Enemy | null = null;
      forEachEnemyIn(world, bolt.x, bolt.y, bolt.radius, (e) => {
        target ??= e;
      });
      if (!target) continue;
      damageEnemy(world, target, bolt.damage, hit);
      bolt.lifeLeft = 0;
    }
  },
});

/** Static Spark (Bond, Static paralysis): each Static paralysis adds a spark to your orbit for a while. */
const statik = MUTATIONS['spark.staticSpark'].values;
/** One expiry time per extra spark, kept in mutState under these keys. */
const SPARK_KEYS = Array.from({ length: statik.maxExtraSparks }, (_, i) => `spark${i}`);
defineMutation('spark.staticSpark', {
  stats: (s) => {
    s.cooldown *= statik.cooldownMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'staticProc') return;
    // Reuse the spark that runs out first.
    let oldest = SPARK_KEYS[0]!;
    for (const key of SPARK_KEYS) if ((slot.mutState[key] ?? 0) < (slot.mutState[oldest] ?? 0)) oldest = key;
    slot.mutState[oldest] = world.time + statik.sparkSeconds;
  },
  live: (s, world, slot) => {
    for (const key of SPARK_KEYS) if ((slot.mutState[key] ?? 0) > world.time) s.extraCount += 1;
  },
});
