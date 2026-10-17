import { MAX_RANK, type AugmentId } from '../data/augments';
import type { EnemyId } from '../data/content';
import type { MoveId } from '../data/moves';
import { BOOST_IDS, BOOST_MAX_PICKS } from '../data/upgrades';
import { createSlot, refreshStats } from './stats';
import type { World } from './types';
import { spawnEnemy } from './world';

// Stress-test setup for the performance budget (PROJECT.md §11.1, P2d):
// a maxed build against a constant 500 enemies. Dev/measurement only.

export const STRESS_ENEMIES = 500;
/** Tough enough that the horde stays near 500 instead of melting instantly. */
const STRESS_HP_SCALE = 8;
const STRESS_KINDS: readonly EnemyId[] = ['rattata', 'rattata', 'pidgey', 'raticate'];

const STRESS_BUILD: ReadonlyArray<readonly [MoveId, readonly AugmentId[]]> = [
  // Ember is the projectile-heaviest build possible: Multishot III + Scatter III.
  ['ember', ['multishot', 'scatter', 'velocity']],
  ['scratch', ['powerUp', 'enlarge', 'quickCast']],
  ['fireSpin', ['powerUp', 'enlarge', 'quickCast']],
  ['dragonRage', ['powerUp', 'enlarge', 'quickCast']],
];

export function setupStress(world: World): void {
  world.spawnEnabled = false;
  world.moves = STRESS_BUILD.map(([moveId, augments]) => {
    const slot = createSlot(moveId);
    slot.sockets = augments.map((augmentId) => ({ augmentId, rank: MAX_RANK }));
    return slot;
  });
  for (const id of BOOST_IDS) world.boosts[id] = BOOST_MAX_PICKS;
  world.items = ['leftovers', 'quickClaw', 'wideLens'];
  refreshStats(world);
  world.player.invulnLeft = Infinity; // never takes damage, never faints
  topUpStress(world);
}

/** Keeps the field at STRESS_ENEMIES and skips level-up windows. Call before each frame's steps. */
export function topUpStress(world: World): void {
  world.offer = null;
  world.pendingLevelUps = 0;
  const { player, rng } = world;
  while (world.enemies.length < STRESS_ENEMIES) {
    const angle = rng.next() * Math.PI * 2;
    const dist = 120 + rng.next() * Math.max(200, world.spawnRadius - 120);
    const kind = STRESS_KINDS[Math.floor(rng.next() * STRESS_KINDS.length)]!;
    spawnEnemy(world, kind, player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, STRESS_HP_SCALE);
  }
}
