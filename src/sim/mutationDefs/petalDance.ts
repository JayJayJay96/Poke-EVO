import { MOVES, type OrbitMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { damageEnemy, procHit } from '../combat';
import { orbitBalls, orbitCenter } from '../forms/orbit';
import { defineMutation, healPlayer } from '../hooks';
import type { Enemy } from '../types';
import { dirTo, entitiesOf, forEachEnemyIn, spawnEntity } from './util';

// Petal Dance Mutations (docs/moveset/shared/petal-dance.md, bulbasaur/README.md).

const petalDance = MOVES.petalDance as OrbitMoveDef;

/** Frenzy Dance (generic): the petals spin faster and faster, then fly outward; you're unsteady while dancing. */
const frenzy = MUTATIONS['petalDance.frenzy'].values;
defineMutation('petalDance.frenzy', {
  onCast: (_world, slot) => {
    slot.mutState.total = slot.activeLeft;
  },
  live: (s, _world, slot) => {
    if (slot.activeLeft > 0) s.spinMult *= 1 + frenzy.spinRampPerSec * ((slot.mutState.total ?? 0) - slot.activeLeft);
  },
  update: (world, slot, dt) => {
    // In the last second the petals fly off as projectiles and the dance ends.
    if (slot.activeLeft > 0 && slot.activeLeft <= frenzy.flyOutSeconds) {
      const center = orbitCenter(slot, world.player);
      for (const ball of orbitBalls(slot, petalDance, world.player)) {
        const petal = spawnEntity(world, 'petalDance.frenzy', ball.x, ball.y, frenzy.petalRange / frenzy.petalSpeed);
        const [dx, dy] = dirTo(center.x, center.y, ball.x, ball.y);
        petal.vx = dx * frenzy.petalSpeed;
        petal.vy = dy * frenzy.petalSpeed;
        petal.radius = frenzy.petalRadius;
        petal.damage = slot.stats.damage;
      }
      slot.activeLeft = 0;
    }
    const hit = procHit(slot.stats.attackType);
    for (const petal of entitiesOf(world, 'petalDance.frenzy')) {
      petal.x += petal.vx * dt;
      petal.y += petal.vy * dt;
      petal.lifeLeft -= dt;
      let target: Enemy | null = null;
      forEachEnemyIn(world, petal.x, petal.y, petal.radius, (e) => {
        target ??= e;
      });
      if (!target) continue;
      damageEnemy(world, target, petal.damage, hit);
      petal.lifeLeft = 0;
    }
  },
  moveSpeedMult: (_world, slot) => (slot.activeLeft > 0 ? frenzy.moveSpeedMult : 1),
});

/** Pollen Ring (generic): petal hits heal you a little, up to a cap per second. */
const pollen = MUTATIONS['petalDance.pollen'].values;
defineMutation('petalDance.pollen', {
  stats: (s) => {
    s.damage *= pollen.damageMult;
  },
  onHit: (world, slot) => {
    if (world.time >= (slot.mutState.windowEnd ?? 0)) {
      slot.mutState.windowEnd = world.time + 1;
      slot.mutState.healed = 0;
    }
    const room = pollen.maxHealPerSec - (slot.mutState.healed ?? 0);
    if (room <= 0) return;
    const heal = Math.min(room, pollen.healPerHit);
    slot.mutState.healed = (slot.mutState.healed ?? 0) + heal;
    healPlayer(world, heal);
  },
});

/**
 * Petal Blizzard (Bond, Bloom, Ivysaur+): every Bloom sets Petal Dance off at once with double petals for
 * a short while. It is Petal Dance itself, with its stat augments and no other Mutation.
 */
const blizzard = MUTATIONS['petalDance.petalBlizzard'].values;
defineMutation('petalDance.petalBlizzard', {
  stats: (s) => {
    s.cooldown *= blizzard.cooldownMult;
  },
  onEvent: (_world, slot, event) => {
    if (event !== 'bloom') return;
    slot.activeLeft = Math.max(slot.activeLeft, blizzard.seconds);
    slot.hitCooldowns.clear();
    slot.mutState.blizzardLeft = blizzard.seconds;
  },
  live: (s, _world, slot) => {
    if ((slot.mutState.blizzardLeft ?? 0) > 0) s.extraCount += petalDance.count * (blizzard.petalMult - 1);
  },
  update: (_world, slot, dt) => {
    if (slot.mutState.blizzardLeft) slot.mutState.blizzardLeft = Math.max(0, slot.mutState.blizzardLeft - dt);
  },
});
