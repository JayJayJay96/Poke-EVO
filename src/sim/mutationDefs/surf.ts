import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { rankedTide } from '../../data/mutations';
import { canTrap, damageEnemy, findNearestEnemy, makeHitInfo, procHit, pushEnemy, soak } from '../combat';
import { defineMutation, hpBelow, tideFlood } from '../hooks';
import type { MoveSlot } from '../types';
import { dirTo, entitiesOf, forEachEnemyIn, forEachEnemyOnSegment, ranked, spawnEntity } from './util';

// Surf Mutations (docs/moveset/shared/surf.md; Bonds in squirtle/ and lapras/).

const surf = MOVES.surf as MeleeMoveDef;

/** Ride the Wave (generic): Surf becomes a wall rolling the way you move, carrying light enemies; you speed up. */
const ride = ranked('surf.rideTheWave');
defineMutation('surf.rideTheWave', {
  cast: (world, slot) => {
    const v = ride(slot);
    if (!findNearestEnemy(world, v.travel)) return false;
    const { player } = world;
    const wave = spawnEntity(world, 'surf.rideTheWave', player.x, player.y, v.travel / v.waveSpeed);
    wave.vx = player.faceX * v.waveSpeed;
    wave.vy = player.faceY * v.waveSpeed;
    wave.radius = (v.wallLength / 2) * slot.stats.area;
    wave.damage = slot.stats.damage * v.waveDamageMult;
    slot.mutState.speedLeft = v.speedSeconds;
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
      const v = ride(slot);
      forEachEnemyOnSegment(world, wave.x - px, wave.y - py, wave.x + px, wave.y + py, v.wallThickness, (e) => {
        if (wave.hitIds.includes(e.id)) return;
        wave.hitIds.push(e.id);
        damageEnemy(world, e, wave.damage, hit);
        if (canTrap(e)) pushEnemy(e, dx, dy, v.carryPx);
      });
    }
  },
  moveSpeedMult: (_world, slot) => (slot.mutState.speedLeft ? 1 + ride(slot).moveSpeedPct : 1),
});

/** Backwash (generic): after the wave reaches its edge it rolls back in, hitting again and pulling enemies in (III: Soaking). */
const back = ranked('surf.backwash');
defineMutation('surf.backwash', {
  stats: (s, _world, slot) => {
    s.cooldown *= back(slot).cooldownMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.backLeft = back(slot).returnDelay;
  },
  update: (world, slot, dt) => {
    if (!slot.mutState.backLeft) return;
    slot.mutState.backLeft = Math.max(0, slot.mutState.backLeft - dt);
    if (slot.mutState.backLeft > 0) return;
    const { player } = world;
    const reach = surf.reach * slot.stats.area * slot.stats.reachMult;
    const hit = procHit(slot.stats.attackType);
    const v = back(slot);
    forEachEnemyIn(world, player.x, player.y, reach, (e) => {
      damageEnemy(world, e, slot.stats.damage * v.returnDamageFraction, hit);
      if (v.returnSoaks) soak(e);
      if (canTrap(e)) {
        const [dx, dy] = dirTo(e.x, e.y, player.x, player.y);
        pushEnemy(e, dx, dy, v.pullPx);
      }
    });
  },
});

/** Last Wave (Bond, HP below 40%): a tank's last stand: Surf comes faster and wider; weaker above it. */
const last = ranked('surf.lastWave');
defineMutation('surf.lastWave', {
  live: (s, world, slot) => {
    const v = last(slot);
    if (hpBelow(world, v.hpThreshold)) {
      s.cooldown *= v.cooldownMult;
      s.reachMult *= v.radiusMult;
    } else {
      s.damage *= v.damageMultAbove;
    }
  },
});

/** Ferry Wave (Bond, XP gems, Tide): Surf pulls the XP gems around you in; in Flood from further, with a burst of speed. */
const ferry = ranked('surf.ferryWave');
const ferryTide = (slot: MoveSlot) => rankedTide('surf.ferryWave', slot.mutationRank);
defineMutation('surf.ferryWave', {
  stats: (s, _world, slot) => {
    s.damage *= ferry(slot).damageMult;
  },
  onCast: (world, slot) => {
    const tide = tideFlood(world) ? ferryTide(slot).flood : ferryTide(slot).ebb;
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
  moveSpeedMult: (_world, slot) => (slot.mutState.speedLeft ? 1 + ferryTide(slot).flood.moveSpeedPct : 1),
});
