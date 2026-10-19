import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { damageEnemy, procHit } from '../combat';
import { castProjectile } from '../forms/projectile';
import { defineMutation } from '../hooks';
import type { MoveSlot, Projectile, World } from '../types';
import { entitiesOf, fireScaled, forEachEnemyIn, ranked, spawnEntity } from './util';

// Flash Cannon Mutations (docs/moveset/shared/flash-cannon.md, squirtle/README.md).

const flashCannon = MOVES.flashCannon as ProjectileMoveDef;

/** Shrapnel (generic): at max range or on its last pierce, the shot shatters into a ring of shards (III: they pierce 1). */
const shrapnel = ranked('flashCannon.shrapnel');

function shatter(world: World, slot: MoveSlot, proj: Projectile): void {
  const v = shrapnel(slot);
  for (let i = 0; i < v.shards; i++) {
    const a = (i / v.shards) * Math.PI * 2;
    const shard = spawnEntity(world, 'flashCannon.shrapnel', proj.x, proj.y, v.shardRange / v.shardSpeed);
    shard.vx = Math.cos(a) * v.shardSpeed;
    shard.vy = Math.sin(a) * v.shardSpeed;
    shard.radius = v.shardRadius;
    shard.damage = proj.damage * v.shardDamageFraction;
    shard.timer = v.shardPierce; // enemies it may still pass through
  }
}

defineMutation('flashCannon.shrapnel', {
  stats: (s, _world, slot) => {
    s.cooldown *= shrapnel(slot).cooldownMult;
  },
  // The hook runs before the pierce check: no pierce left means this hit ends the shot.
  onProjectileHit: (world, slot, proj) => {
    if (proj.pierceLeft === 0 && !proj.returns) shatter(world, slot, proj);
  },
  onProjectileExpire: (world, slot, proj) => shatter(world, slot, proj),
  update: (world, _slot, dt) => {
    const hit = procHit('Steel');
    for (const shard of entitiesOf(world, 'flashCannon.shrapnel')) {
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.lifeLeft -= dt;
      forEachEnemyIn(world, shard.x, shard.y, shard.radius, (e) => {
        if (shard.lifeLeft <= 0 || shard.hitIds.includes(e.id)) return;
        shard.hitIds.push(e.id);
        damageEnemy(world, e, shard.damage, hit);
        if (shard.timer-- <= 0) shard.lifeLeft = 0;
      });
    }
  },
});

/** Railgun (generic): fires where you're moving instead of auto-aiming; pierces everything, faster, harder. */
const railgun = ranked('flashCannon.railgun');
defineMutation('flashCannon.railgun', {
  stats: (s, _world, slot) => {
    s.speedMult *= railgun(slot).speedMult;
    s.damage *= railgun(slot).damageMult;
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
const armor = ranked('flashCannon.armorRounds');
defineMutation('flashCannon.armorRounds', {
  stats: (s, _world, slot) => {
    s.damage *= armor(slot).damageMult;
  },
  onEvent: (_world, slot, event) => {
    if (event === 'hitTaken') slot.mutState.armed = 1;
  },
  cast: (world, slot) => {
    if (!castProjectile(world, slot, flashCannon)) return false;
    if (slot.mutState.armed) {
      slot.mutState.armed = 0;
      // The extra round is a copy (rule 5): plain damage, no Lifesteal or hooks.
      for (const p of fireScaled(world, slot, flashCannon, armor(slot).secondRoundFraction, 1) ?? []) {
        p.hit.fromProc = true;
        p.hit.lifesteal = 0;
      }
    }
    return true;
  },
});
