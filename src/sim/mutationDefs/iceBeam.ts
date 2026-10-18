import { MOVES, type BeamMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { applyNewStun } from '../combat';
import { beamLength } from '../forms/beam';
import { defineMutation, tideFlood } from '../hooks';
import { capEntities, entitiesOf, forEachEnemyOnSegment, spawnEntity } from './util';

// Ice Beam Mutations (docs/moveset/shared/ice-beam.md, lapras/README.md).

const iceBeam = MOVES.iceBeam as BeamMoveDef;

/** Ice Wall (generic): where the beam ends, a wall forms across it for a while; enemies slide around it. */
const wall = MUTATIONS['iceBeam.iceWall'].values;
defineMutation('iceBeam.iceWall', {
  stats: (s) => {
    s.damage *= wall.damageMult;
  },
  onCast: (world, slot) => {
    const length = beamLength(slot, iceBeam);
    const cx = world.player.x + slot.dirX * length;
    const cy = world.player.y + slot.dirY * length;
    const half = (wall.wallWidth * slot.stats.area) / 2;
    // Across the beam: the perpendicular of its direction.
    const w = spawnEntity(world, 'iceBeam.iceWall', cx - slot.dirY * half, cy + slot.dirX * half, wall.wallSeconds);
    w.x2 = cx + slot.dirY * half;
    w.y2 = cy - slot.dirX * half;
    w.radius = wall.wallThickness / 2;
    capEntities(world, 'iceBeam.iceWall', wall.maxWalls);
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
const aurora = MUTATIONS['iceBeam.aurora'].values;
defineMutation('iceBeam.aurora', {
  stats: (s) => {
    s.damage *= aurora.damageMult;
    s.slow = aurora.slow;
  },
  onHit: (_world, _slot, enemy) => {
    enemy.weakenMult = aurora.contactDamageMult;
    enemy.weakenLeft = Math.max(enemy.weakenLeft, aurora.debuffSeconds);
  },
});

/** Flash Freeze (Bond, below the Tide level): in Flood, Ice Beam freezes instead of slowing; in Ebb it slows harder and is wider. */
const freeze = MUTATIONS['iceBeam.flashFreeze'];
defineMutation('iceBeam.flashFreeze', {
  stats: (s) => {
    s.damage *= freeze.values.damageMult;
  },
  live: (s, world) => {
    if (tideFlood(world)) {
      s.slow = 0;
      return;
    }
    s.slow = freeze.tide.ebb.slow;
    s.widthMult *= freeze.tide.ebb.widthMult;
  },
  onHit: (world, _slot, enemy) => {
    // One freeze per beam: later ticks don't refresh it; stun fatigue applies after.
    if (!tideFlood(world) || enemy.stunLeft > 0) return;
    applyNewStun(enemy, freeze.tide.flood.freezeSeconds);
  },
});
