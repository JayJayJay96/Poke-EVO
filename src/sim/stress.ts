import { MAX_RANK, MAX_SOCKETS, maxRankOf, type AugmentId } from '../data/augments';
import { POKEMON, type EnemyId, type PokemonId } from '../data/content';
import type { MoveId } from '../data/moves';
import { MUTATIONS, type MutationDef, type MutationId } from '../data/mutations';
import { MAX_TECHNIQUE_RANK, type TechniqueId } from '../data/techniques';
import { BOOST_IDS, BOOSTS } from '../data/upgrades';

/** The costliest Techniques (on-kill neighbour queries, Focus crits) at max rank. */
const STRESS_TECHNIQUES: readonly TechniqueId[] = ['kindling', 'sporeCloud', 'frostbite', 'focusEnergy', 'moxie'];

/** Every Nature maxed (filler at 5) and a full set of max-rank Techniques. */
function maxPassives(world: World): void {
  for (const id of BOOST_IDS) world.boosts[id] = Math.min(BOOSTS[id].maxPicks, 5);
  world.techniques = STRESS_TECHNIQUES.map((id) => ({ id, rank: MAX_TECHNIQUE_RANK }));
}
import { upgradeSignatureByLevel } from './evolution';
import { grantMutation, socketsUsed } from './mutations';
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
  // Ember: the most projectiles (Multishot + Scatter) with the costliest behaviour (Homing).
  ['ember', ['multishot', 'scatter', 'homing']],
  // The other moves exercise every on-hit path: knockback, burn ticks, lifesteal.
  ['scratch', ['powerUp', 'enlarge', 'knockback']],
  ['fireSpin', ['powerUp', 'enlarge', 'burn']],
  ['dragonRage', ['powerUp', 'enlarge', 'lifesteal']],
];

export function setupStress(world: World): void {
  world.spawnEnabled = false;
  world.moves = STRESS_BUILD.map(([moveId, augments]) => {
    const slot = createSlot(moveId);
    slot.sockets = augments.map((augmentId) => ({ augmentId, rank: Math.min(MAX_RANK, maxRankOf(augmentId)) }));
    return slot;
  });
  maxPassives(world);
  world.items = ['leftovers', 'quickClaw', 'wideLens'];
  refreshStats(world);
  world.player.invulnLeft = Infinity; // never takes damage, never faints
  topUpStress(world);
}

/**
 * Maxed-Mutation variant (P4f-8): each line at its final stage with a Mutation on every move (the ones
 * that spawn the most entities, zones and terrain), the other two sockets filled with maxed augments.
 */
export const STRESS_MUTATION_BUILDS: Record<PokemonId, readonly MutationId[]> = {
  charmander: ['ember.flamethrower', 'fireSpin.flameTrail', 'wingAttack.fanTheFlames', 'slash.afterimage', 'dragonRage.dragonBreath'],
  squirtle: ['bubble.froth', 'whirlpool.maelstrom', 'hydroPump.rainCannon', 'flashCannon.shrapnel', 'rapidSpin.spiralSpin'],
  bulbasaur: ['vineWhip.thornGarden', 'leechSeed.spread', 'petalDance.frenzy', 'poisonPowder.toxic', 'razorLeaf.embed'],
  pikachu: ['thunderShock.ballLightning', 'spark.shower', 'electroBall.ricochet', 'thunderWave.terrain', 'thunder.afterglow'],
  lapras: ['iceShard.hail', 'iceBeam.iceWall', 'bodySlam.shockwave', 'surf.rideTheWave', 'hydroPump.pressureShell'],
  mankey: ['karateChop.vacuum', 'thrash.partingJabs', 'vacuumWave.spread', 'shadowPunch.barrage', 'seismicToss.submission'],
};

/** Augments tried, in order, for the sockets a Mutation leaves free. */
const STRESS_FILLERS: readonly AugmentId[] = ['powerUp', 'quickCast', 'enlarge', 'lifesteal'];

/** The stress setup for `world` (created for that line), with its maxed-Mutation build. */
export function setupMutationStress(world: World): void {
  const line = POKEMON[world.player.pokemonId];
  const last = line.stages.length - 1;
  // Evolve straight to the final stage, the way the cinematic would.
  for (let i = 1; i <= last; i++) {
    const ability = line.stages[i]!.ability;
    if (ability) world.player.ability = ability;
  }
  world.player.stage = last;
  world.moves = [createSlot(line.stages[last]!.signatureMove)];
  // Late-run level: level-based signature tiers (Lapras) are reached; Tide Bonds are in Ebb.
  world.level = 40;
  upgradeSignatureByLevel(world);
  world.signatureTierUp = null;
  for (const id of STRESS_MUTATION_BUILDS[world.player.pokemonId]) {
    const result = grantMutation(world, id);
    if (result !== 'granted') throw new Error(`stress build: ${id} → ${result}`);
    // Maxed: top rank (D24).
    while (grantMutation(world, id) === 'rankUp');
  }
  for (const slot of world.moves) {
    const def: MutationDef | null = slot.mutation ? MUTATIONS[slot.mutation] : null;
    const excluded: readonly string[] = def?.excludesAugments ?? [];
    const fillers = STRESS_FILLERS.filter((id) => !excluded.includes(id)).slice(0, MAX_SOCKETS - socketsUsed(slot));
    slot.sockets = fillers.map((augmentId) => ({ augmentId, rank: Math.min(MAX_RANK, maxRankOf(augmentId)) }));
  }
  world.spawnEnabled = false;
  maxPassives(world);
  world.items = ['leftovers', 'quickClaw', 'wideLens'];
  refreshStats(world);
  world.player.invulnLeft = Infinity;
  topUpStress(world);
}

/** Keeps the field at STRESS_ENEMIES and skips level-up windows and evolutions. Call before each frame's steps. */
export function topUpStress(world: World): void {
  world.offer = null;
  world.evolution = null;
  world.pendingLevelUps = 0;
  const { player, rng } = world;
  while (world.enemies.length < STRESS_ENEMIES) {
    const angle = rng.next() * Math.PI * 2;
    const dist = 120 + rng.next() * Math.max(200, world.spawnRadius - 120);
    const kind = STRESS_KINDS[Math.floor(rng.next() * STRESS_KINDS.length)]!;
    spawnEnemy(world, kind, player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, STRESS_HP_SCALE);
  }
}
