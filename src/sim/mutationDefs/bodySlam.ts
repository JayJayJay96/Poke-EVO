import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { rankedTide } from '../../data/mutations';
import { MAX_ENEMY_RADIUS, applyNewStun, damageEnemy, findNearestEnemy, makeHitInfo, procHit } from '../combat';
import { defineMutation, tideFlood } from '../hooks';
import { dirTo, entitiesOf, forEachEnemyIn, ranked, spawnEntity } from './util';

// Body Slam Mutations (docs/moveset/shared/body-slam.md, lapras/README.md).

const bodySlam = MOVES.bodySlam as MeleeMoveDef;

/** Belly Flop (generic): a short hop, then a 360° slam on your own position. */
const flop = ranked('bodySlam.bellyFlop');
defineMutation('bodySlam.bellyFlop', {
  stats: (s, _world, slot) => {
    s.cooldown *= flop(slot).cooldownMult;
  },
  cast: (world, slot) => {
    const v = flop(slot);
    const radius = v.radius * slot.stats.area;
    if (!findNearestEnemy(world, radius + MAX_ENEMY_RADIUS)) return false;
    const landing = spawnEntity(world, 'bodySlam.bellyFlop', world.player.x, world.player.y, v.delaySeconds);
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
const shock = ranked('bodySlam.shockwave');
defineMutation('bodySlam.shockwave', {
  stats: (s, _world, slot) => {
    s.damage *= shock(slot).damageMult;
  },
  onCast: (world, slot) => {
    const v = shock(slot);
    const swing = world.swings[world.swings.length - 1];
    if (!swing) return;
    const wave = spawnEntity(world, 'bodySlam.shockwave', swing.x, swing.y, v.waveLength / v.waveSpeed);
    wave.vx = swing.dirX * v.waveSpeed;
    wave.vy = swing.dirY * v.waveSpeed;
    wave.radius = v.waveRadius * slot.stats.area;
    wave.damage = slot.stats.damage * v.waveDamageFraction;
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
const surge = ranked('bodySlam.surge');
defineMutation('bodySlam.surge', {
  stats: (s, _world, slot) => {
    s.damage *= surge(slot).damageMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'levelUp') return;
    const t = rankedTide('bodySlam.surge', slot.mutationRank);
    const tide = tideFlood(world) ? t.flood : t.ebb;
    slot.mutState.empowered = (slot.mutState.empowered ?? 0) + tide.empoweredSlams;
  },
  live: (s, _world, slot) => {
    if (!slot.mutState.empowered) return;
    s.arcMult *= 360 / bodySlam.arcDegrees;
  },
  // The paralysis is a new effect (D21 guard rails): bosses are immune and stun fatigue applies.
  onHit: (_world, slot, enemy) => {
    if (slot.mutState.empowered) applyNewStun(enemy, surge(slot).paralyseSeconds, 'paralysis');
  },
  onCast: (_world, slot) => {
    if (slot.mutState.empowered) slot.mutState.empowered -= 1;
  },
});
