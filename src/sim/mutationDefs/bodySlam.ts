import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { MAX_ENEMY_RADIUS, damageEnemy, findNearestEnemy, makeHitInfo, procHit } from '../combat';
import { defineMutation, tideFlood } from '../hooks';
import { dirTo, entitiesOf, forEachEnemyIn, spawnEntity } from './util';

// Body Slam Mutations (docs/moveset/shared/body-slam.md, lapras/README.md).

const bodySlam = MOVES.bodySlam as MeleeMoveDef;

/** Belly Flop (generic): a short hop, then a 360° slam on your own position. */
const flop = MUTATIONS['bodySlam.bellyFlop'].values;
defineMutation('bodySlam.bellyFlop', {
  stats: (s) => {
    s.cooldown *= flop.cooldownMult;
  },
  cast: (world, slot) => {
    const radius = flop.radius * slot.stats.area;
    if (!findNearestEnemy(world, radius + MAX_ENEMY_RADIUS)) return false;
    const landing = spawnEntity(world, 'bodySlam.bellyFlop', world.player.x, world.player.y, flop.delaySeconds);
    landing.radius = radius;
    return true;
  },
  update: (world, slot, dt) => {
    const { player } = world;
    for (const landing of entitiesOf(world, 'bodySlam.bellyFlop')) {
      // Airborne: the slam lands wherever you are when the hop ends.
      landing.x = player.x;
      landing.y = player.y;
      landing.lifeLeft -= dt;
      if (landing.lifeLeft > 0) continue;
      const hit = makeHitInfo(slot.stats, slot);
      forEachEnemyIn(world, landing.x, landing.y, landing.radius, (e) => {
        [hit.dirX, hit.dirY] = dirTo(landing.x, landing.y, e.x, e.y);
        damageEnemy(world, e, slot.stats.damage, hit);
      });
    }
  },
});

/** Shockwave (generic): the slam also sends a ground wave forward that hits once, without paralysis. */
const shock = MUTATIONS['bodySlam.shockwave'].values;
defineMutation('bodySlam.shockwave', {
  stats: (s) => {
    s.damage *= shock.damageMult;
  },
  onCast: (world, slot) => {
    const swing = world.swings[world.swings.length - 1];
    if (!swing) return;
    const wave = spawnEntity(world, 'bodySlam.shockwave', swing.x, swing.y, shock.waveLength / shock.waveSpeed);
    wave.vx = swing.dirX * shock.waveSpeed;
    wave.vy = swing.dirY * shock.waveSpeed;
    wave.radius = shock.waveRadius * slot.stats.area;
    wave.damage = slot.stats.damage * shock.waveDamageFraction;
  },
  update: (world, slot, dt) => {
    const hit = procHit(slot.stats.attackType);
    for (const wave of entitiesOf(world, 'bodySlam.shockwave')) {
      wave.x += wave.vx * dt;
      wave.y += wave.vy * dt;
      wave.lifeLeft -= dt;
      forEachEnemyIn(world, wave.x, wave.y, wave.radius, (e) => {
        if (wave.hitIds.includes(e.id)) return;
        wave.hitIds.push(e.id);
        damageEnemy(world, e, wave.damage, hit);
      });
    }
  },
});

/** Surging Slam (Bond, level-up, Tide): each level-up empowers the next Body Slams: 360° and a longer paralysis. */
const surge = MUTATIONS['bodySlam.surge'];
defineMutation('bodySlam.surge', {
  stats: (s) => {
    s.damage *= surge.values.damageMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'levelUp') return;
    const tide = tideFlood(world) ? surge.tide.flood : surge.tide.ebb;
    slot.mutState.empowered = (slot.mutState.empowered ?? 0) + tide.empoweredSlams;
  },
  live: (s, _world, slot) => {
    if (!slot.mutState.empowered) return;
    s.arcMult *= 360 / bodySlam.arcDegrees;
    s.stun = Math.max(s.stun, surge.values.paralyseSeconds);
  },
  onCast: (_world, slot) => {
    if (slot.mutState.empowered) slot.mutState.empowered -= 1;
  },
});
