import { MUTATIONS } from '../../data/mutations';
import { damageEnemy, procHit } from '../combat';
import { bulbCapacity, defineMutation } from '../hooks';
import { forEachEnemyIn } from './util';

// Tackle Mutations (docs/moveset/shared/tackle.md, bulbasaur/README.md).

/** Rollout (generic): every Tackle that connects builds a stack (more damage and reach); a miss resets it. */
const rollout = MUTATIONS['tackle.rollout'].values;
defineMutation('tackle.rollout', {
  onHit: (_world, slot) => {
    slot.mutState.castHits = (slot.mutState.castHits ?? 0) + 1;
  },
  onCast: (_world, slot) => {
    const stacks = slot.mutState.stacks ?? 0;
    slot.mutState.stacks = slot.mutState.castHits ? Math.min(rollout.maxStacks, stacks + 1) : 0;
    slot.mutState.castHits = 0;
  },
  live: (s, _world, slot) => {
    const stacks = slot.mutState.stacks ?? 0;
    s.damage *= rollout.damageMult * (1 + rollout.stackDamagePct * stacks);
    s.reachMult *= 1 + rollout.stackReachPct * stacks;
  },
});

/** Bowling (generic): Tackle staggers, and an enemy knocked into another hurts it. */
const bowling = MUTATIONS['tackle.bowling'].values;
defineMutation('tackle.bowling', {
  stats: (s) => {
    s.knockback += bowling.stagger;
    s.cooldown *= bowling.cooldownMult;
  },
  onHit: (world, _slot, enemy, dealt, hit) => {
    // Whoever stands right behind it, in the direction it was knocked, gets bowled over.
    const x = enemy.x + hit.dirX * enemy.radius * 2;
    const y = enemy.y + hit.dirY * enemy.radius * 2;
    const pin = procHit(hit.attackType);
    forEachEnemyIn(world, x, y, enemy.radius, (other) => {
      if (other !== enemy) damageEnemy(world, other, dealt * bowling.collisionDamageFraction, pin);
    });
  },
});

/** Bulb Bash (Bond, Bulb fill, Ivysaur+): Tackle hits with the bulb, harder the fuller it is. */
const bash = MUTATIONS['tackle.bulbBash'].values;
defineMutation('tackle.bulbBash', {
  live: (s, world) => {
    const cap = bulbCapacity(world);
    const fill = cap > 0 ? world.player.bulb / cap : 0;
    s.damage *= bash.emptyMult + (1 + bash.maxBonus - bash.emptyMult) * fill;
  },
});
