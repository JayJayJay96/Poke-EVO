import { ENEMIES } from '../../data/content';
import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { castMelee } from '../forms/melee';
import { defineMutation } from '../hooks';
import { ranked } from './util';

// Close Combat Mutations (docs/moveset/mankey §4, D56).

const closeCombat = MOVES.closeCombat as MeleeMoveDef;

/** Brick Break (generic): hits Elites and bosses harder, in a narrower arc. */
const brick = ranked('closeCombat.brickBreak');
defineMutation('closeCombat.brickBreak', {
  stats: (s, _world, slot) => {
    s.arcMult *= brick(slot).arcMult;
  },
  damageMult: (_world, slot, enemy) => (enemy.elite || ENEMIES[enemy.kind].boss ? brick(slot).eliteMult : 1),
});

/** Arm Thrust (generic): three quick weaker hits instead of one, with shorter reach. */
const thrust = ranked('closeCombat.armThrust');
defineMutation('closeCombat.armThrust', {
  stats: (s, _world, slot) => {
    s.reachMult *= thrust(slot).reachMult;
  },
  cast: (world, slot) => {
    const v = thrust(slot);
    slot.stats.damage *= v.hitFraction;
    let cast = false;
    for (let i = 0; i < v.hits; i++) cast = castMelee(world, slot, closeCombat) || cast;
    slot.stats.damage /= v.hitFraction;
    return cast;
  },
});

/** Fury Combat (Bond, Rage level, Primeape+): with enough Rage, no guard drop and a harder hit. */
const fury = ranked('closeCombat.furyCombat');
defineMutation('closeCombat.furyCombat', {
  live: (s, world, slot) => {
    if (world.player.rage >= fury(slot).rageThreshold) s.damage *= 1 + fury(slot).damageBonus;
  },
  onCast: (world, slot) => {
    if (world.player.rage >= fury(slot).rageThreshold) world.player.vulnLeft = 0;
  },
});
