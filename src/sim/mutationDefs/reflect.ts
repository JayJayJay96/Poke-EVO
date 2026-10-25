import { damageEnemy, procHit } from '../combat';
import { BLAST_SECONDS } from '../forms/projectile';
import { defineMutation } from '../hooks';
import { forEachEnemyIn, ranked } from './util';

// Reflect Mutations (docs/moveset/abra §5, D56). The barrier itself lives on the player (zoneCast raiseBarrier).

/** Light Screen (generic): the barrier also cuts telegraphed attacks, but lasts less. */
const screen = ranked('reflect.lightScreen');
defineMutation('reflect.lightScreen', {
  stats: (s, _world, slot) => {
    s.duration *= screen(slot).durationMult;
  },
  onCast: (world, slot) => {
    world.player.barrierRangedCut = screen(slot).rangedCut;
  },
});

/** Mirror Coat (generic): contact attackers take damage back; the contact cut is smaller. */
const mirror = ranked('reflect.mirrorCoat');
defineMutation('reflect.mirrorCoat', {
  onCast: (world, slot) => {
    world.player.barrierThorns = mirror(slot).thorns;
    world.player.barrierCut = mirror(slot).contactCut;
  },
});

/** Barrier Echo (Bond, hit taken): hits taken behind the barrier charge it; full, it pulses outward (a proc). */
const echo = ranked('reflect.barrierEcho');
defineMutation('reflect.barrierEcho', {
  onEvent: (world, slot, event) => {
    if (event !== 'hitTaken' || world.player.barrierLeft <= 0) return;
    const v = echo(slot);
    slot.mutState.charges = (slot.mutState.charges ?? 0) + 1;
    if (slot.mutState.charges < v.chargesToPulse) return;
    slot.mutState.charges = 0;
    const { x, y } = world.player;
    const damage = (world.moves[0]?.stats.damage ?? 0) * v.pulseMult;
    forEachEnemyIn(world, x, y, v.pulseRadius, (e) => {
      const hit = { ...procHit('Psychic'), knockback: v.knockback };
      const d = Math.hypot(e.x - x, e.y - y) || 1;
      hit.dirX = (e.x - x) / d;
      hit.dirY = (e.y - y) / d;
      damageEnemy(world, e, damage, hit);
    });
    world.blasts.push({ x, y, radius: v.pulseRadius, lifeLeft: BLAST_SECONDS * 2, type: 'Psychic' });
  },
});
