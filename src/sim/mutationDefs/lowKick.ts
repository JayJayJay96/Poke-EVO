import { ENEMIES } from '../../data/content';
import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { applyNewStun, canTrap, weightMult } from '../combat';
import { defineMutation } from '../hooks';
import { ranked } from './util';

// Low Kick Mutations (docs/moveset/mankey §4, D56).

const lowKick = MOVES.lowKick as MeleeMoveDef;

/** Trip (generic): light enemies fall down for a moment (a new stun: fatigue applies, bosses immune). */
const trip = ranked('lowKick.trip');
defineMutation('lowKick.trip', {
  stats: (s, _world, slot) => {
    s.damage *= trip(slot).damageMult;
  },
  onHit: (_world, slot, enemy) => {
    if (enemy.hp > 0 && canTrap(enemy)) applyNewStun(enemy, trip(slot).tripSeconds);
  },
});

/** Heavy Hitter (generic): the weight scaling widens, an Elite and boss killer. */
const heavy = ranked('lowKick.heavyHitter');
defineMutation('lowKick.heavyHitter', {
  damageMult: (_world, slot, enemy) => {
    const v = heavy(slot);
    const t = Math.min(1, ENEMIES[enemy.kind].weightKg / lowKick.weightScaling!.maxKg);
    return (v.lightMult + (v.heavyMult - v.lightMult) * t) / weightMult(slot, enemy);
  },
});

/** Brawlers Rhythm (Bond, kills): every kill since the last kick widens the next one. */
const rhythm = ranked('lowKick.brawlersRhythm');
defineMutation('lowKick.brawlersRhythm', {
  stats: (s, _world, slot) => {
    s.damage *= rhythm(slot).damageMult;
  },
  onEvent: (_world, slot, event) => {
    if (event === 'kill') slot.mutState.kills = (slot.mutState.kills ?? 0) + 1;
  },
  live: (s, _world, slot) => {
    const v = rhythm(slot);
    s.reachMult *= 1 + Math.min(v.maxBonus, (slot.mutState.kills ?? 0) * v.radiusPerKill);
  },
  onCast: (_world, slot) => {
    slot.mutState.kills = 0;
  },
});
