import { MOVES, type OrbitMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { defineMutation } from '../hooks';

// Rapid Spin Mutations (docs/moveset/shared/rapid-spin.md, squirtle/README.md).

const rapidSpin = MOVES.rapidSpin as OrbitMoveDef;

/** Spiral Spin (generic): the shells spiral out over the spin, sweeping the inner and the outer ring. */
const spiral = MUTATIONS['rapidSpin.spiralSpin'].values;
defineMutation('rapidSpin.spiralSpin', {
  stats: (s) => {
    s.damage *= spiral.damageMult;
  },
  live: (s, _world, slot) => {
    const total = rapidSpin.duration * slot.baseStats.duration;
    const progress = slot.activeLeft > 0 ? 1 - slot.activeLeft / total : 0;
    s.orbitRadiusMult = (spiral.innerRadius + (spiral.outerRadius - spiral.innerRadius) * progress) / rapidSpin.orbitRadius;
  },
});

/**
 * Deflector (generic): the shells eat enemy projectiles, each one adding spin time.
 * Ranged enemies arrive in P5; until then there is nothing to deflect and only the cost applies.
 */
const deflector = MUTATIONS['rapidSpin.deflector'].values;
defineMutation('rapidSpin.deflector', {
  stats: (s) => {
    s.damage *= deflector.damageMult;
  },
});

/** Shell Spin (Bond, Shell recharge): each enemy the shells hit cuts Shell's recharge, up to a cap per spin. */
const shellSpin = MUTATIONS['rapidSpin.shellSpin'].values;
defineMutation('rapidSpin.shellSpin', {
  stats: (s) => {
    s.damage *= shellSpin.damageMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.cut = 0;
  },
  onHit: (world, slot) => {
    const p = world.player;
    const room = shellSpin.maxCutPerCast - (slot.mutState.cut ?? 0);
    if (room <= 0 || p.blockReadyLeft <= 0) return;
    const cut = Math.min(room, shellSpin.rechargeCutPerHit, p.blockReadyLeft);
    p.blockReadyLeft -= cut;
    slot.mutState.cut = (slot.mutState.cut ?? 0) + cut;
  },
});
