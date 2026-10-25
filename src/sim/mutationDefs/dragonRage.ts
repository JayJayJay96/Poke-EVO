import { MOVES, type BeamMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { applyNewStun, damageEnemy, findNearestEnemy, makeHitInfo } from '../combat';
import { blazeActive, defineMutation } from '../hooks';
import type { MoveSlot, World } from '../types';
import { dirTo, entitiesOf, forEachEnemyIn, ranked, spawnEntity } from './util';

// Dragon Rage Mutations (docs/moveset/shared/dragon-rage.md, charmander/README.md).

const dragonRage = MOVES.dragonRage as BeamMoveDef;

/**
 * Fixed Rage (generic): like the real move, each tick deals fixed damage that grows with your level.
 * It ignores the type chart and every damage augment and boost.
 */
const fixed = ranked('dragonRage.fixedRage');
defineMutation('dragonRage.fixedRage', {
  live: (s, world, slot) => {
    const v = fixed(slot);
    s.damage = v.fixedDamage + Math.floor(world.level / v.levelsPerPoint);
    s.attackType = null;
  },
});

/** Dragon Breath (generic): a short cone instead of a beam; each tick may paralyse. */
const breath = ranked('dragonRage.dragonBreath');
const HALF_CONE = (MUTATIONS['dragonRage.dragonBreath'].values.coneDeg * Math.PI) / 360;

function breathTick(world: World, slot: MoveSlot): void {
  const { player } = world;
  const v = breath(slot);
  const reach = v.coneLength * slot.stats.area * slot.stats.reachMult;
  const hit = makeHitInfo(slot.stats, slot);
  hit.dirX = slot.dirX;
  hit.dirY = slot.dirY;
  forEachEnemyIn(world, player.x, player.y, reach, (e) => {
    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    const inCone =
      dist <= e.radius || ((e.x - player.x) * slot.dirX + (e.y - player.y) * slot.dirY) / dist >= Math.cos(HALF_CONE);
    if (!inCone) return;
    damageEnemy(world, e, slot.stats.damage, hit);
    if (e.hp > 0 && world.rng.next() < v.paralyseChance) applyNewStun(e, v.paralyseSeconds, 'paralysis');
  });
}

defineMutation('dragonRage.dragonBreath', {
  stats: (s, _world, slot) => {
    s.damage *= breath(slot).damageMult;
  },
  cast: (world, slot) => {
    const target = findNearestEnemy(world, dragonRage.range * breath(slot).rangeMult);
    if (!target) return false;
    [slot.dirX, slot.dirY] = dirTo(world.player.x, world.player.y, target.x, target.y);
    slot.activeLeft = dragonRage.duration * slot.stats.duration;
    slot.tickLeft = 0;
    const cone = spawnEntity(world, 'dragonRage.dragonBreath', world.player.x, world.player.y, slot.activeLeft);
    cone.radius = breath(slot).coneLength * slot.stats.area * slot.stats.reachMult;
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
 * Cornered Dragon (Bond, Blaze active, Charmeleon+; D50): while Blaze is on, every Dragon Rage beam fans
 * into a cross. The arm toward the target hits in full, the others for `sideArmMult`. A Flare Up resets it.
 */
const cornered = ranked('dragonRage.corneredDragon');
defineMutation('dragonRage.corneredDragon', {
  beamDirs: (world, slot) => {
    if (!blazeActive(world)) return [[slot.dirX, slot.dirY]];
    const v = cornered(slot);
    const base = Math.atan2(slot.dirY, slot.dirX);
    const dirs: [number, number, number][] = [];
    for (let i = 0; i < v.directions; i++) {
      const a = base + (i / v.directions) * Math.PI * 2;
      dirs.push([Math.cos(a), Math.sin(a), i === 0 ? 1 : v.sideArmMult]);
    }
    return dirs;
  },
  onEvent: (_world, slot, event) => {
    if (event === 'flareUp') slot.cooldownLeft = 0;
  },
});
