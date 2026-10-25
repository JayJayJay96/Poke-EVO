import { MOVES, type OrbitMoveDef } from '../../data/moves';
import { damageEnemy, procHit } from '../combat';
import { orbitBalls } from '../forms/orbit';
import { ARC_SECONDS } from '../forms/projectile';
import { defineMutation } from '../hooks';
import { applyPlayerStatus } from '../playerStatus';
import { forEachEnemyOnSegment, ranked } from './util';

// Thrash Mutations (docs/moveset/mankey §4, D56).

const thrash = MOVES.thrash as OrbitMoveDef;

/** Outrage (generic): the flailing lasts twice as long, and leaves you Confused. */
const outrage = ranked('thrash.outrage');
defineMutation('thrash.outrage', {
  stats: (s, _world, slot) => {
    s.duration *= outrage(slot).durationMult;
    s.cooldown *= outrage(slot).cooldownMult;
  },
  onExpire: (world, slot) => {
    applyPlayerStatus(world, 'confusion', { seconds: outrage(slot).confuseSeconds });
  },
});

/** Parting Jabs (generic): when it ends, each fist flies straight out. */
const jabs = ranked('thrash.partingJabs');
defineMutation('thrash.partingJabs', {
  stats: (s, _world, slot) => {
    s.cooldown *= jabs(slot).cooldownMult;
  },
  onExpire: (world, slot) => {
    const v = jabs(slot);
    const { player } = world;
    const hit = procHit(slot.stats.attackType);
    for (const ball of orbitBalls(slot, thrash, player)) {
      const dx = ball.x - player.x;
      const dy = ball.y - player.y;
      const d = Math.hypot(dx, dy) || 1;
      const x2 = ball.x + (dx / d) * v.jabRange;
      const y2 = ball.y + (dy / d) * v.jabRange;
      forEachEnemyOnSegment(world, ball.x, ball.y, x2, y2, v.jabWidth, (e) => damageEnemy(world, e, slot.stats.damage * v.jabFraction, hit));
      world.arcs.push({ x1: ball.x, y1: ball.y, x2, y2, lifeLeft: ARC_SECONDS });
    }
  },
});

/** Berserk Flurry (Bond, Rampage starts, Primeape+): every Rampage sets Thrash off at once with extra fists. */
const flurry = ranked('thrash.berserkFlurry');
defineMutation('thrash.berserkFlurry', {
  stats: (s, _world, slot) => {
    s.damage *= flurry(slot).damageMult;
  },
  onEvent: (_world, slot, event) => {
    if (event !== 'rampage') return;
    const seconds = thrash.duration * slot.stats.duration;
    slot.activeLeft = Math.max(slot.activeLeft, seconds);
    slot.hitCooldowns.clear();
    slot.mutState.flurryLeft = seconds;
  },
  live: (s, _world, slot) => {
    if ((slot.mutState.flurryLeft ?? 0) > 0) s.extraCount += thrash.count * (flurry(slot).fistMult - 1);
  },
  update: (_world, slot, dt) => {
    if (slot.mutState.flurryLeft) slot.mutState.flurryLeft = Math.max(0, slot.mutState.flurryLeft - dt);
  },
});
