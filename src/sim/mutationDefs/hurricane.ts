import { defineMutation } from '../hooks';
import { ranked } from './util';

// Hurricane Mutations (docs/moveset/shared/hurricane.md, charmander/README.md). Charizard only.

/** Tornado (generic): the storm detaches and travels the way you were moving, chewing a path. */
const tornado = ranked('hurricane.tornado');
defineMutation('hurricane.tornado', {
  stats: (s, _world, slot) => {
    s.damage *= tornado(slot).damageMult;
  },
  onCast: (world, slot) => {
    slot.anchored = true;
    slot.anchorX = world.player.x;
    slot.anchorY = world.player.y;
    slot.mutState.vx = world.player.faceX * tornado(slot).travelSpeed;
    slot.mutState.vy = world.player.faceY * tornado(slot).travelSpeed;
  },
  update: (_world, slot, dt) => {
    if (!slot.anchored) return;
    if (slot.activeLeft <= 0) {
      slot.anchored = false;
      return;
    }
    slot.anchorX += (slot.mutState.vx ?? 0) * dt;
    slot.anchorY += (slot.mutState.vy ?? 0) * dt;
  },
});

/** Gale Wall (generic): the winds shove enemies outward, a ring that holds the crowd off. */
const gale = ranked('hurricane.galeWall');
defineMutation('hurricane.galeWall', {
  stats: (s, _world, slot) => {
    s.damage *= gale(slot).damageMult;
    s.knockback += gale(slot).stagger;
  },
});

/**
 * Inferno Storm (Bond, kills, Charizard): each kill while the storm is up extends it a little; after
 * enough kills in one storm it turns Fire-type and Burns for the rest of that storm.
 */
const inferno = ranked('hurricane.infernoStorm');
defineMutation('hurricane.infernoStorm', {
  stats: (s, _world, slot) => {
    s.damage *= inferno(slot).damageMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.kills = 0;
    slot.mutState.bonus = 0;
  },
  onEvent: (_world, slot, event, amount) => {
    if (event !== 'kill' || slot.activeLeft <= 0) return;
    slot.mutState.kills = (slot.mutState.kills ?? 0) + amount;
    const v = inferno(slot);
    const extra = Math.min(v.secondsPerKill * amount, v.maxBonusSeconds - (slot.mutState.bonus ?? 0));
    if (extra > 0) {
      slot.activeLeft += extra;
      slot.mutState.bonus = (slot.mutState.bonus ?? 0) + extra;
    }
  },
  live: (s, _world, slot) => {
    const v = inferno(slot);
    if (slot.activeLeft > 0 && (slot.mutState.kills ?? 0) >= v.killsToIgnite) {
      s.attackType = 'Fire';
      s.burnPct += v.burnPct;
    }
  },
});
