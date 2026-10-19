import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { applyVuln, damageEnemy } from '../combat';
import { defineMutation, hpBelow } from '../hooks';
import { spawnZone } from '../zones';
import { forEachEnemyIn, ranked } from './util';

// Sludge Mutations (docs/moveset/shared/sludge.md, bulbasaur/README.md).

/** Pools tick like Poison Powder's cloud. */
const POOL_TICK = (MOVES.poisonPowder as ZoneMoveDef).tickInterval;

/** Sludge Pool (generic): the glob leaves a toxic pool that poisons anyone walking through. */
const pool = ranked('sludge.pool');
defineMutation('sludge.pool', {
  stats: (s, _world, slot) => {
    s.damage *= pool(slot).damageMult;
  },
  onProjectileHit: (world, slot, proj) => {
    const v = pool(slot);
    spawnZone(
      world,
      proj.x,
      proj.y,
      v.radius * slot.stats.area,
      v.seconds * slot.stats.zoneDurationMult,
      POOL_TICK,
      0,
      0,
      { slow: 0, stun: 0, poisonDps: proj.hit.poisonDps * v.poolPoisonFraction, attackType: proj.hit.attackType },
      'sludge',
    );
  },
});

/** Acid (generic): hit enemies take more damage from every source for a while. */
const acid = ranked('sludge.acid');
defineMutation('sludge.acid', {
  stats: (s, _world, slot) => {
    s.damage *= acid(slot).damageMult;
  },
  onHit: (_world, slot, enemy) => {
    applyVuln(enemy, acid(slot).damageTakenPct, acid(slot).debuffSeconds, null);
  },
});

/** Sludge Bomb (Bond, HP below 50%): when you're hurt the glob bursts in a splash and poisons twice as hard. */
const bomb = ranked('sludge.sludgeBomb');
defineMutation('sludge.sludgeBomb', {
  live: (s, world, slot) => {
    const v = bomb(slot);
    if (hpBelow(world, v.hpThreshold)) s.poisonPct *= v.poisonMult;
    else s.damage *= v.damageMultAbove;
  },
  onProjectileHit: (world, slot, proj, primary) => {
    const v = bomb(slot);
    if (!hpBelow(world, v.hpThreshold)) return;
    forEachEnemyIn(world, proj.x, proj.y, v.splashRadius, (e) => {
      if (e !== primary) damageEnemy(world, e, proj.damage * v.splashDamageFraction, proj.hit);
    });
  },
});
