import { TUNING } from '../../data/content';
import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { applySlow, canTrap, damageEnemy, findNearestEnemy, makeHitInfo, procHit } from '../combat';
import { BLAST_SECONDS } from '../forms/projectile';
import { defineMutation } from '../hooks';
import type { MoveSlot, World } from '../types';
import { spawnZone } from '../zones';
import { dirTo, entitiesOf, forEachEnemyIn, spawnEntity } from './util';

// Whirlpool Mutations (docs/moveset/shared/whirlpool.md, squirtle/README.md).

const whirlpool = MOVES.whirlpool as ZoneMoveDef;

/** Maelstrom (generic): the vortex drags light enemies in, then collapses into a burst that grows with the crowd. */
const mael = MUTATIONS['whirlpool.maelstrom'].values;
defineMutation('whirlpool.maelstrom', {
  stats: (s) => {
    s.cooldown *= mael.cooldownMult;
  },
  onCast: (world, slot) => {
    const zone = world.zones[world.zones.length - 1];
    if (zone?.source === 'whirlpool') slot.mutState.zoneId = zone.id;
  },
  update: (world, slot, dt) => {
    const zone = world.zones.find((z) => z.id === slot.mutState.zoneId && z.lifeLeft > 0);
    if (!zone) return;
    forEachEnemyIn(world, zone.x, zone.y, zone.radius, (e) => {
      if (!canTrap(e)) return; // drags only move light enemies
      const [dx, dy] = dirTo(e.x, e.y, zone.x, zone.y);
      e.x += dx * mael.pullSpeed * dt;
      e.y += dy * mael.pullSpeed * dt;
    });
    if (zone.lifeLeft > dt) return;
    // Last step: collapse.
    slot.mutState.zoneId = 0;
    let inside = 0;
    forEachEnemyIn(world, zone.x, zone.y, zone.radius, () => inside++);
    const damage = zone.damage * mael.collapseTickMult * (1 + mael.perEnemyPct * Math.min(inside, mael.maxEnemies));
    const hit = procHit(zone.attackType);
    forEachEnemyIn(world, zone.x, zone.y, zone.radius, (e) => damageEnemy(world, e, damage, hit));
    world.blasts.push({ x: zone.x, y: zone.y, radius: zone.radius, lifeLeft: BLAST_SECONDS * 2, type: 'Water' });
  },
});

/** Moat (generic): Whirlpool becomes a ring around you that follows you and slows whatever crosses it. */
const moat = MUTATIONS['whirlpool.moat'].values;

function moatTick(world: World, slot: MoveSlot): void {
  const { player } = world;
  const area = slot.stats.area;
  const inner = moat.innerRadius * area;
  const outer = moat.outerRadius * area;
  const hit = makeHitInfo(slot.stats, slot);
  hit.slow = 0;
  forEachEnemyIn(world, player.x, player.y, outer, (e) => {
    if (Math.hypot(e.x - player.x, e.y - player.y) + e.radius < inner) return; // the safe middle
    damageEnemy(world, e, slot.stats.damage * slot.stats.zoneDamageMult, hit);
    applySlow(e, moat.slow, TUNING.status.slowSeconds);
  });
}

defineMutation('whirlpool.moat', {
  stats: (s) => {
    s.damage *= moat.damageMult;
  },
  cast: (world, slot) => {
    if (!findNearestEnemy(world, whirlpool.range)) return false;
    slot.activeLeft = whirlpool.duration * slot.stats.duration * slot.stats.zoneDurationMult;
    slot.tickLeft = 0;
    const ring = spawnEntity(world, 'whirlpool.moat', world.player.x, world.player.y, slot.activeLeft);
    ring.radius = moat.outerRadius * slot.stats.area;
    ring.x2 = moat.innerRadius * slot.stats.area; // inner radius, for drawing
    return true;
  },
  update: (world, slot, dt) => {
    for (const ring of entitiesOf(world, 'whirlpool.moat')) {
      ring.x = world.player.x;
      ring.y = world.player.y;
      ring.lifeLeft -= dt;
    }
    if (slot.activeLeft <= 0) return;
    slot.activeLeft -= dt;
    slot.tickLeft -= dt;
    if (slot.tickLeft > 0) return;
    slot.tickLeft += whirlpool.tickInterval;
    moatTick(world, slot);
  },
});

/** Eye of the Storm (Bond, Shell Burst, Wartortle+): every Shell Burst drops a half-size whirlpool at your feet. */
const eye = MUTATIONS['whirlpool.eyeOfTheStorm'].values;
defineMutation('whirlpool.eyeOfTheStorm', {
  stats: (s) => {
    s.cooldown *= eye.cooldownMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'shellBurst') return;
    const s = slot.stats;
    spawnZone(
      world,
      world.player.x,
      world.player.y,
      whirlpool.radius * s.area * eye.sizeMult,
      eye.seconds * s.zoneDurationMult,
      whirlpool.tickInterval,
      s.damage * s.zoneDamageMult,
      s.critChance,
      { slow: s.slow, stun: 0, poisonDps: 0, attackType: s.attackType },
      'whirlpool',
    );
  },
});
