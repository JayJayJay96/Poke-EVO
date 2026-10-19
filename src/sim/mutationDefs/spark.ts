import { MOVES, type OrbitMoveDef } from '../../data/moves';
import { rankedValues } from '../../data/mutations';
import { damageEnemy, makeHitInfo, procHit } from '../combat';
import { orbitBalls } from '../forms/orbit';
import { defineMutation } from '../hooks';
import type { Enemy } from '../types';
import { entitiesOf, forEachEnemyIn, forEachEnemyOnSegment, ranked, spawnEntity } from './util';

// Spark Mutations (docs/moveset/shared/spark.md, pikachu/README.md).

const spark = MOVES.spark as OrbitMoveDef;

/** Arc Pair (generic): the two sparks are joined by a crackling line through you that hits what it sweeps. */
const arc = ranked('spark.arcPair');
defineMutation('spark.arcPair', {
  stats: (s, _world, slot) => {
    s.damage *= arc(slot).damageMult;
  },
  update: (world, slot) => {
    if (slot.activeLeft <= 0) return;
    const balls = orbitBalls(slot, spark, world.player);
    if (balls.length < 2) return;
    const a = balls[0]!;
    const b = balls[Math.floor(balls.length / 2)]!;
    const hit = makeHitInfo(slot.stats, slot);
    forEachEnemyOnSegment(world, a.x, a.y, b.x, b.y, arc(slot).lineWidth, (e) => {
      if (slot.hitCooldowns.has(e.id)) return;
      damageEnemy(world, e, slot.stats.damage, hit);
      slot.hitCooldowns.set(e.id, spark.hitInterval);
    });
  },
});

/** Spark Shower (generic): when the spin ends, the sparks burst into bolts flying outward. */
const shower = ranked('spark.shower');
defineMutation('spark.shower', {
  stats: (s, _world, slot) => {
    s.cooldown *= shower(slot).cooldownMult;
  },
  onExpire: (world, slot) => {
    const { x, y } = world.player;
    const v = shower(slot);
    for (let i = 0; i < v.bolts; i++) {
      const a = (i / v.bolts) * Math.PI * 2;
      const bolt = spawnEntity(world, 'spark.shower', x, y, v.boltRange / v.boltSpeed);
      bolt.vx = Math.cos(a) * v.boltSpeed;
      bolt.vy = Math.sin(a) * v.boltSpeed;
      bolt.radius = v.boltRadius;
      bolt.damage = slot.stats.damage * v.boltDamageFraction;
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
const statik = ranked('spark.staticSpark');
/** One expiry time per extra spark, kept in mutState under these keys (as many as the top rank allows). */
const SPARK_KEYS = Array.from({ length: rankedValues('spark.staticSpark', 3).maxExtraSparks }, (_, i) => `spark${i}`);
defineMutation('spark.staticSpark', {
  stats: (s, _world, slot) => {
    s.cooldown *= statik(slot).cooldownMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'staticProc') return;
    const v = statik(slot);
    const keys = SPARK_KEYS.slice(0, v.maxExtraSparks);
    // Reuse the spark that runs out first.
    let oldest = keys[0]!;
    for (const key of keys) if ((slot.mutState[key] ?? 0) < (slot.mutState[oldest] ?? 0)) oldest = key;
    slot.mutState[oldest] = world.time + v.sparkSeconds;
  },
  live: (s, world, slot) => {
    for (const key of SPARK_KEYS.slice(0, statik(slot).maxExtraSparks)) if ((slot.mutState[key] ?? 0) > world.time) s.extraCount += 1;
  },
});
