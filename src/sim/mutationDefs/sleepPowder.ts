import { ABILITIES } from '../../data/content';
import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { applyStatuses, applyVuln } from '../combat';
import { defineMutation, targetAsleep } from '../hooks';
import type { MoveSlot } from '../types';
import { forEachEnemyIn } from './util';

// Sleep Powder Mutations (docs/moveset/shared/sleep-powder.md, bulbasaur/README.md).

const sleepPowder = MOVES.sleepPowder as ZoneMoveDef;
const SLEEP = sleepPowder.onHit?.stun ?? 0;

/** Seconds each enemy has spent inside a Drowsy Haze cloud, per slot. */
const drowsyTime = new WeakMap<MoveSlot, Map<number, number>>();

/** Drowsy Haze (generic): a much bigger cloud that slows; enemies only fall asleep after a while inside. */
const drowsy = MUTATIONS['sleepPowder.drowsy'].values;
defineMutation('sleepPowder.drowsy', {
  stats: (s) => {
    s.area *= drowsy.radiusMult;
    s.slow = Math.max(s.slow, drowsy.slow);
    s.stun = 0; // sleep comes from time inside, below
  },
  onCast: (world, slot) => {
    const zone = world.zones[world.zones.length - 1];
    if (zone?.source === 'sleepPowder') slot.mutState.zoneId = zone.id;
    drowsyTime.set(slot, new Map());
  },
  update: (world, slot, dt) => {
    const zone = world.zones.find((z) => z.id === slot.mutState.zoneId && z.lifeLeft > 0);
    const time = drowsyTime.get(slot);
    if (!zone || !time) return;
    forEachEnemyIn(world, zone.x, zone.y, zone.radius, (e) => {
      const inside = (time.get(e.id) ?? 0) + dt;
      time.set(e.id, inside);
      if (inside >= drowsy.sleepAfter) applyStatuses(e, { slow: 0, stun: SLEEP, poisonDps: 0, stunKind: 'sleep' });
    });
  },
});

/** Nightmare (generic): sleeping enemies take more damage from everything; sleep is shorter. */
const nightmare = MUTATIONS['sleepPowder.nightmare'].values;
defineMutation('sleepPowder.nightmare', {
  stats: (s) => {
    s.stun = nightmare.sleepSeconds;
  },
  update: (world) => {
    for (const e of world.enemies) {
      if (targetAsleep(e)) applyVuln(e, nightmare.damageTakenPct, e.stunLeft, null);
    }
  },
});

/** Sweet Dreams (Bond, enemy asleep + Leech): damage to sleeping enemies heals through Leech at ×3. Shorter sleep. */
const dreams = MUTATIONS['sleepPowder.sweetDreams'].values;
defineMutation('sleepPowder.sweetDreams', {
  stats: (s) => {
    s.stun *= dreams.sleepMult;
  },
  leechBonus: (world, _slot, enemy) =>
    targetAsleep(enemy) ? (ABILITIES[world.player.ability].lifesteal ?? 0) * (dreams.leechMult - 1) : 0,
});
