import { damageEnemy, procHit } from '../combat';
import { bulbCapacity, defineMutation } from '../hooks';
import { forEachEnemyIn, ranked } from './util';

// Tackle Mutations (docs/moveset/shared/tackle.md, bulbasaur/README.md).

/** Rollout (generic): every Tackle that connects builds a stack (more damage and reach); a miss resets it. */
const rollout = ranked('tackle.rollout');
defineMutation('tackle.rollout', {
  onHit: (_world, slot) => {
    slot.mutState.castHits = (slot.mutState.castHits ?? 0) + 1;
  },
  onCast: (_world, slot) => {
    const stacks = slot.mutState.stacks ?? 0;
    slot.mutState.stacks = slot.mutState.castHits ? Math.min(rollout(slot).maxStacks, stacks + 1) : 0;
    slot.mutState.castHits = 0;
  },
  live: (s, _world, slot) => {
    const stacks = slot.mutState.stacks ?? 0;
    const v = rollout(slot);
    s.damage *= v.damageMult * (1 + v.stackDamagePct * stacks);
    s.reachMult *= 1 + v.stackReachPct * stacks;
  },
});

/** Bowling (generic): Tackle staggers, and an enemy knocked into another hurts it. */
const bowling = ranked('tackle.bowling');
defineMutation('tackle.bowling', {
  stats: (s, _world, slot) => {
    s.knockback += bowling(slot).stagger;
    s.cooldown *= bowling(slot).cooldownMult;
  },
  onHit: (world, slot, enemy, dealt, hit) => {
    // Whoever stands right behind it, in the direction it was knocked, gets bowled over.
    const x = enemy.x + hit.dirX * enemy.radius * 2;
    const y = enemy.y + hit.dirY * enemy.radius * 2;
    const pin = procHit(hit.attackType);
    forEachEnemyIn(world, x, y, enemy.radius, (other) => {
      if (other !== enemy) damageEnemy(world, other, dealt * bowling(slot).collisionDamageFraction, pin);
    });
  },
});

/** Bulb Bash (Bond, Bulb fill, Ivysaur+): Tackle hits with the bulb, harder the fuller it is. */
const bash = ranked('tackle.bulbBash');
defineMutation('tackle.bulbBash', {
  live: (s, world, slot) => {
    const v = bash(slot);
    const cap = bulbCapacity(world);
    const fill = cap > 0 ? world.player.bulb / cap : 0;
    s.damage *= v.emptyMult + (1 + v.maxBonus - v.emptyMult) * fill;
  },
});
