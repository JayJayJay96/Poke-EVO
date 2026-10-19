import { TUNING } from '../../data/content';
import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { applySlow, canTrap, damageEnemy, findNearestEnemy, makeHitInfo, procHit, soak } from '../combat';
import { BLAST_SECONDS } from '../forms/projectile';
import { defineMutation } from '../hooks';
import type { MoveSlot, World, Zone } from '../types';
import { spawnZone } from '../zones';
import { dirTo, entitiesOf, forEachEnemyIn, ranked, spawnEntity } from './util';

// Whirlpool Mutations (docs/moveset/shared/whirlpool.md, squirtle/README.md).

const whirlpool = MOVES.whirlpool as ZoneMoveDef;

/** Drags light enemies inside the zone toward its centre (heavier ones hold their ground). */
function pullIn(world: World, zone: Zone, speed: number, dt: number): void {
  forEachEnemyIn(world, zone.x, zone.y, zone.radius, (e) => {
    if (!canTrap(e)) return;
    const [dx, dy] = dirTo(e.x, e.y, zone.x, zone.y);
    e.x += dx * speed * dt;
    e.y += dy * speed * dt;
  });
}

/** Maelstrom (generic): the vortex drags light enemies in, then collapses into a burst that grows with the crowd. */
const mael = ranked('whirlpool.maelstrom');
defineMutation('whirlpool.maelstrom', {
  stats: (s, _world, slot) => {
    s.cooldown *= mael(slot).cooldownMult;
  },
  onCast: (world, slot) => {
    const zone = world.zones[world.zones.length - 1];
    if (zone?.source === 'whirlpool') slot.mutState.zoneId = zone.id;
  },
  update: (world, slot, dt) => {
    const zone = world.zones.find((z) => z.id === slot.mutState.zoneId && z.lifeLeft > 0);
    if (!zone) return;
    const v = mael(slot);
    pullIn(world, zone, v.pullSpeed, dt);
    if (zone.lifeLeft > dt) return;
    // Last step: collapse.
    slot.mutState.zoneId = 0;
    let inside = 0;
    forEachEnemyIn(world, zone.x, zone.y, zone.radius, () => inside++);
    const damage = zone.damage * v.collapseTickMult * (1 + v.perEnemyPct * Math.min(inside, v.maxEnemies));
    const hit = procHit(zone.attackType);
    forEachEnemyIn(world, zone.x, zone.y, zone.radius, (e) => damageEnemy(world, e, damage, hit));
    world.blasts.push({ x: zone.x, y: zone.y, radius: zone.radius, lifeLeft: BLAST_SECONDS * 2, type: 'Water' });
  },
});

/** Moat (generic): Whirlpool becomes a ring around you that follows you and slows (III: Soaks) whatever crosses it. */
const moat = ranked('whirlpool.moat');

function moatTick(world: World, slot: MoveSlot): void {
  const { player } = world;
  const area = slot.stats.area;
  const v = moat(slot);
  const inner = v.innerRadius * area;
  const outer = v.outerRadius * area;
  const hit = makeHitInfo(slot.stats, slot);
  hit.slow = 0;
  forEachEnemyIn(world, player.x, player.y, outer, (e) => {
    if (Math.hypot(e.x - player.x, e.y - player.y) + e.radius < inner) return; // the safe middle
    damageEnemy(world, e, slot.stats.damage * slot.stats.zoneDamageMult, hit);
    applySlow(e, v.slow, TUNING.status.slowSeconds);
    if (v.soaksCrossers) soak(e);
  });
}

defineMutation('whirlpool.moat', {
  stats: (s, _world, slot) => {
    s.damage *= moat(slot).damageMult;
  },
  cast: (world, slot) => {
    if (!findNearestEnemy(world, whirlpool.range)) return false;
    slot.activeLeft = whirlpool.duration * slot.stats.duration * slot.stats.zoneDurationMult;
    slot.tickLeft = 0;
    const ring = spawnEntity(world, 'whirlpool.moat', world.player.x, world.player.y, slot.activeLeft);
    ring.radius = moat(slot).outerRadius * slot.stats.area;
    ring.x2 = moat(slot).innerRadius * slot.stats.area; // inner radius, for drawing
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

/** Eye of the Storm (Bond, Shell Burst, Wartortle+): every Shell Burst drops a half-size whirlpool at your feet (III: it pulls). */
const eye = ranked('whirlpool.eyeOfTheStorm');
defineMutation('whirlpool.eyeOfTheStorm', {
  stats: (s, _world, slot) => {
    s.cooldown *= eye(slot).cooldownMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'shellBurst') return;
    const s = slot.stats;
    const v = eye(slot);
    const zone = spawnZone(
      world,
      world.player.x,
      world.player.y,
      whirlpool.radius * s.area * v.sizeMult,
      v.seconds * s.zoneDurationMult,
      whirlpool.tickInterval,
      s.damage * s.zoneDamageMult,
      s.critChance,
      { slow: s.slow, stun: 0, poisonDps: 0, attackType: s.attackType },
      'whirlpool',
    );
    if (zone) slot.mutState.eyeZone = zone.id;
  },
  update: (world, slot, dt) => {
    const speed = eye(slot).pullSpeed;
    if (speed <= 0 || !slot.mutState.eyeZone) return;
    const zone = world.zones.find((z) => z.id === slot.mutState.eyeZone && z.lifeLeft > 0);
    if (zone) pullIn(world, zone, speed, dt);
  },
});
