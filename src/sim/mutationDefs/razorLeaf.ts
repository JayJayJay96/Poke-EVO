import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { damageEnemy, procHit } from '../combat';
import { castProjectile } from '../forms/projectile';
import { atFullHp, defineMutation } from '../hooks';
import { entitiesOf, spawnEntity } from './util';

// Razor Leaf Mutations (docs/moveset/shared/razor-leaf.md, bulbasaur/README.md).

const razorLeaf = MOVES.razorLeaf as ProjectileMoveDef;
/** Each spiral cast turns by the golden angle, so successive casts cover every direction. Engine constant. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Leaf Spiral (generic): the leaves fly out all around you instead of at one target. */
const spiral = MUTATIONS['razorLeaf.spiral'].values;
defineMutation('razorLeaf.spiral', {
  stats: (s) => {
    s.damage *= spiral.damageMult;
  },
  cast: (world, slot) => {
    const before = world.projectiles.length;
    if (!castProjectile(world, slot, razorLeaf)) return false;
    const fired = world.projectiles.slice(before);
    const base = (slot.mutState.spin ?? 0) + GOLDEN_ANGLE;
    slot.mutState.spin = base;
    fired.forEach((p, i) => {
      const a = base + (i / fired.length) * Math.PI * 2;
      p.vx = Math.cos(a) * p.speed;
      p.vy = Math.sin(a) * p.speed;
    });
    return true;
  },
});

/** Embed (generic): leaves stick in the enemy, then rip out for a second hit. */
const embed = MUTATIONS['razorLeaf.embed'].values;
defineMutation('razorLeaf.embed', {
  stats: (s) => {
    s.damage *= embed.damageMult;
  },
  onHit: (world, slot, enemy) => {
    if (enemy.hp <= 0) return;
    const leaf = spawnEntity(world, 'razorLeaf.embed', enemy.x, enemy.y, embed.embedSeconds);
    leaf.hitIds.push(enemy.id);
    leaf.damage = (slot.stats.damage / embed.damageMult) * embed.ripFraction;
  },
  update: (world, slot, dt) => {
    const hit = procHit(slot.stats.attackType);
    for (const leaf of entitiesOf(world, 'razorLeaf.embed')) {
      const enemy = world.enemies.find((e) => e.id === leaf.hitIds[0] && e.hp > 0);
      if (!enemy) {
        leaf.lifeLeft = 0;
        continue;
      }
      leaf.x = enemy.x;
      leaf.y = enemy.y;
      leaf.lifeLeft -= dt;
      if (leaf.lifeLeft <= 0) damageEnemy(world, enemy, leaf.damage, hit);
    }
  },
});

/** Healthy Growth (Bond, full HP): at full HP, one more leaf and the leaves pierce; weaker when hurt. */
const growth = MUTATIONS['razorLeaf.healthyGrowth'].values;
defineMutation('razorLeaf.healthyGrowth', {
  live: (s, world) => {
    if (atFullHp(world)) {
      s.extraCount += growth.extraLeaves;
      s.pierce += growth.pierce;
    } else {
      s.damage *= growth.damageMultHurt;
    }
  },
});
