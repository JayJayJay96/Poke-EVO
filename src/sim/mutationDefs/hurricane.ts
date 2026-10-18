import { MUTATIONS } from '../../data/mutations';
import { defineMutation } from '../hooks';

// Hurricane Mutations (docs/moveset/shared/hurricane.md, charmander/README.md). Charizard only.

/** Tornado (generic): the storm detaches and travels the way you were moving, chewing a path. */
const tornado = MUTATIONS['hurricane.tornado'].values;
defineMutation('hurricane.tornado', {
  stats: (s) => {
    s.damage *= tornado.damageMult;
  },
  onCast: (world, slot) => {
    slot.anchored = true;
    slot.anchorX = world.player.x;
    slot.anchorY = world.player.y;
    slot.mutState.vx = world.player.faceX * tornado.travelSpeed;
    slot.mutState.vy = world.player.faceY * tornado.travelSpeed;
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
const gale = MUTATIONS['hurricane.galeWall'].values;
defineMutation('hurricane.galeWall', {
  stats: (s) => {
    s.damage *= gale.damageMult;
    s.knockback += gale.stagger;
  },
});

/**
 * Inferno Storm (Bond, kills, Charizard): each kill while the storm is up extends it a little; after
 * enough kills in one storm it turns Fire-type and Burns for the rest of that storm.
 */
const inferno = MUTATIONS['hurricane.infernoStorm'].values;
defineMutation('hurricane.infernoStorm', {
  stats: (s) => {
    s.damage *= inferno.damageMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.kills = 0;
    slot.mutState.bonus = 0;
  },
  onEvent: (_world, slot, event, amount) => {
    if (event !== 'kill' || slot.activeLeft <= 0) return;
    slot.mutState.kills = (slot.mutState.kills ?? 0) + amount;
    const extra = Math.min(inferno.secondsPerKill * amount, inferno.maxBonusSeconds - (slot.mutState.bonus ?? 0));
    if (extra > 0) {
      slot.activeLeft += extra;
      slot.mutState.bonus = (slot.mutState.bonus ?? 0) + extra;
    }
  },
  live: (s, _world, slot) => {
    if (slot.activeLeft > 0 && (slot.mutState.kills ?? 0) >= inferno.killsToIgnite) {
      s.attackType = 'Fire';
      s.burnPct += inferno.burnPct;
    }
  },
});
