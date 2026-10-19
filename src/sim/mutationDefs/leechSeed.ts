import { ABILITIES, TUNING } from '../../data/content';
import { applySeed } from '../combat';
import { defineMutation } from '../hooks';
import type { Enemy } from '../types';
import { forEachEnemyIn, ranked } from './util';

// Leech Seed Mutations (docs/moveset/shared/leech-seed.md, bulbasaur/README.md).

/** Spreading Seed (generic): when a Seeded enemy faints, its seed jumps on with the time left (once; III twice). */
const spread = ranked('leechSeed.spread');
defineMutation('leechSeed.spread', {
  onHit: (_world, slot, enemy) => {
    // Shorter seeds: the duration was just refreshed by this hit.
    if (enemy.seedLeft > 0) enemy.seedLeft = Math.min(enemy.seedLeft, TUNING.status.seedSeconds * spread(slot).durationMult);
  },
  onEvent: (world, slot, event, _amount, fainted) => {
    const v = spread(slot);
    if (event !== 'kill' || !fainted || fainted.seedLeft <= 0 || fainted.seedJumps >= v.maxJumps) return;
    let next: Enemy | null = null;
    let best = v.jumpRange * v.jumpRange;
    for (const e of world.enemies) {
      if (e === fainted || e.hp <= 0) continue;
      const d2 = (e.x - fainted.x) ** 2 + (e.y - fainted.y) ** 2;
      if (d2 <= best) {
        best = d2;
        next = e;
      }
    }
    if (!next) return;
    applySeed(next, fainted.seedDps, fainted.seedLeft);
    next.seedJumps = fainted.seedJumps + 1;
  },
});

/** Seed Bomb (generic): the seed bursts on impact and Seeds everything around it, weaker. */
const bomb = ranked('leechSeed.seedBomb');
defineMutation('leechSeed.seedBomb', {
  stats: (s, _world, slot) => {
    s.cooldown *= bomb(slot).cooldownMult;
  },
  onProjectileHit: (world, slot, proj, primary) => {
    const v = bomb(slot);
    const dps = proj.hit.seedDps * v.seedStrength;
    forEachEnemyIn(world, proj.x, proj.y, v.radius, (e) => {
      if (e !== primary) applySeed(e, dps, TUNING.status.seedSeconds);
    });
  },
});

/**
 * Seed Network (Bond, Leech strength): the move feeds the ability: every Seeded enemy alive raises
 * Leech a little, up to a cap. Seed damage is lower.
 */
const network = ranked('leechSeed.seedNetwork');
defineMutation('leechSeed.seedNetwork', {
  stats: (s, _world, slot) => {
    s.seedPct *= network(slot).seedDamageMult;
  },
  // Counted once per step, not per hit.
  update: (world, slot) => {
    let seeded = 0;
    for (const e of world.enemies) if (e.seedLeft > 0 && e.hp > 0) seeded++;
    slot.mutState.bonus = Math.min(network(slot).maxLeechBonus, seeded * network(slot).leechPerSeeded);
  },
  leechBonus: (world, slot) => ((ABILITIES[world.player.ability].lifesteal ?? 0) > 0 ? (slot.mutState.bonus ?? 0) : 0),
});
