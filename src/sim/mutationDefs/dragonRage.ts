import { MOVES, type BeamMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { applyNewStun, damageEnemy, findNearestEnemy, makeHitInfo } from '../combat';
import { ARC_SECONDS } from '../forms/projectile';
import { defineMutation } from '../hooks';
import type { MoveSlot, World } from '../types';
import { dirTo, entitiesOf, forEachEnemyIn, forEachEnemyOnSegment, spawnEntity } from './util';

// Dragon Rage Mutations (docs/moveset/shared/dragon-rage.md, charmander/README.md).

const dragonRage = MOVES.dragonRage as BeamMoveDef;
const TICKS_PER_CAST = Math.round(dragonRage.duration / dragonRage.tickInterval);

/**
 * Fixed Rage (generic): like the real move, each tick deals fixed damage that grows with your level.
 * It ignores the type chart and every damage augment and boost.
 */
const fixed = MUTATIONS['dragonRage.fixedRage'].values;
defineMutation('dragonRage.fixedRage', {
  live: (s, world) => {
    s.damage = fixed.fixedDamage + Math.floor(world.level / fixed.levelsPerPoint);
    s.attackType = null;
  },
});

/** Dragon Breath (generic): a short cone instead of a beam; each tick may paralyse. */
const breath = MUTATIONS['dragonRage.dragonBreath'].values;
const HALF_CONE = (breath.coneDeg * Math.PI) / 360;

function breathTick(world: World, slot: MoveSlot): void {
  const { player } = world;
  const reach = breath.coneLength * slot.stats.area * slot.stats.reachMult;
  const hit = makeHitInfo(slot.stats, slot);
  hit.dirX = slot.dirX;
  hit.dirY = slot.dirY;
  forEachEnemyIn(world, player.x, player.y, reach, (e) => {
    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    const inCone =
      dist <= e.radius || ((e.x - player.x) * slot.dirX + (e.y - player.y) * slot.dirY) / dist >= Math.cos(HALF_CONE);
    if (!inCone) return;
    damageEnemy(world, e, slot.stats.damage, hit);
    if (e.hp > 0 && world.rng.next() < breath.paralyseChance) applyNewStun(e, breath.paralyseSeconds);
  });
}

defineMutation('dragonRage.dragonBreath', {
  stats: (s) => {
    s.damage *= breath.damageMult;
  },
  cast: (world, slot) => {
    const target = findNearestEnemy(world, dragonRage.range * breath.rangeMult);
    if (!target) return false;
    [slot.dirX, slot.dirY] = dirTo(world.player.x, world.player.y, target.x, target.y);
    slot.activeLeft = dragonRage.duration * slot.stats.duration;
    slot.tickLeft = 0;
    const cone = spawnEntity(world, 'dragonRage.dragonBreath', world.player.x, world.player.y, slot.activeLeft);
    cone.radius = breath.coneLength * slot.stats.area * slot.stats.reachMult;
    return true;
  },
  beamDirs: () => [], // the cone replaces the beam
  update: (world, slot, dt) => {
    for (const cone of entitiesOf(world, 'dragonRage.dragonBreath')) {
      cone.x = world.player.x;
      cone.y = world.player.y;
      cone.vx = slot.dirX; // facing, for drawing
      cone.vy = slot.dirY;
      cone.lifeLeft -= dt;
      cone.timer -= dt;
      if (cone.timer > 0) continue;
      cone.timer += dragonRage.tickInterval;
      breathTick(world, slot);
    }
  },
});

/**
 * Cornered Dragon (Bond, Flare Up, Charmeleon+): every Flare Up fires Dragon Rage at once in a cross,
 * each beam a full cast's damage, and resets its cooldown. It uses Dragon Rage's stat augments,
 * never another Mutation (no hooks run for these hits).
 */
const cornered = MUTATIONS['dragonRage.corneredDragon'].values;
defineMutation('dragonRage.corneredDragon', {
  stats: (s) => {
    s.cooldown *= cornered.cooldownMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'flareUp') return;
    const { player } = world;
    const length = dragonRage.length * slot.stats.area * slot.stats.reachMult;
    const width = dragonRage.width * slot.stats.area;
    const hit = makeHitInfo(slot.stats); // no slot: augments apply, Mutations don't
    for (let i = 0; i < cornered.directions; i++) {
      const a = (i / cornered.directions) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      hit.dirX = dx;
      hit.dirY = dy;
      const x2 = player.x + dx * length;
      const y2 = player.y + dy * length;
      forEachEnemyOnSegment(world, player.x, player.y, x2, y2, width, (e) =>
        damageEnemy(world, e, slot.stats.damage * TICKS_PER_CAST, hit),
      );
      world.arcs.push({ x1: player.x, y1: player.y, x2, y2, lifeLeft: ARC_SECONDS });
    }
    slot.cooldownLeft = 0;
  },
});
