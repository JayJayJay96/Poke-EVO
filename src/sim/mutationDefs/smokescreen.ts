import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { findNearestEnemy } from '../combat';
import { defineMutation } from '../hooks';
import type { World } from '../types';
import { spawnZone } from '../zones';
import { ranked } from './util';

// Smokescreen Mutations (docs/moveset/shared/smokescreen.md, charmander/README.md).

const smokescreen = MOVES.smokescreen as ZoneMoveDef;
const BLIND = smokescreen.onHit?.blind ?? 0;

/** Choking Smoke (generic): the cloud also damages everyone inside; smaller. */
const choke = ranked('smokescreen.chokingSmoke');
defineMutation('smokescreen.chokingSmoke', {
  stats: (s, _world, slot) => {
    s.area *= choke(slot).radiusMult;
    // The cloud ticks every smokescreen.tickInterval (0.5 s, the doc's tick).
    s.damage += choke(slot).tickDamage;
  },
});

/** Smoke Trail (generic): instead of one cloud, short-lived puffs fall behind you while you move. */
const trail = ranked('smokescreen.smokeTrail');
defineMutation('smokescreen.smokeTrail', {
  stats: (s, _world, slot) => {
    s.cooldown *= trail(slot).cooldownMult;
  },
  cast: (world, slot) => {
    if (!findNearestEnemy(world, smokescreen.range)) return false;
    slot.mutState.trailLeft = trail(slot).trailSeconds;
    slot.mutState.puffLeft = 0;
    return true;
  },
  update: (world, slot, dt) => {
    if (!slot.mutState.trailLeft) return;
    slot.mutState.trailLeft = Math.max(0, slot.mutState.trailLeft - dt);
    if (world.player.movingFor <= 0) return;
    slot.mutState.puffLeft = (slot.mutState.puffLeft ?? 0) - dt;
    if (slot.mutState.puffLeft > 0) return;
    const v = trail(slot);
    slot.mutState.puffLeft += v.puffEvery;
    const s = slot.stats;
    spawnZone(
      world,
      world.player.x,
      world.player.y,
      v.puffRadius * s.area,
      v.puffSeconds * s.duration,
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
const hidden = ranked('smokescreen.hiddenFlame');
defineMutation('smokescreen.hiddenFlame', {
  stats: (s, _world, slot) => {
    s.area *= hidden(slot).radiusMult;
    s.cooldown *= hidden(slot).cooldownMult;
  },
  fakesBlaze: (world) => inOwnSmoke(world),
});
