import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { MUTATION_TUNING, MUTATIONS } from '../../data/mutations';
import { MAX_ENEMY_RADIUS, applyNewStun, canTrap, findNearestEnemy, pushEnemy } from '../combat';
import { swingArc } from '../forms/melee';
import { defineMutation } from '../hooks';
import { dirTo, entitiesOf, spawnEntity } from './util';

// Wing Attack Mutations (docs/moveset/shared/wing-attack.md, charmander/README.md).

const wingAttack = MOVES.wingAttack as MeleeMoveDef;

/** Updraft (generic): the gusts lift light enemies for a moment; they land with a small stagger. */
const updraft = MUTATIONS['wingAttack.updraft'].values;
defineMutation('wingAttack.updraft', {
  stats: (s) => {
    s.damage *= updraft.damageMult;
  },
  onHit: (world, _slot, enemy) => {
    // Already in the air (the other wing) or stunned: no second lift.
    if (enemy.hp <= 0 || enemy.stunLeft > 0 || !canTrap(enemy) || !applyNewStun(enemy, updraft.liftSeconds)) return;
    const lift = spawnEntity(world, 'wingAttack.updraft', enemy.x, enemy.y, updraft.liftSeconds);
    lift.hitIds.push(enemy.id);
  },
  update: (world, _slot, dt) => {
    for (const lift of entitiesOf(world, 'wingAttack.updraft')) {
      lift.lifeLeft -= dt;
      if (lift.lifeLeft > 0) continue;
      const e = world.enemies.find((en) => en.id === lift.hitIds[0] && en.hp > 0);
      if (!e) continue;
      const [dx, dy] = dirTo(world.player.x, world.player.y, e.x, e.y);
      pushEnemy(e, dx, dy, updraft.landStagger);
    }
  },
});

/** Backdraft (generic): the wings beat behind you: one wide rear gust that pushes harder. */
const back = MUTATIONS['wingAttack.backdraft'].values;
defineMutation('wingAttack.backdraft', {
  stats: (s) => {
    s.knockback += back.stagger - (wingAttack.onHit?.knockback ?? 0);
  },
  cast: (world, slot) => {
    const reach = wingAttack.reach * slot.stats.area * slot.stats.reachMult;
    if (!findNearestEnemy(world, reach + MAX_ENEMY_RADIUS)) return false;
    const { faceX, faceY } = world.player;
    swingArc(world, slot, -faceX, -faceY, back.arcDeg * slot.stats.arcMult, reach);
    return true;
  },
});

/** Fan the Flames (Bond, your Scorch, Charizard): Scorch patches the gusts touch flare, grow and drift. */
const fan = MUTATIONS['wingAttack.fanTheFlames'].values;
const MAX_FANNED_RADIUS = MUTATION_TUNING.scorch.radius * (1 + fan.growPct);
defineMutation('wingAttack.fanTheFlames', {
  stats: (s) => {
    s.damage *= fan.damageMult;
  },
  onCast: (world) => {
    const { player } = world;
    // The gusts this cast just drew.
    const gusts = world.swings.slice(-(wingAttack.sides?.length ?? 1));
    for (const patch of world.scorches) {
      if (patch.lifeLeft <= 0) continue;
      const dx = patch.x - player.x;
      const dy = patch.y - player.y;
      const dist = Math.hypot(dx, dy);
      const gust = gusts.find(
        (g) => dist - patch.radius <= g.reach && (dist <= patch.radius || (dx * g.dirX + dy * g.dirY) / dist >= Math.cos(g.halfArc)),
      );
      if (!gust) continue;
      patch.lifeLeft = Math.max(patch.lifeLeft, fan.refreshSeconds);
      patch.duration = Math.max(patch.duration, patch.lifeLeft);
      patch.radius = Math.min(MAX_FANNED_RADIUS, patch.radius * (1 + fan.growPct));
      patch.x += gust.dirX * fan.driftPx;
      patch.y += gust.dirY * fan.driftPx;
    }
  },
});
