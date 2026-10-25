import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { cutAt } from '../forms/zoneCast';
import { defineMutation, movingFor } from '../hooks';
import type { Enemy } from '../types';
import { forEachEnemyIn, nearestEnemies, ranked } from './util';

// Seismic Toss Mutations (docs/moveset/mankey §4, D56).

const toss = MOVES.seismicToss as ZoneMoveDef;
/** Candidates checked for the densest landing spot (keeps the search cheap). */
const MAX_CANDIDATES = 12;

/** Submission (generic): the slam lands on the densest cluster near you. */
const submission = ranked('seismicToss.submission');
defineMutation('seismicToss.submission', {
  stats: (s, _world, slot) => {
    s.damage *= submission(slot).damageMult;
  },
  cast: (world, slot) => {
    const radius = toss.radius * slot.stats.area;
    const { x, y } = world.player;
    let best: Enemy | null = null;
    let bestCount = 0;
    for (const e of nearestEnemies(world, x, y, submission(slot).searchRange, MAX_CANDIDATES)) {
      let count = 0;
      forEachEnemyIn(world, e.x, e.y, radius, () => count++);
      if (count > bestCount) {
        bestCount = count;
        best = e;
      }
    }
    if (!best) return false;
    cutAt(world, slot, best.x, best.y, radius);
    return true;
  },
});

/** Level Toss (generic): fixed damage that grows with your level, like the real move; ignores types and boosts. */
const levelToss = ranked('seismicToss.levelToss');
defineMutation('seismicToss.levelToss', {
  live: (s, world, slot) => {
    const v = levelToss(slot);
    s.damage = v.fixedDamage + world.level * v.perLevel;
    s.attackType = null;
  },
});

/** Running Throw (Bond, moving): after moving a moment, the slam is wider; standing still, weaker. */
const running = ranked('seismicToss.runningThrow');
defineMutation('seismicToss.runningThrow', {
  live: (s, world, slot) => {
    const v = running(slot);
    if (movingFor(world, v.movingSeconds)) s.area *= v.areaMult;
    else s.damage *= v.damageMultStill;
  },
});
