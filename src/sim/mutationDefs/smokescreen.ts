import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { findNearestEnemy } from '../combat';
import { defineMutation } from '../hooks';
import type { World } from '../types';
import { spawnZone } from '../zones';

// Smokescreen Mutations (docs/moveset/shared/smokescreen.md, charmander/README.md).

const smokescreen = MOVES.smokescreen as ZoneMoveDef;
const BLIND = smokescreen.onHit?.blind ?? 0;

/** Choking Smoke (generic): the cloud also damages everyone inside; smaller. */
const choke = MUTATIONS['smokescreen.chokingSmoke'].values;
defineMutation('smokescreen.chokingSmoke', {
  stats: (s) => {
    s.area *= choke.radiusMult;
    // The cloud ticks every smokescreen.tickInterval (0.5 s, the doc's tick).
    s.damage += choke.tickDamage;
  },
});

/** Smoke Trail (generic): instead of one cloud, short-lived puffs fall behind you while you move. */
const trail = MUTATIONS['smokescreen.smokeTrail'].values;
defineMutation('smokescreen.smokeTrail', {
  stats: (s) => {
    s.cooldown *= trail.cooldownMult;
  },
  cast: (world, slot) => {
    if (!findNearestEnemy(world, smokescreen.range)) return false;
    slot.mutState.trailLeft = trail.trailSeconds;
    slot.mutState.puffLeft = 0;
    return true;
  },
  update: (world, slot, dt) => {
    if (!slot.mutState.trailLeft) return;
    slot.mutState.trailLeft = Math.max(0, slot.mutState.trailLeft - dt);
    if (world.player.movingFor <= 0) return;
    slot.mutState.puffLeft = (slot.mutState.puffLeft ?? 0) - dt;
    if (slot.mutState.puffLeft > 0) return;
    slot.mutState.puffLeft += trail.puffEvery;
    const s = slot.stats;
    spawnZone(
      world,
      world.player.x,
      world.player.y,
      trail.puffRadius * s.area,
      trail.puffSeconds * s.duration,
      smokescreen.tickInterval,
      0,
      0,
      { slow: 0, stun: 0, poisonDps: 0, attackType: s.attackType, blind: BLIND },
      'smokescreen',
    );
  },
});

/** The player stands inside one of their own Smokescreen clouds (`inOwnSmoke`). */
function inOwnSmoke(world: World): boolean {
  const { x, y } = world.player;
  return world.zones.some((z) => z.source === 'smokescreen' && z.lifeLeft > 0 && (x - z.x) ** 2 + (y - z.y) ** 2 <= z.radius ** 2);
}

/** Hidden Flame (Bond, in your own smoke): Blaze counts as active while you stand in your smaller cloud. */
const hidden = MUTATIONS['smokescreen.hiddenFlame'].values;
defineMutation('smokescreen.hiddenFlame', {
  stats: (s) => {
    s.area *= hidden.radiusMult;
    s.cooldown *= hidden.cooldownMult;
  },
  fakesBlaze: (world) => inOwnSmoke(world),
});
