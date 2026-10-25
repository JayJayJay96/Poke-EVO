import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { findNearestEnemy } from '../combat';
import { defineMutation } from '../hooks';
import type { MoveSlot, World } from '../types';
import { strikeZone } from '../zones';
import { nearestEnemies, ranked } from './util';

// Future Sight Mutations (docs/moveset/abra §5, D56).

const futureSight = MOVES.futureSight as ZoneMoveDef;
/** Candidates checked when spreading several marks. */
const MAX_CANDIDATES = 12;

function mark(world: World, slot: MoveSlot, x: number, y: number, delay: number, damage: number): void {
  const s = slot.stats;
  strikeZone(world, x, y, futureSight.radius * s.area, delay, damage, s.critChance, {
    slow: 0,
    stun: 0,
    poisonDps: 0,
    attackType: s.attackType,
  });
}

/** Foresight Field (generic): three smaller marks on separate spots. */
const field = ranked('futureSight.field');
defineMutation('futureSight.field', {
  cast: (world, slot) => {
    const v = field(slot);
    const radius = futureSight.radius * slot.stats.area;
    const spots: { x: number; y: number }[] = [];
    for (const e of nearestEnemies(world, world.player.x, world.player.y, futureSight.range, MAX_CANDIDATES)) {
      if (spots.length >= v.marks) break;
      if (spots.every((p) => (p.x - e.x) ** 2 + (p.y - e.y) ** 2 > radius * radius)) spots.push({ x: e.x, y: e.y });
    }
    if (spots.length === 0) return false;
    for (const p of spots) mark(world, slot, p.x, p.y, futureSight.delay!, slot.stats.damage * v.markFraction);
    return true;
  },
});

/** Prophecy (generic): a longer wait for a bigger blast. */
const prophecy = ranked('futureSight.prophecy');
defineMutation('futureSight.prophecy', {
  stats: (s, _world, slot) => {
    s.damage *= prophecy(slot).damageMult;
  },
  cast: (world, slot) => {
    const target = findNearestEnemy(world, futureSight.range);
    if (!target) return false;
    mark(world, slot, target.x, target.y, prophecy(slot).delay, slot.stats.damage);
    return true;
  },
});

/** Echo Sight (Bond, Psychic Echo, Alakazam): each Echo blast also plants a Future Sight where it went off. */
const echoSight = ranked('futureSight.echoSight');
defineMutation('futureSight.echoSight', {
  stats: (s, _world, slot) => {
    s.damage *= echoSight(slot).damageMult;
  },
  onEvent: (world, slot, event) => {
    if (event === 'echo') mark(world, slot, world.player.echoX, world.player.echoY, futureSight.delay!, slot.stats.damage);
  },
});
