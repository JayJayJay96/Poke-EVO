import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { MUTATION_TUNING } from '../../data/mutations';
import { applySlow, canTrap } from '../combat';
import { defineMutation } from '../hooks';
import { fireScaled, ranked } from './util';

// Shadow Punch Mutations (docs/moveset/mankey §4, D56).

const shadowPunch = MOVES.shadowPunch as ProjectileMoveDef;

/** Shadow Barrage (generic): three weaker fists. */
const barrage = ranked('shadowPunch.barrage');
defineMutation('shadowPunch.barrage', {
  stats: (s, _world, slot) => {
    s.extraCount += barrage(slot).fists - 1;
    s.damage *= barrage(slot).damageMult;
  },
});

/** Phantom Grip (generic): the fist holds a light target in place (heavier ones are slowed). */
const grip = ranked('shadowPunch.grip');
defineMutation('shadowPunch.grip', {
  stats: (s, _world, slot) => {
    s.damage *= grip(slot).damageMult;
  },
  onHit: (_world, slot, enemy) => {
    if (enemy.hp <= 0) return;
    const seconds = grip(slot).holdSeconds;
    if (canTrap(enemy)) enemy.trapLeft = Math.max(enemy.trapLeft, seconds);
    else applySlow(enemy, MUTATION_TUNING.trapFallbackSlow, seconds);
  },
});

/** Phantom Grudge (Bond, Rampage ends, Annihilape): a volley of homing fists (copies: they trigger nothing). */
const grudge = ranked('shadowPunch.phantomGrudge');
defineMutation('shadowPunch.phantomGrudge', {
  stats: (s, _world, slot) => {
    s.damage *= grudge(slot).damageMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'rampageEnd') return;
    const extra = grudge(slot).fists - 1;
    slot.stats.extraCount += extra;
    for (const p of fireScaled(world, slot, shadowPunch, 1, 1) ?? []) p.hit.fromProc = true;
    slot.stats.extraCount -= extra;
  },
});
