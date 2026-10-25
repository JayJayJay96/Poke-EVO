import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { defineMutation } from '../hooks';
import { fireScaled, ranked } from './util';

// Vacuum Wave Mutations (docs/moveset/mankey §4, D56).

const vacuumWave = MOVES.vacuumWave as ProjectileMoveDef;

/** Aura Wave (generic): the waves home in, but pierce less. */
const aura = ranked('vacuumWave.auraWave');
defineMutation('vacuumWave.auraWave', {
  stats: (s, _world, slot) => {
    s.homing = true;
    s.pierce -= aura(slot).pierceLoss;
    s.damage *= aura(slot).damageMult;
  },
});

/** Spread Wave (generic): a fan of three weaker waves. */
const spread = ranked('vacuumWave.spread');
defineMutation('vacuumWave.spread', {
  stats: (s, _world, slot) => {
    s.extraCount += spread(slot).waves - 1;
    s.damage *= spread(slot).damageMult;
  },
});

/** Shockfist (Bond, hit taken): each hit you take fires a free wave back (a copy: it triggers nothing). */
const shock = ranked('vacuumWave.shockfist');
defineMutation('vacuumWave.shockfist', {
  onEvent: (world, slot, event) => {
    if (event !== 'hitTaken' || world.time < (slot.mutState.next ?? 0)) return;
    const v = shock(slot);
    const fired = fireScaled(world, slot, vacuumWave, v.fraction, 1);
    if (!fired) return;
    slot.mutState.next = world.time + v.minInterval;
    for (const p of fired) p.hit.fromProc = true;
  },
});
