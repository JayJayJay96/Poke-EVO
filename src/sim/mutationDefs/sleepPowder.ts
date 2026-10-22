import { ABILITIES } from '../../data/content';
import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { applyNewStun, applyVuln } from '../combat';
import { defineMutation, targetAsleep } from '../hooks';
import type { MoveSlot } from '../types';
import { forEachEnemyIn, ranked } from './util';

// Sleep Powder Mutations (docs/moveset/shared/sleep-powder.md, bulbasaur/README.md).

const sleepPowder = MOVES.sleepPowder as ZoneMoveDef;
const SLEEP = sleepPowder.onHit?.stun ?? 0;

/** Seconds each enemy has spent inside a Drowsy Haze cloud, per slot. */
const drowsyTime = new WeakMap<MoveSlot, Map<number, number>>();

/** Drowsy Haze (generic): a much bigger cloud that slows; enemies only fall asleep after a while inside. */
const drowsy = ranked('sleepPowder.drowsy');
defineMutation('sleepPowder.drowsy', {
  stats: (s, _world, slot) => {
    const v = drowsy(slot);
    s.area *= v.radiusMult;
    s.slow = Math.max(s.slow, v.slow);
    s.damage *= v.damageMult;
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
      // A new effect (D21 guard rails): bosses are immune and stun fatigue applies, so no endless sleep.
      if (inside >= drowsy(slot).sleepAfter && e.stunLeft <= 0) applyNewStun(e, SLEEP, 'sleep');
    });
  },
});

/** Nightmare (generic): sleeping enemies take more damage from everything; sleep is shorter. */
const nightmare = ranked('sleepPowder.nightmare');
defineMutation('sleepPowder.nightmare', {
  stats: (s, _world, slot) => {
    s.stun = nightmare(slot).sleepSeconds;
  },
  update: (world, slot) => {
    const pct = nightmare(slot).damageTakenPct;
    for (const e of world.enemies) {
      if (targetAsleep(e)) applyVuln(e, pct, e.stunLeft, null);
    }
  },
});

/** Sweet Dreams (Bond, enemy asleep + Leech): damage to sleeping enemies heals through Leech at ×3. Shorter sleep. */
const dreams = ranked('sleepPowder.sweetDreams');
defineMutation('sleepPowder.sweetDreams', {
  stats: (s, _world, slot) => {
    s.stun *= dreams(slot).sleepMult;
  },
  leechBonus: (world, slot, enemy) =>
    targetAsleep(enemy) ? (ABILITIES[world.player.ability].lifesteal ?? 0) * (dreams(slot).leechMult - 1) : 0,
});
