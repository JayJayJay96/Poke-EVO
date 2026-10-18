import { MOVES, type BeamMoveDef } from '../../data/moves';
import { MUTATIONS, MUTATION_TUNING } from '../../data/mutations';
import { applyVuln, soak } from '../combat';
import { beamLength } from '../forms/beam';
import { defineMutation, shellReady } from '../hooks';
import { spawnPuddle } from '../terrain';

// Water Gun Mutations (docs/moveset/shared/water-gun.md, squirtle/README.md).

const waterGun = MOVES.waterGun as BeamMoveDef;

/** Slick (generic): the beam leaves a line of puddles along its length; light enemies slip in them. */
const slick = MUTATIONS['waterGun.slick'].values;
defineMutation('waterGun.slick', {
  stats: (s) => {
    s.damage *= slick.damageMult;
  },
  onCast: (world, slot) => {
    const { player } = world;
    const r = MUTATION_TUNING.puddle.radius;
    const length = beamLength(slot, waterGun);
    // Puddles edge to edge from the player to the beam's end (the 6-puddle cap still applies).
    for (let d = r; d <= length; d += r * 2) {
      spawnPuddle(world, player.x + slot.dirX * d, player.y + slot.dirY * d, slick.puddleSeconds, slick.slipChancePerSec, slick.slipStun);
    }
  },
});

/** Steady Aim (Bond, Shell ready): longer beam and double push while Shell is up; weaker while it's down. */
const steadyAim = MUTATIONS['waterGun.steadyAim'].values;
defineMutation('waterGun.steadyAim', {
  live: (s, world) => {
    if (shellReady(world)) {
      s.reachMult *= steadyAim.lengthMult;
      s.knockback *= steadyAim.pushMult;
    } else {
      s.damage *= steadyAim.damageMultShellDown;
    }
  },
});

/** Wash Down (generic): a support beam. Soaks, and hit enemies take more from Water moves for a while. */
const washDown = MUTATIONS['waterGun.washDown'].values;
defineMutation('waterGun.washDown', {
  stats: (s) => {
    s.damage *= washDown.damageMult;
    s.knockback *= washDown.pushMult;
  },
  onHit: (_world, _slot, enemy) => {
    soak(enemy);
    applyVuln(enemy, washDown.waterDamageTakenPct, washDown.debuffSeconds, 'Water');
  },
});
