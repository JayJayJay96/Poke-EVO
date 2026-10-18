import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { damageEnemy, procHit } from '../combat';
import { castProjectile } from '../forms/projectile';
import { defineMutation } from '../hooks';
import type { Enemy, Projectile, World } from '../types';
import { entitiesOf, fireScaled, forEachEnemyIn, spawnEntity } from './util';

// Flash Cannon Mutations (docs/moveset/shared/flash-cannon.md, squirtle/README.md).

const flashCannon = MOVES.flashCannon as ProjectileMoveDef;

/** Shrapnel (generic): at max range or on its last pierce, the shot shatters into a ring of shards. */
const shrapnel = MUTATIONS['flashCannon.shrapnel'].values;

function shatter(world: World, proj: Projectile): void {
  for (let i = 0; i < shrapnel.shards; i++) {
    const a = (i / shrapnel.shards) * Math.PI * 2;
    const shard = spawnEntity(world, 'flashCannon.shrapnel', proj.x, proj.y, shrapnel.shardRange / shrapnel.shardSpeed);
    shard.vx = Math.cos(a) * shrapnel.shardSpeed;
    shard.vy = Math.sin(a) * shrapnel.shardSpeed;
    shard.radius = shrapnel.shardRadius;
    shard.damage = proj.damage * shrapnel.shardDamageFraction;
  }
}

defineMutation('flashCannon.shrapnel', {
  stats: (s) => {
    s.cooldown *= shrapnel.cooldownMult;
  },
  // The hook runs before the pierce check: no pierce left means this hit ends the shot.
  onProjectileHit: (world, _slot, proj) => {
    if (proj.pierceLeft === 0 && !proj.returns) shatter(world, proj);
  },
  onProjectileExpire: (world, _slot, proj) => shatter(world, proj),
  update: (world, _slot, dt) => {
    const hit = procHit('Steel');
    for (const shard of entitiesOf(world, 'flashCannon.shrapnel')) {
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.lifeLeft -= dt;
      let target: Enemy | null = null;
      forEachEnemyIn(world, shard.x, shard.y, shard.radius, (e) => {
        target ??= e;
      });
      if (!target) continue;
      damageEnemy(world, target, shard.damage, hit);
      shard.lifeLeft = 0;
    }
  },
});

/** Railgun (generic): fires where you're moving instead of auto-aiming; pierces everything, faster, harder. */
const railgun = MUTATIONS['flashCannon.railgun'].values;
defineMutation('flashCannon.railgun', {
  stats: (s) => {
    s.speedMult *= railgun.speedMult;
    s.damage *= railgun.damageMult;
    s.pierce = Number.MAX_SAFE_INTEGER;
  },
  cast: (world, slot) => {
    const before = world.projectiles.length;
    if (!castProjectile(world, slot, flashCannon)) return false;
    const { faceX, faceY } = world.player;
    for (const p of world.projectiles.slice(before)) {
      p.vx = faceX * p.speed;
      p.vy = faceY * p.speed;
    }
    return true;
  },
});

/** Armor Rounds (Bond, hit taken, Blastoise): if you took a hit since the last shot, a second round follows. */
const armor = MUTATIONS['flashCannon.armorRounds'].values;
defineMutation('flashCannon.armorRounds', {
  stats: (s) => {
    s.damage *= armor.damageMult;
  },
  onEvent: (_world, slot, event) => {
    if (event === 'hitTaken') slot.mutState.armed = 1;
  },
  cast: (world, slot) => {
    if (!castProjectile(world, slot, flashCannon)) return false;
    if (slot.mutState.armed) {
      slot.mutState.armed = 0;
      // The extra round is a copy (rule 5): plain damage, no Lifesteal or hooks.
      for (const p of fireScaled(world, slot, flashCannon, armor.secondRoundFraction, 1) ?? []) {
        p.hit.fromProc = true;
        p.hit.lifesteal = 0;
      }
    }
    return true;
  },
});
