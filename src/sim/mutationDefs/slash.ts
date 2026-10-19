import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { damageEnemy, makeHitInfo, procHit } from '../combat';
import { CUT_SECONDS } from '../forms/zoneCast';
import { defineMutation, targetBurning } from '../hooks';
import { entitiesOf, forEachEnemyIn, nearestEnemies, ranked, spawnEntity } from './util';

// Slash Mutations (docs/moveset/shared/slash.md, charmander/README.md).

const slash = MOVES.slash as ZoneMoveDef;

/** Afterimage (generic): the X stays on the ground a moment; enemies walking into it are cut again. */
const after = ranked('slash.afterimage');
defineMutation('slash.afterimage', {
  stats: (s, _world, slot) => {
    s.critChance -= (slash.critChance ?? 0) - after(slot).innateCrit;
    s.damage *= after(slot).damageMult;
  },
  onCast: (world, slot) => {
    const cut = world.cuts[world.cuts.length - 1];
    if (!cut) return;
    const mark = spawnEntity(world, 'slash.afterimage', cut.x, cut.y, after(slot).markSeconds);
    mark.radius = cut.radius;
    mark.damage = slot.stats.damage * after(slot).recutFraction;
    // Whatever the cut just hit isn't cut again by its own mark.
    forEachEnemyIn(world, cut.x, cut.y, cut.radius, (e) => mark.hitIds.push(e.id));
  },
  update: (world, slot, dt) => {
    const hit = procHit(slot.stats.attackType);
    for (const mark of entitiesOf(world, 'slash.afterimage')) {
      mark.lifeLeft -= dt;
      forEachEnemyIn(world, mark.x, mark.y, mark.radius, (e) => {
        if (mark.hitIds.includes(e.id)) return;
        mark.hitIds.push(e.id);
        damageEnemy(world, e, mark.damage, hit);
      });
    }
  },
});

/** Flurry (generic): three smaller single cuts on the 3 nearest enemies, each weaker. */
const flurry = ranked('slash.flurry');
defineMutation('slash.flurry', {
  cast: (world, slot) => {
    const v = flurry(slot);
    const targets = nearestEnemies(world, world.player.x, world.player.y, slash.range, v.targets);
    if (targets.length === 0) return false;
    const hit = makeHitInfo(slot.stats, slot);
    for (const e of targets) {
      damageEnemy(world, e, slot.stats.damage * v.cutDamageFraction, hit);
      world.cuts.push({ x: e.x, y: e.y, radius: e.radius, lifeLeft: CUT_SECONDS });
    }
    return true;
  },
});

/** Searing Slash (Bond, target Burning, Charmeleon+): always crits Burning enemies and cashes in the whole Burn. */
const searing = ranked('slash.searingSlash');
defineMutation('slash.searingSlash', {
  forceCrit: (_world, _slot, enemy) => targetBurning(enemy),
  damageMult: (_world, slot, enemy) => (targetBurning(enemy) ? 1 : searing(slot).damageMultNotBurning),
  onHit: (world, slot, enemy) => {
    if (!targetBurning(enemy) || enemy.hp <= 0) return;
    const rest = enemy.burnDps * enemy.burnLeft * searing(slot).cashInMult;
    enemy.burnLeft = 0;
    enemy.burnDps = 0;
    damageEnemy(world, enemy, rest, procHit('Fire'));
  },
});
