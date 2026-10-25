import { MOVES, type BeamMoveDef } from '../../data/moves';
import { damageEnemy, procHit } from '../combat';
import { ARC_SECONDS } from '../forms/projectile';
import { defineMutation } from '../hooks';
import { forEachEnemyOnSegment, ranked } from './util';

// Psybeam Mutations (docs/moveset/abra §5, D56).

const psybeam = MOVES.psybeam as BeamMoveDef;

/** Signal Sweep (generic): the beam sweeps an arc across its duration. */
const sweep = ranked('psybeam.signalSweep');
defineMutation('psybeam.signalSweep', {
  stats: (s, _world, slot) => {
    s.damage *= sweep(slot).damageMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.total = slot.activeLeft;
    slot.mutState.base = Math.atan2(slot.dirY, slot.dirX);
  },
  beamDirs: (_world, slot) => {
    const total = slot.mutState.total || 1;
    const progress = 1 - Math.max(0, slot.activeLeft) / total;
    const a = (slot.mutState.base ?? 0) + ((sweep(slot).sweepDeg * Math.PI) / 180) * (progress - 0.5);
    return [[Math.cos(a), Math.sin(a)]];
  },
});

/** Disorient (generic): every hit Confuses. */
const disorient = ranked('psybeam.disorient');
defineMutation('psybeam.disorient', {
  stats: (s, _world, slot) => {
    const v = disorient(slot);
    s.confuse = v.confuseSeconds;
    s.confuseChance = 1;
    s.damage *= v.damageMult;
  },
});

/** Blink Beam (Bond, Teleport): each blink fires a full beam from where you were to where you land (a copy). */
const blink = ranked('psybeam.blinkBeam');
defineMutation('psybeam.blinkBeam', {
  onEvent: (world, slot, event) => {
    if (event !== 'teleport') return;
    const v = blink(slot);
    const p = world.player;
    const ticks = Math.max(1, Math.round((psybeam.duration * slot.stats.duration) / psybeam.tickInterval));
    const damage = slot.stats.damage * ticks * v.damageMult;
    const hit = procHit(slot.stats.attackType);
    forEachEnemyOnSegment(world, p.blinkFromX, p.blinkFromY, p.x, p.y, v.width * slot.stats.area, (e) => damageEnemy(world, e, damage, hit));
    world.arcs.push({ x1: p.blinkFromX, y1: p.blinkFromY, x2: p.x, y2: p.y, lifeLeft: ARC_SECONDS * 2 });
  },
});
