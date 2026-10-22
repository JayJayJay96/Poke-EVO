import { MOVES, type OrbitMoveDef } from '../../data/moves';
import { defineMutation } from '../hooks';
import { ranked } from './util';

// Rapid Spin Mutations (docs/moveset/shared/rapid-spin.md, squirtle/README.md).

const rapidSpin = MOVES.rapidSpin as OrbitMoveDef;

/** Spiral Spin (generic): the shells spiral out over the spin, sweeping the inner and the outer ring. */
const spiral = ranked('rapidSpin.spiralSpin');
defineMutation('rapidSpin.spiralSpin', {
  stats: (s, _world, slot) => {
    s.damage *= spiral(slot).damageMult;
  },
  live: (s, _world, slot) => {
    const { innerRadius, outerRadius } = spiral(slot);
    const total = rapidSpin.duration * slot.baseStats.duration;
    const progress = slot.activeLeft > 0 ? 1 - slot.activeLeft / total : 0;
    s.orbitRadiusMult = (innerRadius + (outerRadius - innerRadius) * progress) / rapidSpin.orbitRadius;
  },
});

// Deflector (generic) eats enemy projectiles. Not registered (so never offered at sites) until enemies
// shoot in P5: until then it would be all cost and no effect (owner D29 audit, 2026-10-22).

/** Shell Spin (Bond, Shell recharge): each enemy the shells hit cuts Shell's recharge, up to a cap per spin. */
const shellSpin = ranked('rapidSpin.shellSpin');
defineMutation('rapidSpin.shellSpin', {
  stats: (s, _world, slot) => {
    s.damage *= shellSpin(slot).damageMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.cut = 0;
  },
  onHit: (world, slot) => {
    const p = world.player;
    const v = shellSpin(slot);
    const room = v.maxCutPerCast - (slot.mutState.cut ?? 0);
    if (room <= 0 || p.blockReadyLeft <= 0) return;
    const cut = Math.min(room, v.rechargeCutPerHit, p.blockReadyLeft);
    p.blockReadyLeft -= cut;
    slot.mutState.cut = (slot.mutState.cut ?? 0) + cut;
  },
});
