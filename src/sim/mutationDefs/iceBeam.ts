import { MOVES, type BeamMoveDef } from '../../data/moves';
import { rankedTide } from '../../data/mutations';
import { applyNewStun } from '../combat';
import { beamLength } from '../forms/beam';
import { defineMutation, tideFlood } from '../hooks';
import type { MoveSlot } from '../types';
import { capEntities, entitiesOf, forEachEnemyOnSegment, ranked, spawnEntity } from './util';

// Ice Beam Mutations (docs/moveset/shared/ice-beam.md, lapras/README.md).

const iceBeam = MOVES.iceBeam as BeamMoveDef;

/** Ice Wall (generic): where the beam ends, a wall forms across it for a while; enemies slide around it. */
const wall = ranked('iceBeam.iceWall');
defineMutation('iceBeam.iceWall', {
  stats: (s, _world, slot) => {
    s.damage *= wall(slot).damageMult;
  },
  onCast: (world, slot) => {
    const v = wall(slot);
    const length = beamLength(slot, iceBeam);
    const cx = world.player.x + slot.dirX * length;
    const cy = world.player.y + slot.dirY * length;
    const half = (v.wallWidth * slot.stats.area) / 2;
    // Across the beam: the perpendicular of its direction.
    const w = spawnEntity(world, 'iceBeam.iceWall', cx - slot.dirY * half, cy + slot.dirX * half, v.wallSeconds);
    w.x2 = cx + slot.dirY * half;
    w.y2 = cy - slot.dirX * half;
    w.radius = v.wallThickness / 2;
    capEntities(world, 'iceBeam.iceWall', v.maxWalls);
  },
  update: (world, _slot, dt) => {
    const { player } = world;
    for (const w of entitiesOf(world, 'iceBeam.iceWall')) {
      w.lifeLeft -= dt;
      if (w.lifeLeft <= 0) continue;
      const sx = w.x2 - w.x;
      const sy = w.y2 - w.y;
      const len2 = sx * sx + sy * sy || 1;
      // Enemies inside the wall are pushed back out along its normal, so they slide along it.
      forEachEnemyOnSegment(world, w.x, w.y, w.x2, w.y2, w.radius * 2, (e) => {
        const t = Math.min(1, Math.max(0, ((e.x - w.x) * sx + (e.y - w.y) * sy) / len2));
        const px = w.x + sx * t;
        const py = w.y + sy * t;
        let nx = e.x - px;
        let ny = e.y - py;
        let d = Math.hypot(nx, ny);
        if (d === 0) {
          // Right on the line: push to the side away from the player.
          const len = Math.sqrt(len2);
          nx = -sy / len;
          ny = sx / len;
          if (nx * (player.x - px) + ny * (player.y - py) > 0) {
            nx = -nx;
            ny = -ny;
          }
          d = 1;
        }
        const out = w.radius + e.radius;
        e.x = px + (nx / d) * out;
        e.y = py + (ny / d) * out;
      });
    }
  },
});

/** Aurora Beam (generic): enemies hit deal less contact damage for a while; weaker and a lighter slow. */
const aurora = ranked('iceBeam.aurora');
defineMutation('iceBeam.aurora', {
  stats: (s, _world, slot) => {
    s.damage *= aurora(slot).damageMult;
    s.slow = aurora(slot).slow;
  },
  onHit: (_world, slot, enemy) => {
    const v = aurora(slot);
    enemy.weakenMult = v.contactDamageMult;
    enemy.weakenLeft = Math.max(enemy.weakenLeft, v.debuffSeconds);
  },
});

/** Flash Freeze (Bond, below the Tide level): in Flood, Ice Beam freezes instead of slowing; in Ebb it slows harder and is wider. */
const freeze = ranked('iceBeam.flashFreeze');
const freezeTide = (slot: MoveSlot) => rankedTide('iceBeam.flashFreeze', slot.mutationRank);
defineMutation('iceBeam.flashFreeze', {
  stats: (s, _world, slot) => {
    s.damage *= freeze(slot).damageMult;
  },
  live: (s, world, slot) => {
    if (tideFlood(world)) {
      s.slow = 0;
      return;
    }
    const { ebb } = freezeTide(slot);
    s.slow = ebb.slow;
    s.widthMult *= ebb.widthMult;
  },
  onHit: (world, slot, enemy) => {
    // One freeze per beam: later ticks don't refresh it; stun fatigue applies after.
    if (!tideFlood(world) || enemy.stunLeft > 0) return;
    applyNewStun(enemy, freezeTide(slot).flood.freezeSeconds);
  },
});
