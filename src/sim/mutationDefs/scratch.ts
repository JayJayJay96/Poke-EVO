import { POKEMON } from '../../data/content';
import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { MAX_ENEMY_RADIUS, damageEnemy, findNearestEnemy, procHit } from '../combat';
import { blazeActive, defineMutation } from '../hooks';
import { typeDamageFactor } from '../stats';
import type { MoveSlot } from '../types';
import { dirTo, forEachEnemyOnSegment, ranked } from './util';

// Scratch Mutations (docs/moveset/shared/scratch.md, charmander/README.md).

const scratch = MOVES.scratch as MeleeMoveDef;

/** Fury Swipes (generic): hits on the same enemy stack damage on it for a while. A focused single-target swipe. */
const fury = ranked('scratch.furySwipes');
/** Stacks per enemy id for each Fury Swipes slot: [stacks, expires at]. */
const furyStacks = new WeakMap<MoveSlot, Map<number, [number, number]>>();
/** Past this many tracked enemies, expired entries are swept. Engine constant. */
const SWEEP_AT = 64;

function stacksOf(slot: MoveSlot): Map<number, [number, number]> {
  let map = furyStacks.get(slot);
  if (!map) furyStacks.set(slot, (map = new Map()));
  return map;
}

defineMutation('scratch.furySwipes', {
  stats: (s, _world, slot) => {
    s.arcMult *= fury(slot).arcMult;
  },
  damageMult: (world, slot, enemy) => {
    const entry = stacksOf(slot).get(enemy.id);
    return entry && entry[1] > world.time ? 1 + fury(slot).stackPct * entry[0] : 1;
  },
  onHit: (world, slot, enemy) => {
    const v = fury(slot);
    const map = stacksOf(slot);
    const entry = map.get(enemy.id);
    const stacks = entry && entry[1] > world.time ? Math.min(v.maxStacks, entry[0] + 1) : 1;
    map.set(enemy.id, [stacks, world.time + v.stackWindow]);
    if (map.size > SWEEP_AT) for (const [id, e] of map) if (e[1] <= world.time) map.delete(id);
  },
});

/** Crescent (generic): a 200° arc, and each swing throws a slash wave past the claw. */
const crescent = ranked('scratch.crescent');
defineMutation('scratch.crescent', {
  stats: (s, _world, slot) => {
    const v = crescent(slot);
    s.damage *= v.damageMult;
    s.arcMult *= v.arcDeg / scratch.arcDegrees;
    s.reachMult *= v.reachMult;
    s.cooldown *= v.cooldownMult;
  },
  onCast: (world, slot) => {
    const { player } = world;
    const reach = scratch.reach * slot.stats.area * slot.stats.reachMult;
    const target = findNearestEnemy(world, reach + MAX_ENEMY_RADIUS);
    if (!target) return;
    const [dx, dy] = dirTo(player.x, player.y, target.x, target.y);
    const hit = procHit(slot.stats.attackType);
    const v = crescent(slot);
    const x1 = player.x + dx * reach;
    const y1 = player.y + dy * reach;
    const length = v.waveLength * slot.stats.area;
    forEachEnemyOnSegment(world, x1, y1, x1 + dx * length, y1 + dy * length, v.waveWidth, (e) =>
      damageEnemy(world, e, slot.stats.damage * v.waveDamageFraction, hit),
    );
  },
});

/** Blaze Claws (Bond, Blaze active): while Blaze is on, Scratch turns Fire-type (STAB, Burn) and reaches further. */
const claws = ranked('scratch.blazeClaws');
const FIRE_SCRATCH: MeleeMoveDef = { ...scratch, tags: [...scratch.tags, 'Fire'] };
defineMutation('scratch.blazeClaws', {
  live: (s, world, slot) => {
    const v = claws(slot);
    if (!blazeActive(world)) {
      s.damage *= v.damageMultOff;
      return;
    }
    const user = { types: POKEMON[world.player.pokemonId].stages[world.player.stage]!.types, ability: world.player.ability };
    s.damage *= typeDamageFactor(FIRE_SCRATCH, user) / typeDamageFactor(scratch, user);
    s.attackType = 'Fire';
    s.burnPct += v.burnPct;
    s.reachMult *= v.reachMult;
  },
});
