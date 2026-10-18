import { TUNING } from '../../data/content';
import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { findNearestEnemy } from '../combat';
import { defineMutation } from '../hooks';
import type { MoveSlot, World, Zone } from '../types';
import { spawnZone } from '../zones';
import { dirTo, forEachEnemyIn } from './util';

// Poison Powder Mutations (docs/moveset/shared/poison-powder.md, bulbasaur/README.md).

const poisonPowder = MOVES.poisonPowder as ZoneMoveDef;

/** The cloud this slot cast last, if it's still there. */
function ownZone(world: World, slot: MoveSlot): Zone | undefined {
  return world.zones.find((z) => z.id === slot.mutState.zoneId && z.lifeLeft > 0);
}

function rememberZone(world: World, slot: MoveSlot): void {
  const zone = world.zones[world.zones.length - 1];
  if (zone?.source === 'poisonPowder') slot.mutState.zoneId = zone.id;
}

/** Drift Cloud (generic): the cloud slowly follows the nearest enemy instead of sitting still. */
const drift = MUTATIONS['poisonPowder.drift'].values;
defineMutation('poisonPowder.drift', {
  stats: (s) => {
    s.area *= drift.radiusMult;
  },
  onCast: rememberZone,
  update: (world, slot, dt) => {
    const zone = ownZone(world, slot);
    if (!zone) return;
    const target = findNearestEnemy(world, poisonPowder.range, zone.x, zone.y);
    if (!target) return;
    const [dx, dy] = dirTo(zone.x, zone.y, target.x, target.y);
    zone.x += dx * drift.driftSpeed * dt;
    zone.y += dy * drift.driftSpeed * dt;
  },
});

/** Toxic (generic): every tick inside the cloud adds a poison stack; enemies that stay get wrecked. */
const toxic = MUTATIONS['poisonPowder.toxic'].values;
defineMutation('poisonPowder.toxic', {
  stats: (s) => {
    s.zoneDurationMult *= toxic.durationMult;
  },
  onCast: (world, slot) => {
    rememberZone(world, slot);
    slot.mutState.tick = poisonPowder.tickInterval;
  },
  update: (world, slot, dt) => {
    const zone = ownZone(world, slot);
    if (!zone) return;
    slot.mutState.tick = (slot.mutState.tick ?? 0) - dt;
    if (slot.mutState.tick > 0) return;
    slot.mutState.tick += poisonPowder.tickInterval;
    forEachEnemyIn(world, zone.x, zone.y, zone.radius, (e) => {
      e.poisonStacks = Math.min(toxic.maxStacks, e.poisonStacks + 1);
      e.poisonDps = Math.max(e.poisonDps, zone.poisonDps * (1 + toxic.stackPct * e.poisonStacks));
      e.poisonLeft = TUNING.status.poisonSeconds;
    });
  },
});

/** Spore Sac (Bond, hit taken): getting hit puffs a small poison cloud at your feet (rate-limited). */
const sac = MUTATIONS['poisonPowder.sporeSac'].values;
defineMutation('poisonPowder.sporeSac', {
  stats: (s) => {
    s.cooldown *= sac.cooldownMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'hitTaken' || world.time < (slot.mutState.next ?? 0)) return;
    slot.mutState.next = world.time + sac.minInterval;
    const s = slot.stats;
    spawnZone(
      world,
      world.player.x,
      world.player.y,
      poisonPowder.radius * s.area * sac.sizeMult,
      sac.cloudSeconds,
      poisonPowder.tickInterval,
      s.damage * s.zoneDamageMult,
      s.critChance,
      { slow: 0, stun: 0, poisonDps: s.damage * s.poisonPct, attackType: s.attackType },
      'poisonPowder',
    );
  },
});
