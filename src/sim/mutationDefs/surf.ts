import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { canTrap, damageEnemy, findNearestEnemy, makeHitInfo, procHit, pushEnemy } from '../combat';
import { defineMutation, hpBelow, tideFlood } from '../hooks';
import { dirTo, entitiesOf, forEachEnemyIn, forEachEnemyOnSegment, spawnEntity } from './util';

// Surf Mutations (docs/moveset/shared/surf.md; Bonds in squirtle/ and lapras/).

const surf = MOVES.surf as MeleeMoveDef;

/** Ride the Wave (generic): Surf becomes a wall rolling the way you move, carrying light enemies; you speed up. */
const ride = MUTATIONS['surf.rideTheWave'].values;
defineMutation('surf.rideTheWave', {
  cast: (world, slot) => {
    if (!findNearestEnemy(world, ride.travel)) return false;
    const { player } = world;
    const wave = spawnEntity(world, 'surf.rideTheWave', player.x, player.y, ride.travel / ride.waveSpeed);
    wave.vx = player.faceX * ride.waveSpeed;
    wave.vy = player.faceY * ride.waveSpeed;
    wave.radius = (ride.wallLength / 2) * slot.stats.area;
    wave.damage = slot.stats.damage;
    slot.mutState.speedLeft = ride.speedSeconds;
    return true;
  },
  update: (world, slot, dt) => {
    if (slot.mutState.speedLeft) slot.mutState.speedLeft = Math.max(0, slot.mutState.speedLeft - dt);
    for (const wave of entitiesOf(world, 'surf.rideTheWave')) {
      wave.x += wave.vx * dt;
      wave.y += wave.vy * dt;
      wave.lifeLeft -= dt;
      const [dx, dy] = dirTo(0, 0, wave.vx, wave.vy);
      const hit = makeHitInfo(slot.stats, slot);
      hit.dirX = dx;
      hit.dirY = dy;
      // The wall is perpendicular to its travel.
      const px = -dy * wave.radius;
      const py = dx * wave.radius;
      forEachEnemyOnSegment(world, wave.x - px, wave.y - py, wave.x + px, wave.y + py, ride.wallThickness, (e) => {
        if (wave.hitIds.includes(e.id)) return;
        wave.hitIds.push(e.id);
        damageEnemy(world, e, wave.damage, hit);
        if (canTrap(e)) pushEnemy(e, dx, dy, ride.carryPx);
      });
    }
  },
  moveSpeedMult: (_world, slot) => (slot.mutState.speedLeft ? 1 + ride.moveSpeedPct : 1),
});

/** Backwash (generic): after the wave reaches its edge it rolls back in, hitting again and pulling enemies in. */
const back = MUTATIONS['surf.backwash'].values;
defineMutation('surf.backwash', {
  stats: (s) => {
    s.cooldown *= back.cooldownMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.backLeft = back.returnDelay;
  },
  update: (world, slot, dt) => {
    if (!slot.mutState.backLeft) return;
    slot.mutState.backLeft = Math.max(0, slot.mutState.backLeft - dt);
    if (slot.mutState.backLeft > 0) return;
    const { player } = world;
    const reach = surf.reach * slot.stats.area * slot.stats.reachMult;
    const hit = procHit(slot.stats.attackType);
    forEachEnemyIn(world, player.x, player.y, reach, (e) => {
      damageEnemy(world, e, slot.stats.damage * back.returnDamageFraction, hit);
      if (canTrap(e)) {
        const [dx, dy] = dirTo(e.x, e.y, player.x, player.y);
        pushEnemy(e, dx, dy, back.pullPx);
      }
    });
  },
});

/** Last Wave (Bond, HP below 40%): a tank's last stand: Surf comes faster and wider; weaker above it. */
const last = MUTATIONS['surf.lastWave'].values;
defineMutation('surf.lastWave', {
  live: (s, world) => {
    if (hpBelow(world, last.hpThreshold)) {
      s.cooldown *= last.cooldownMult;
      s.reachMult *= last.radiusMult;
    } else {
      s.damage *= last.damageMultAbove;
    }
  },
});

/** Ferry Wave (Bond, XP gems, Tide): Surf pulls the XP gems around you in; in Flood from further, with a burst of speed. */
const ferry = MUTATIONS['surf.ferryWave'];
defineMutation('surf.ferryWave', {
  stats: (s) => {
    s.damage *= ferry.values.damageMult;
  },
  onCast: (world, slot) => {
    const tide = tideFlood(world) ? ferry.tide.flood : ferry.tide.ebb;
    const { x, y } = world.player;
    const r = surf.reach * slot.stats.area * slot.stats.reachMult * tide.gemRadiusMult;
    for (const gem of world.gems) {
      if (!gem.collected && (gem.x - x) ** 2 + (gem.y - y) ** 2 <= r * r) gem.magnetized = true;
    }
    if (tide.speedSeconds > 0) slot.mutState.speedLeft = tide.speedSeconds;
  },
  update: (_world, slot, dt) => {
    if (slot.mutState.speedLeft) slot.mutState.speedLeft = Math.max(0, slot.mutState.speedLeft - dt);
  },
  moveSpeedMult: (_world, slot) => (slot.mutState.speedLeft ? 1 + ferry.tide.flood.moveSpeedPct : 1),
});
