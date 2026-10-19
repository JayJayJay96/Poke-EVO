import { MOVES, type BeamMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { damageEnemy, findNearestEnemy, procHit } from '../combat';
import { beamLength } from '../forms/beam';
import { defineMutation, standingStill } from '../hooks';
import type { Enemy } from '../types';
import { dirTo, entitiesOf, forEachEnemyOnSegment, ranked, spawnEntity } from './util';

// Solar Beam Mutations (docs/moveset/shared/solar-beam.md, bulbasaur/README.md). Venusaur only.

const solarBeam = MOVES.solarBeam as BeamMoveDef;

/** Full Charge (generic): like the real move: a telegraphed charge, then a far wider, harder beam. */
const charge = ranked('solarBeam.fullCharge');
defineMutation('solarBeam.fullCharge', {
  stats: (s, _world, slot) => {
    const v = charge(slot);
    s.damage *= v.damageMult;
    s.widthMult *= v.widthMult;
    s.cooldown *= v.cooldownMult;
  },
  cast: (world, slot) => {
    const target = findNearestEnemy(world, solarBeam.range);
    if (!target) return false;
    [slot.dirX, slot.dirY] = dirTo(world.player.x, world.player.y, target.x, target.y);
    slot.mutState.charging = charge(slot).chargeSeconds;
    spawnEntity(world, 'solarBeam.fullCharge', world.player.x, world.player.y, charge(slot).chargeSeconds);
    return true;
  },
  update: (world, slot, dt) => {
    for (const line of entitiesOf(world, 'solarBeam.fullCharge')) {
      const len = beamLength(slot, solarBeam);
      line.x = world.player.x;
      line.y = world.player.y;
      line.x2 = line.x + slot.dirX * len;
      line.y2 = line.y + slot.dirY * len;
      line.lifeLeft -= dt;
    }
    if (!slot.mutState.charging) return;
    slot.mutState.charging = Math.max(0, slot.mutState.charging - dt);
    if (slot.mutState.charging > 0) return;
    slot.activeLeft = solarBeam.duration * slot.stats.duration;
    slot.tickLeft = 0;
  },
});

/** Prism (generic): at the first enemy the beam splits into thinner beams fanning out behind it. */
const prism = ranked('solarBeam.prism');
const HALF_FAN = (MUTATIONS['solarBeam.prism'].values.fanDeg * Math.PI) / 360;
defineMutation('solarBeam.prism', {
  stats: (s, _world, slot) => {
    s.damage *= prism(slot).damageMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.tick = 0;
  },
  update: (world, slot, dt) => {
    if (slot.activeLeft <= 0) return;
    slot.mutState.tick = (slot.mutState.tick ?? 0) - dt;
    if (slot.mutState.tick > 0) return;
    slot.mutState.tick += solarBeam.tickInterval;
    const { player } = world;
    const len = beamLength(slot, solarBeam);
    const width = solarBeam.width * slot.stats.area * slot.stats.widthMult;
    // The first enemy along the beam is where it splits.
    let split: Enemy | null = null;
    let along = Infinity;
    forEachEnemyOnSegment(world, player.x, player.y, player.x + slot.dirX * len, player.y + slot.dirY * len, width, (e) => {
      const d = (e.x - player.x) * slot.dirX + (e.y - player.y) * slot.dirY;
      if (d < along) {
        along = d;
        split = e;
      }
    });
    const at = split as Enemy | null;
    if (!at) return;
    const rest = len - along;
    const base = Math.atan2(slot.dirY, slot.dirX);
    const hit = procHit(slot.stats.attackType);
    const v = prism(slot);
    const damage = (slot.stats.damage / v.damageMult) * v.beamDamageFraction;
    for (let i = 0; i < v.beams; i++) {
      const a = base - HALF_FAN + (v.beams > 1 ? (i / (v.beams - 1)) * HALF_FAN * 2 : HALF_FAN);
      const x2 = at.x + Math.cos(a) * rest;
      const y2 = at.y + Math.sin(a) * rest;
      forEachEnemyOnSegment(world, at.x, at.y, x2, y2, width * v.widthMult, (e) => {
        if (e !== at) damageEnemy(world, e, damage, hit);
      });
    }
  },
});

/** Ingrain (Bond, standing still, Venusaur): rooted, Solar Beam recharges twice as fast and you take less damage. */
const ingrain = ranked('solarBeam.ingrain');
defineMutation('solarBeam.ingrain', {
  live: (s, world, slot) => {
    if (world.player.movingFor > 0) s.damage *= ingrain(slot).damageMultMoving;
  },
  update: (world, slot, dt) => {
    const v = ingrain(slot);
    if (standingStill(world, v.stillSeconds)) {
      slot.cooldownLeft = Math.max(0, slot.cooldownLeft - dt * (v.cooldownRate - 1));
    }
  },
  damageTakenMult: (world, slot) => {
    const v = ingrain(slot);
    return standingStill(world, v.stillSeconds) ? v.damageTakenMult : 1;
  },
});
