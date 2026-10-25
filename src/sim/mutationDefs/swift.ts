import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { defineMutation } from '../hooks';
import { fireScaled, ranked } from './util';

// Swift Mutations (docs/moveset/abra §5, D56).

const swift = MOVES.swift as ProjectileMoveDef;

/** Star Storm (generic): five weaker stars. */
const storm = ranked('swift.starStorm');
defineMutation('swift.starStorm', {
  stats: (s, _world, slot) => {
    s.extraCount += storm(slot).stars - swift.count;
    s.damage *= storm(slot).damageMult;
  },
});

/** Comet Star (generic): one big star that pierces every enemy, on a longer cooldown. */
const comet = ranked('swift.comet');
/** Enough pierce to pass through any crowd. */
const PIERCE_ALL = 999;
defineMutation('swift.comet', {
  stats: (s, _world, slot) => {
    s.extraCount -= swift.count - 1;
    s.pierce += PIERCE_ALL;
    s.damage *= comet(slot).damageMult;
    s.cooldown *= comet(slot).cooldownMult;
  },
});

/** Shooting Stars (Bond, kills): a kill sends a seeking star (a copy, so its own kills send none). */
const shooting = ranked('swift.shootingStars');
defineMutation('swift.shootingStars', {
  stats: (s, _world, slot) => {
    s.damage *= shooting(slot).damageMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'kill' || world.time < (slot.mutState.next ?? 0)) return;
    const extra = swift.count - 1;
    slot.stats.extraCount -= extra;
    const fired = fireScaled(world, slot, swift, 1, 1);
    slot.stats.extraCount += extra;
    if (!fired) return;
    slot.mutState.next = world.time + shooting(slot).minInterval;
    for (const p of fired) p.hit.fromProc = true;
  },
});
