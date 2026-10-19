import { MOVES, type BeamMoveDef } from '../../data/moves';
import { MUTATIONS, rankedTide } from '../../data/mutations';
import { damageEnemy, findNearestEnemy, makeHitInfo, soak } from '../combat';
import { defineMutation, healPlayer, tideFlood } from '../hooks';
import { entitiesOf, forEachEnemyIn, ranked, spawnEntity } from './util';

// Hydro Pump Mutations (docs/moveset/shared/hydro-pump.md; Bonds in squirtle/ and lapras/).

const hydroPump = MOVES.hydroPump as BeamMoveDef;

/** Split Stream (generic): two beams at ±30°, each weaker. */
const split = ranked('hydroPump.splitStream');
const SPLIT = (MUTATIONS['hydroPump.splitStream'].values.angleDeg * Math.PI) / 180;
defineMutation('hydroPump.splitStream', {
  stats: (s, _world, slot) => {
    s.damage *= split(slot).beamDamageFraction;
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
const pressure = ranked('hydroPump.pressureBuild');
defineMutation('hydroPump.pressureBuild', {
  stats: (s, _world, slot) => {
    s.duration *= pressure(slot).durationMult;
    s.cooldown *= pressure(slot).cooldownMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.total = slot.activeLeft;
  },
  live: (s, _world, slot) => {
    if (slot.activeLeft <= 0) return; // the first tick of a cast is a plain tick
    const ticks = Math.floor((slot.mutState.total! - slot.activeLeft) / hydroPump.tickInterval);
    s.damage *= 1 + pressure(slot).rampPerTick * ticks;
  },
});

/**
 * Rain Cannon (Bond, healing, Blastoise): the pump fires straight up and rains on a circle around you
 * for the beam's duration; each tick heals you per enemy hit (capped). No push, no beam.
 */
const rain = ranked('hydroPump.rainCannon');
defineMutation('hydroPump.rainCannon', {
  stats: (s, _world, slot) => {
    s.damage *= rain(slot).damageMult;
    s.knockback *= rain(slot).pushMult;
  },
  cast: (world, slot) => {
    const radius = rain(slot).radius * slot.stats.area;
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
      const v = rain(slot);
      let hits = 0;
      forEachEnemyIn(world, cloud.x, cloud.y, cloud.radius, (e) => {
        damageEnemy(world, e, slot.stats.damage, hit);
        if (v.rainSoaks) soak(e);
        hits++;
      });
      healPlayer(world, Math.min(hits * v.healPerEnemy, v.maxHealPerSec * hydroPump.tickInterval));
    }
  },
});

/** Pressure Shell (Bond, Shell Armor absorbs, Tide): blocked damage is stored and the next Hydro Pump adds it over its ticks. */
const shell = ranked('hydroPump.pressureShell');
defineMutation('hydroPump.pressureShell', {
  stats: (s, _world, slot) => {
    s.cooldown *= shell(slot).cooldownMult;
  },
  onEvent: (world, slot, event, amount) => {
    if (event !== 'armorAbsorb') return;
    const t = rankedTide('hydroPump.pressureShell', slot.mutationRank);
    const cap = tideFlood(world) ? t.flood.storeCap : t.ebb.storeCap;
    slot.mutState.stored = Math.min(cap, (slot.mutState.stored ?? 0) + amount);
  },
  onCast: (_world, slot) => {
    const stored = slot.mutState.stored ?? 0;
    if (stored <= 0) return;
    const ticks = Math.max(1, Math.round((hydroPump.duration * slot.stats.duration) / hydroPump.tickInterval));
    slot.mutState.bonusPerTick = stored / ticks;
    slot.mutState.stored = 0;
    slot.stats.damage += slot.mutState.bonusPerTick; // live already ran this step; the first tick is now
  },
  live: (s, _world, slot) => {
    if (slot.activeLeft > 0 && slot.mutState.bonusPerTick) s.damage += slot.mutState.bonusPerTick;
  },
  onExpire: (_world, slot) => {
    slot.mutState.bonusPerTick = 0;
  },
});
