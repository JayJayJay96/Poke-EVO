import { ABILITIES, TUNING } from '../../data/content';
import { MUTATIONS } from '../../data/mutations';
import { applySeed } from '../combat';
import { defineMutation } from '../hooks';
import type { Enemy } from '../types';
import { forEachEnemyIn } from './util';

// Leech Seed Mutations (docs/moveset/shared/leech-seed.md, bulbasaur/README.md).

/** Spreading Seed (generic): when a Seeded enemy faints, its seed jumps on with the time left (once). */
const spread = MUTATIONS['leechSeed.spread'].values;
defineMutation('leechSeed.spread', {
  onHit: (_world, _slot, enemy) => {
    // Shorter seeds: the duration was just refreshed by this hit.
    if (enemy.seedLeft > 0) enemy.seedLeft = Math.min(enemy.seedLeft, TUNING.status.seedSeconds * spread.durationMult);
  },
  onEvent: (world, _slot, event, _amount, fainted) => {
    if (event !== 'kill' || !fainted || fainted.seedLeft <= 0 || fainted.seedJumped) return;
    let next: Enemy | null = null;
    let best = spread.jumpRange * spread.jumpRange;
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
    next.seedJumped = true; // a seed that already jumped can't jump again
  },
});

/** Seed Bomb (generic): the seed bursts on impact and Seeds everything around it, weaker. */
const bomb = MUTATIONS['leechSeed.seedBomb'].values;
defineMutation('leechSeed.seedBomb', {
  stats: (s) => {
    s.cooldown *= bomb.cooldownMult;
  },
  onProjectileHit: (world, _slot, proj, primary) => {
    const dps = proj.hit.seedDps * bomb.seedStrength;
    forEachEnemyIn(world, proj.x, proj.y, bomb.radius, (e) => {
      if (e !== primary) applySeed(e, dps, TUNING.status.seedSeconds);
    });
  },
});

/**
 * Seed Network (Bond, Leech strength): the move feeds the ability: every Seeded enemy alive raises
 * Leech a little, up to a cap. Seed damage is lower.
 */
const network = MUTATIONS['leechSeed.seedNetwork'].values;
defineMutation('leechSeed.seedNetwork', {
  stats: (s) => {
    s.seedPct *= network.seedDamageMult;
  },
  // Counted once per step, not per hit.
  update: (world, slot) => {
    let seeded = 0;
    for (const e of world.enemies) if (e.seedLeft > 0 && e.hp > 0) seeded++;
    slot.mutState.bonus = Math.min(network.maxLeechBonus, seeded * network.leechPerSeeded);
  },
  leechBonus: (world, slot) => ((ABILITIES[world.player.ability].lifesteal ?? 0) > 0 ? (slot.mutState.bonus ?? 0) : 0),
});
