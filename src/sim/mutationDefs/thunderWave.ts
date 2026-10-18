import { TUNING } from '../../data/content';
import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { applyNewStun, applyVuln, damageEnemy, findNearestEnemy, makeHitInfo } from '../combat';
import { defineMutation } from '../hooks';
import type { Enemy, World } from '../types';
import { entitiesOf, forEachEnemyIn, spawnEntity } from './util';

// Thunder Wave Mutations (docs/moveset/shared/thunder-wave.md, pikachu/README.md).

const thunderWave = MOVES.thunderWave as ZoneMoveDef;

/** Static Pulse (generic): a ring expands from you and paralyses everything it passes, once. */
const pulse = MUTATIONS['thunderWave.pulse'].values;
defineMutation('thunderWave.pulse', {
  stats: (s) => {
    s.stun = 0; // the ring paralyses instead
  },
  cast: (world, slot) => {
    const radius = pulse.ringRadius * slot.stats.area;
    if (!findNearestEnemy(world, radius)) return false;
    const ring = spawnEntity(world, 'thunderWave.pulse', world.player.x, world.player.y, pulse.ringSeconds);
    ring.x2 = radius; // full radius, for growth and drawing
    return true;
  },
  update: (world, slot, dt) => {
    for (const ring of entitiesOf(world, 'thunderWave.pulse')) {
      ring.lifeLeft -= dt;
      ring.radius = ring.x2 * Math.min(1, 1 - ring.lifeLeft / pulse.ringSeconds);
      const hit = makeHitInfo(slot.stats, slot);
      forEachEnemyIn(world, ring.x, ring.y, ring.radius, (e) => {
        if (ring.hitIds.includes(e.id)) return;
        ring.hitIds.push(e.id);
        damageEnemy(world, e, slot.stats.damage, hit);
        if (e.hp > 0) applyNewStun(e, pulse.paralyseSeconds, 'paralysis');
      });
    }
  },
});

/** Electric Terrain (generic): a longer field that makes your Electric moves hit harder inside it; no paralysis. */
const terrain = MUTATIONS['thunderWave.terrain'].values;
defineMutation('thunderWave.terrain', {
  stats: (s) => {
    s.stun = 0;
    s.zoneDurationMult *= terrain.fieldSeconds / thunderWave.duration;
    s.damage *= terrain.fieldDamageMult;
  },
  update: (world) => {
    for (const zone of world.zones) {
      if (zone.source !== 'thunderWave' || zone.lifeLeft <= 0) continue;
      forEachEnemyIn(world, zone.x, zone.y, zone.radius, (e) =>
        applyVuln(e, terrain.electricBonus, TUNING.status.burnTick, 'Electric'),
      );
    }
  },
});

/** Conductor (Bond, chain jump): your signature chain prefers enemies in Thunder Wave fields and jumps further between them. */
const conductor = MUTATIONS['thunderWave.conductor'].values;

function inField(world: World, e: Enemy): boolean {
  return world.zones.some(
    (z) => z.source === 'thunderWave' && z.lifeLeft > 0 && (e.x - z.x) ** 2 + (e.y - z.y) ** 2 <= (z.radius + e.radius) ** 2,
  );
}

defineMutation('thunderWave.conductor', {
  stats: (s) => {
    s.stun = conductor.paralyseSeconds;
  },
  chainBias: (world, _slot, from, to) => {
    const toIn = inField(world, to);
    return { preferred: toIn, rangeMult: toIn && inField(world, from) ? conductor.jumpRangeMult : 1 };
  },
});
