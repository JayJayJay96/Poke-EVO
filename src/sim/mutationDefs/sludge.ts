import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { applyVuln, damageEnemy } from '../combat';
import { defineMutation, hpBelow } from '../hooks';
import { spawnZone } from '../zones';
import { forEachEnemyIn } from './util';

// Sludge Mutations (docs/moveset/shared/sludge.md, bulbasaur/README.md).

/** Pools tick like Poison Powder's cloud. */
const POOL_TICK = (MOVES.poisonPowder as ZoneMoveDef).tickInterval;

/** Sludge Pool (generic): the glob leaves a toxic pool that poisons anyone walking through. */
const pool = MUTATIONS['sludge.pool'].values;
defineMutation('sludge.pool', {
  stats: (s) => {
    s.damage *= pool.damageMult;
  },
  onProjectileHit: (world, slot, proj) => {
    spawnZone(
      world,
      proj.x,
      proj.y,
      pool.radius * slot.stats.area,
      pool.seconds * slot.stats.zoneDurationMult,
      POOL_TICK,
      0,
      0,
      { slow: 0, stun: 0, poisonDps: proj.hit.poisonDps * pool.poolPoisonFraction, attackType: proj.hit.attackType },
      'sludge',
    );
  },
});

/** Acid (generic): hit enemies take more damage from every source for a while. */
const acid = MUTATIONS['sludge.acid'].values;
defineMutation('sludge.acid', {
  stats: (s) => {
    s.damage *= acid.damageMult;
  },
  onHit: (_world, _slot, enemy) => {
    applyVuln(enemy, acid.damageTakenPct, acid.debuffSeconds, null);
  },
});

/** Sludge Bomb (Bond, HP below 50%): when you're hurt the glob bursts in a splash and poisons twice as hard. */
const bomb = MUTATIONS['sludge.sludgeBomb'].values;
defineMutation('sludge.sludgeBomb', {
  live: (s, world) => {
    if (hpBelow(world, bomb.hpThreshold)) s.poisonPct *= bomb.poisonMult;
    else s.damage *= bomb.damageMultAbove;
  },
  onProjectileHit: (world, _slot, proj, primary) => {
    if (!hpBelow(world, bomb.hpThreshold)) return;
    forEachEnemyIn(world, proj.x, proj.y, bomb.splashRadius, (e) => {
      if (e !== primary) damageEnemy(world, e, proj.damage * bomb.splashDamageFraction, proj.hit);
    });
  },
});
