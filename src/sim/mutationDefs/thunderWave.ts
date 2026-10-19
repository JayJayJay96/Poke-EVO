import { TUNING } from '../../data/content';
import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { applyNewStun, applyVuln, damageEnemy, findNearestEnemy, makeHitInfo } from '../combat';
import { defineMutation } from '../hooks';
import type { Enemy, World } from '../types';
import { entitiesOf, forEachEnemyIn, ranked, spawnEntity } from './util';

// Thunder Wave Mutations (docs/moveset/shared/thunder-wave.md, pikachu/README.md).

const thunderWave = MOVES.thunderWave as ZoneMoveDef;

/** Static Pulse (generic): a ring expands from you and paralyses everything it passes, once. */
const pulse = ranked('thunderWave.pulse');
defineMutation('thunderWave.pulse', {
  stats: (s, _world, slot) => {
    s.stun = 0; // the ring paralyses instead
    s.damage *= pulse(slot).damageMult;
  },
  cast: (world, slot) => {
    const radius = pulse(slot).ringRadius * slot.stats.area;
    if (!findNearestEnemy(world, radius)) return false;
    const ring = spawnEntity(world, 'thunderWave.pulse', world.player.x, world.player.y, pulse(slot).ringSeconds);
    ring.x2 = radius; // full radius, for growth and drawing
    return true;
  },
  update: (world, slot, dt) => {
    const v = pulse(slot);
    for (const ring of entitiesOf(world, 'thunderWave.pulse')) {
      ring.lifeLeft -= dt;
      ring.radius = ring.x2 * Math.min(1, 1 - ring.lifeLeft / v.ringSeconds);
      const hit = makeHitInfo(slot.stats, slot);
      forEachEnemyIn(world, ring.x, ring.y, ring.radius, (e) => {
        if (ring.hitIds.includes(e.id)) return;
        ring.hitIds.push(e.id);
        damageEnemy(world, e, slot.stats.damage, hit);
        if (e.hp > 0) applyNewStun(e, v.paralyseSeconds, 'paralysis');
      });
    }
  },
});

/** Electric Terrain (generic): a longer field that makes your Electric moves hit harder inside it; no paralysis. */
const terrain = ranked('thunderWave.terrain');
defineMutation('thunderWave.terrain', {
  stats: (s, _world, slot) => {
    const v = terrain(slot);
    s.stun = 0;
    s.zoneDurationMult *= v.fieldSeconds / thunderWave.duration;
    s.damage *= v.fieldDamageMult;
  },
  update: (world, slot) => {
    const bonus = terrain(slot).electricBonus;
    for (const zone of world.zones) {
      if (zone.source !== 'thunderWave' || zone.lifeLeft <= 0) continue;
      forEachEnemyIn(world, zone.x, zone.y, zone.radius, (e) => applyVuln(e, bonus, TUNING.status.burnTick, 'Electric'));
    }
  },
});

/** Conductor (Bond, chain jump): your signature chain prefers enemies in Thunder Wave fields and jumps further between them. */
const conductor = ranked('thunderWave.conductor');

function inField(world: World, e: Enemy): boolean {
  return world.zones.some(
    (z) => z.source === 'thunderWave' && z.lifeLeft > 0 && (e.x - z.x) ** 2 + (e.y - z.y) ** 2 <= (z.radius + e.radius) ** 2,
  );
}

defineMutation('thunderWave.conductor', {
  stats: (s, _world, slot) => {
    s.stun = conductor(slot).paralyseSeconds;
  },
  chainBias: (world, slot, from, to) => {
    const v = conductor(slot);
    const toIn = inField(world, to);
    const between = toIn && inField(world, from);
    return { preferred: toIn, rangeMult: between ? v.jumpRangeMult : 1, damageMult: between ? v.chainDamageMult : 1 };
  },
});
