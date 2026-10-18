import { MOVES, type BeamMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { damageEnemy, findNearestEnemy, makeHitInfo } from '../combat';
import { defineMutation, healPlayer } from '../hooks';
import { entitiesOf, forEachEnemyIn, spawnEntity } from './util';

// Hydro Pump Mutations (docs/moveset/shared/hydro-pump.md; Bonds in squirtle/ and lapras/).

const hydroPump = MOVES.hydroPump as BeamMoveDef;

/** Split Stream (generic): two beams at ±30°, each weaker. */
const split = MUTATIONS['hydroPump.splitStream'].values;
const SPLIT = (split.angleDeg * Math.PI) / 180;
defineMutation('hydroPump.splitStream', {
  stats: (s) => {
    s.damage *= split.beamDamageFraction;
  },
  beamDirs: (_world, slot) => {
    const base = Math.atan2(slot.dirY, slot.dirX);
    return [
      [Math.cos(base - SPLIT), Math.sin(base - SPLIT)],
      [Math.cos(base + SPLIT), Math.sin(base + SPLIT)],
    ];
  },
});

/** Pressure Build (generic): each tick hits harder than the last, and the beam lasts longer. A boss killer. */
const pressure = MUTATIONS['hydroPump.pressureBuild'].values;
defineMutation('hydroPump.pressureBuild', {
  stats: (s) => {
    s.duration *= pressure.durationMult;
    s.cooldown *= pressure.cooldownMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.total = slot.activeLeft;
  },
  live: (s, _world, slot) => {
    if (slot.activeLeft <= 0) return; // the first tick of a cast is a plain tick
    const ticks = Math.floor((slot.mutState.total! - slot.activeLeft) / hydroPump.tickInterval);
    s.damage *= 1 + pressure.rampPerTick * ticks;
  },
});

/**
 * Rain Cannon (Bond, healing, Blastoise): the pump fires straight up and rains on a circle around you
 * for the beam's duration; each tick heals you per enemy hit (capped). No push, no beam.
 */
const rain = MUTATIONS['hydroPump.rainCannon'].values;
defineMutation('hydroPump.rainCannon', {
  stats: (s) => {
    s.damage *= rain.damageMult;
    s.knockback *= rain.pushMult;
  },
  cast: (world, slot) => {
    const radius = rain.radius * slot.stats.area;
    if (!findNearestEnemy(world, radius)) return false;
    slot.activeLeft = hydroPump.duration * slot.stats.duration;
    slot.tickLeft = 0;
    const cloud = spawnEntity(world, 'hydroPump.rainCannon', world.player.x, world.player.y, slot.activeLeft);
    cloud.radius = radius;
    return true;
  },
  beamDirs: () => [], // the rain replaces the beam
  update: (world, slot, dt) => {
    for (const cloud of entitiesOf(world, 'hydroPump.rainCannon')) {
      cloud.x = world.player.x;
      cloud.y = world.player.y;
      cloud.lifeLeft -= dt;
      cloud.timer -= dt;
      if (cloud.timer > 0) continue;
      cloud.timer += hydroPump.tickInterval;
      const hit = makeHitInfo(slot.stats, slot);
      let hits = 0;
      forEachEnemyIn(world, cloud.x, cloud.y, cloud.radius, (e) => {
        damageEnemy(world, e, slot.stats.damage, hit);
        hits++;
      });
      healPlayer(world, Math.min(hits * rain.healPerEnemy, rain.maxHealPerSec * hydroPump.tickInterval));
    }
  },
});
