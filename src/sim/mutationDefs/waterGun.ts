import { MOVES, type BeamMoveDef } from '../../data/moves';
import { MUTATION_TUNING } from '../../data/mutations';
import { applyVuln, applyVulnAll, soak } from '../combat';
import { beamLength } from '../forms/beam';
import { defineMutation, shellReady } from '../hooks';
import { spawnPuddle } from '../terrain';
import { ranked } from './util';

// Water Gun Mutations (docs/moveset/shared/water-gun.md, squirtle/README.md).

const waterGun = MOVES.waterGun as BeamMoveDef;

/** Slick (generic): the beam leaves a line of puddles along its length; light enemies slip in them. */
const slick = ranked('waterGun.slick');
defineMutation('waterGun.slick', {
  stats: (s, _world, slot) => {
    s.damage *= slick(slot).damageMult;
  },
  onCast: (world, slot) => {
    const { player } = world;
    const { puddleSeconds, slipChancePerSec, slipStun } = slick(slot);
    const r = MUTATION_TUNING.puddle.radius;
    const length = beamLength(slot, waterGun);
    // Puddles edge to edge from the player to the beam's end (the 6-puddle cap still applies).
    for (let d = r; d <= length; d += r * 2) {
      spawnPuddle(world, player.x + slot.dirX * d, player.y + slot.dirY * d, puddleSeconds, slipChancePerSec, slipStun);
    }
  },
});

/** Steady Aim (Bond, Shell ready): longer beam and double push while Shell is up (III: harder too); weaker while it's down. */
const steadyAim = ranked('waterGun.steadyAim');
defineMutation('waterGun.steadyAim', {
  live: (s, world, slot) => {
    const v = steadyAim(slot);
    if (shellReady(world)) {
      s.reachMult *= v.lengthMult;
      s.knockback *= v.pushMult;
      s.damage *= v.shellUpDamageMult;
    } else {
      s.damage *= v.damageMultShellDown;
    }
  },
});

/** Wash Down (generic): a support beam. Soaks, and hit enemies take more from Water moves (III: and from every type) for a while. */
const washDown = ranked('waterGun.washDown');
defineMutation('waterGun.washDown', {
  stats: (s, _world, slot) => {
    s.damage *= washDown(slot).damageMult;
    s.knockback *= washDown(slot).pushMult;
  },
  onHit: (_world, slot, enemy) => {
    const v = washDown(slot);
    soak(enemy);
    applyVuln(enemy, v.waterDamageTakenPct, v.debuffSeconds, 'Water');
    if (v.otherDamageTakenPct > 0) applyVulnAll(enemy, v.otherDamageTakenPct, v.debuffSeconds);
  },
});
