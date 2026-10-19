import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { MUTATION_TUNING } from '../../data/mutations';
import { MAX_ENEMY_RADIUS, applyNewStun, canTrap, findNearestEnemy, pushEnemy } from '../combat';
import { swingArc } from '../forms/melee';
import { defineMutation } from '../hooks';
import { dirTo, entitiesOf, ranked, spawnEntity } from './util';

// Wing Attack Mutations (docs/moveset/shared/wing-attack.md, charmander/README.md).

const wingAttack = MOVES.wingAttack as MeleeMoveDef;

/** Updraft (generic): the gusts lift light enemies for a moment; they land with a small stagger. */
const updraft = ranked('wingAttack.updraft');
defineMutation('wingAttack.updraft', {
  stats: (s, _world, slot) => {
    s.damage *= updraft(slot).damageMult;
  },
  onHit: (world, slot, enemy) => {
    const lift = updraft(slot).liftSeconds;
    // Already in the air (the other wing) or stunned: no second lift.
    if (enemy.hp <= 0 || enemy.stunLeft > 0 || !canTrap(enemy) || !applyNewStun(enemy, lift)) return;
    const entity = spawnEntity(world, 'wingAttack.updraft', enemy.x, enemy.y, lift);
    entity.hitIds.push(enemy.id);
  },
  update: (world, slot, dt) => {
    for (const lift of entitiesOf(world, 'wingAttack.updraft')) {
      lift.lifeLeft -= dt;
      if (lift.lifeLeft > 0) continue;
      const e = world.enemies.find((en) => en.id === lift.hitIds[0] && en.hp > 0);
      if (!e) continue;
      const [dx, dy] = dirTo(world.player.x, world.player.y, e.x, e.y);
      pushEnemy(e, dx, dy, updraft(slot).landStagger);
    }
  },
});

/** Backdraft (generic): the wings beat behind you: one wide rear gust that pushes harder. */
const back = ranked('wingAttack.backdraft');
defineMutation('wingAttack.backdraft', {
  stats: (s, _world, slot) => {
    s.knockback += back(slot).stagger - (wingAttack.onHit?.knockback ?? 0);
    s.damage *= back(slot).damageMult;
  },
  cast: (world, slot) => {
    const reach = wingAttack.reach * slot.stats.area * slot.stats.reachMult;
    if (!findNearestEnemy(world, reach + MAX_ENEMY_RADIUS)) return false;
    const { faceX, faceY } = world.player;
    swingArc(world, slot, -faceX, -faceY, back(slot).arcDeg * slot.stats.arcMult, reach);
    return true;
  },
});

/** Fan the Flames (Bond, your Scorch, Charizard): Scorch patches the gusts touch flare, grow and drift. */
const fan = ranked('wingAttack.fanTheFlames');
defineMutation('wingAttack.fanTheFlames', {
  stats: (s, _world, slot) => {
    s.damage *= fan(slot).damageMult;
  },
  onCast: (world, slot) => {
    const { player } = world;
    const v = fan(slot);
    const maxRadius = MUTATION_TUNING.scorch.radius * (1 + v.growPct);
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
      patch.lifeLeft = Math.max(patch.lifeLeft, v.refreshSeconds);
      patch.duration = Math.max(patch.duration, patch.lifeLeft);
      patch.radius = Math.min(maxRadius, patch.radius * (1 + v.growPct));
      patch.x += gust.dirX * v.driftPx;
      patch.y += gust.dirY * v.driftPx;
    }
  },
});
