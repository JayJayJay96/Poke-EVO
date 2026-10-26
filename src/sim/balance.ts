import { TUNING, type PokemonId } from '../data/content';
import { MOVES } from '../data/moves';
import { SITE_TUNING } from '../data/sites';
import { chooseEvolutionTrait, dismissEvolution, finishEvolutionCinematic } from './evolution';
import { chooseAugment, chooseCard, chooseReplace, chooseSkill } from './progression';
import { createSeededRng, type Rng } from './rng';
import { chooseArenaReward, chooseBoon, chooseCombine } from './arena';
import { lineBlocked, playerTraversal } from './map';
import { chooseSiteCard } from './sites';
import { currentStage } from './stats';
import type { World } from './types';
import { createWorld, runClock, spawnEnemy, step } from './world';

// Early-vs-late gamble check (§5, P4d). A headless bot plays a line with random card
// picks and never takes damage; at each checkpoint a ring of training dummies replaces
// the horde for a few seconds to measure damage per second, then the run carries on.
// It compares lines with each other, not with real play: no dodging, no low-HP abilities,
// every gem collected.

const DUMMY_COUNT = 16;
const DUMMY_HP = 1e9;
const MEASURE_SECONDS = 10;
/** Site-taking bot: seconds per roaming leg. */
const ROAM_SECONDS = 8;
/** Steering (D47 map): how far ahead the bot looks, and the turns it tries (degrees) when that way is blocked. */
const STEER_LOOK = 80;
const STEER_TURNS = [30, 60, 90, 120, 150];

/**
 * Turns a wanted direction into one the bot can walk on the map, like a player steering round a pond or a pair of
 * trees: straight if the next `STEER_LOOK` px are clear, else the smallest turn that is, keeping to the side it
 * first turned to so it follows the same shore. Side 0 means it isn't steering. Map off: unchanged.
 */
export function steer(world: World, dx: number, dy: number, state: { side: number }): [number, number] {
  const { x, y, radius } = world.player;
  const flag = playerTraversal(world);
  const clear = (ax: number, ay: number): boolean => !lineBlocked(world, x, y, x + ax * STEER_LOOK, y + ay * STEER_LOOK, radius, flag);
  if ((dx === 0 && dy === 0) || world.map.density <= 0 || clear(dx, dy)) {
    state.side = 0;
    return [dx, dy];
  }
  // Not steering yet: the smallest turn either way. Already steering: every turn on that side before the other,
  // or it flip-flops along a shore.
  const tries: [number, number][] = state.side
    ? [...STEER_TURNS.map((deg): [number, number] => [deg, state.side]), ...STEER_TURNS.map((deg): [number, number] => [deg, -state.side])]
    : STEER_TURNS.flatMap((deg): [number, number][] => [[deg, 1], [deg, -1]]);
  for (const [deg, side] of tries) {
    const a = (deg * Math.PI * side) / 180;
    const ax = dx * Math.cos(a) - dy * Math.sin(a);
    const ay = dx * Math.sin(a) + dy * Math.cos(a);
    if (clear(ax, ay)) {
      state.side = side;
      return [ax, ay];
    }
  }
  return [dx, dy]; // boxed in: push on and let the slide sort it out
}

export interface Checkpoint {
  /** Run time in seconds. */
  readonly time: number;
  readonly level: number;
  /** Stage name and current signature move. */
  readonly form: string;
  /** Damage per second against the dummy ring. */
  readonly dps: number;
  /** Max HP ÷ damage taken multiplier. */
  readonly effectiveHp: number;
  readonly kills: number;
  readonly moves: string;
  /** Mutations held, with rank (P4h-9: the site-taking bot). */
  readonly mutations: string;
  /** Sites opened so far. */
  readonly sites: number;
  /** Power Surges from the augment-level fallback (the timed site surge isn't counted). */
  readonly surges: number;
}

export interface PlayOptions {
  /**
   * Walk to the nearest Mutation Site in HUD-arrow range and stand in it until it opens; with none in
   * range, roam (a new random heading every `ROAM_SECONDS`) to find more, as a player would (P4h-9).
   */
  readonly sites?: boolean;
}

/** Resolves whatever window is open with a random choice, like a player who doesn't plan. */
function autoPick(world: World, rng: Rng): void {
  const pick = (n: number) => Math.floor(rng.next() * n);
  const evo = world.evolution;
  if (evo) {
    if (evo.phase === 'cinematic') finishEvolutionCinematic(world);
    else if (evo.traitChoices) chooseEvolutionTrait(world, pick(evo.traitChoices.length));
    else dismissEvolution(world);
    return;
  }
  const offer = world.offer;
  if (!offer) return;
  switch (offer.kind) {
    case 'cards': {
      // D19 measures firepower: the bot skips status moves with no damage (Smokescreen) when it can.
      const useful = offer.cards.flatMap((c, i) => (c.kind === 'move' && MOVES[c.moveId].damage <= 0 ? [] : [i]));
      chooseCard(world, useful.length > 0 ? useful[pick(useful.length)]! : pick(offer.cards.length));
      break;
    }
    case 'pickSkill':
      chooseSkill(world, pick(offer.slots.length));
      break;
    case 'augment':
      chooseAugment(world, pick(offer.cards.length));
      break;
    case 'replace':
      chooseReplace(world, pick(world.moves[offer.slot]!.sockets.length));
      break;
    // Without `sites` the bot only meets sites its circle crosses; either way it takes a random card.
    case 'site':
      chooseSiteCard(world, pick(offer.cards.length));
      break;
    case 'boon':
      chooseBoon(world, pick(offer.cards.length));
      break;
    case 'combine':
      chooseCombine(world, pick(offer.slots.length));
      break;
    case 'arenaReward':
      chooseArenaReward(world, pick(offer.cards.length));
      break;
  }
}

/** The dummy ring: `count` dummies spread over `rings` circles from `innerDist`, `step` px apart. */
export interface DummyRing {
  readonly innerDist: number;
  readonly count: number;
  readonly rings: number;
  readonly step: number;
}

const BALANCE_RING: DummyRing = { innerDist: 60, count: DUMMY_COUNT, rings: 4, step: 50 };

/**
 * Swaps the horde for a dummy ring, measures DPS, then puts everything back. `resolve` closes any
 * window that opens meanwhile (a banked level-up auto-opening, a site): an open window pauses the sim,
 * which used to read as near-zero DPS for that seed.
 */
export function measureDps(world: World, ring: DummyRing = BALANCE_RING, resolve?: () => void): number {
  const saved = { enemies: world.enemies, time: world.time, spawnEnabled: world.spawnEnabled, density: world.map.density };
  // Measured on an empty field: the map's rocks and ponds would only add noise to a DPS number (D47).
  world.map.density = 0;
  world.enemies = [];
  world.zones = [];
  world.projectiles = [];
  world.spawnEnabled = false;
  const { x, y } = world.player;
  const dummies = Array.from({ length: ring.count }, (_, i) => {
    const angle = (i / ring.count) * Math.PI * 2;
    const dist = ring.innerDist + (i % ring.rings) * ring.step;
    const e = spawnEnemy(world, 'raticate', x + Math.cos(angle) * dist, y + Math.sin(angle) * dist);
    e.maxHp = e.hp = DUMMY_HP;
    return { e, x: e.x, y: e.y };
  });
  const steps = Math.round(MEASURE_SECONDS / TUNING.stepSeconds);
  for (let i = 0; i < steps; i++) {
    while (resolve && (world.offer || world.evolution)) resolve();
    world.player.invulnLeft = Infinity;
    // Pinned in place: knockback and separation don't spread the ring out.
    for (const d of dummies) {
      d.e.x = d.x;
      d.e.y = d.y;
      d.e.kbX = d.e.kbY = d.e.speed = 0;
    }
    step(world, { moveX: 0, moveY: 0 }, TUNING.stepSeconds);
  }
  const dealt = dummies.reduce((sum, { e }) => sum + (e.maxHp - e.hp), 0);
  world.enemies = saved.enemies;
  world.zones = [];
  world.projectiles = [];
  world.time = saved.time;
  world.spawnEnabled = saved.spawnEnabled;
  world.map.density = saved.density;
  return dealt / MEASURE_SECONDS;
}

/** Unit vector to the nearest site in arrow range (zero once inside it), or null when there is none. */
function towardSite(world: World): [number, number] | null {
  const { x, y } = world.player;
  let best: World['sites'][number] | null = null;
  let bestD2 = SITE_TUNING.arrowRange ** 2;
  for (const site of world.sites) {
    const d2 = (site.x - x) ** 2 + (site.y - y) ** 2;
    if (d2 < bestD2) [best, bestD2] = [site, d2];
  }
  if (!best) return null;
  const d = Math.sqrt(bestD2);
  // Stand near the centre so capture never drops out at the edge.
  return d < best.radius * 0.5 ? [0, 0] : [(best.x - x) / d, (best.y - y) / d];
}

/** Plays one run of a line to the last checkpoint. Deterministic for a seed. */
export function playLine(
  pokemonId: PokemonId,
  seed: number,
  checkpoints: readonly number[],
  options: PlayOptions = {},
): Checkpoint[] {
  // On the real map (README §13): the bot slides round obstacles and swims like a player; DPS is measured off it.
  const world = createWorld({ rng: createSeededRng(seed), pokemonId, spawnRadius: 600, obstacleDensity: 1 });
  const picks = createSeededRng(seed + 7919);
  const results: Checkpoint[] = [];
  let frame = 0;
  let sitesOpened = 0;
  // Own stream, so roaming doesn't change the card picks' sequence.
  const roam = createSeededRng(seed + 31337);
  let heading = roam.next() * Math.PI * 2;
  let legLeft = ROAM_SECONDS;
  const steering = { side: 0 };
  const walk = (dx: number, dy: number): void => {
    const [mx, my] = steer(world, dx, dy, steering);
    step(world, { moveX: mx, moveY: my }, TUNING.stepSeconds);
  };
  for (const time of checkpoints) {
    while (runClock(world) < time && world.status === 'running') {
      world.player.invulnLeft = Infinity;
      // Perfect gem collector: real players walk to far kills, the bot can't, and
      // long-range lines would starve of XP otherwise.
      world.player.pickupRadius = 1e6;
      if (world.offer || world.evolution) {
        if (world.offer?.kind === 'site') sitesOpened++;
        autoPick(world, picks);
        continue;
      }
      const site = options.sites ? towardSite(world) : null;
      if (site) {
        walk(site[0], site[1]);
        continue;
      }
      if (options.sites) {
        legLeft -= TUNING.stepSeconds;
        if (legLeft <= 0) [heading, legLeft] = [roam.next() * Math.PI * 2, ROAM_SECONDS];
        walk(Math.cos(heading), Math.sin(heading));
        continue;
      }
      // Walk a slow circle so gems keep getting collected.
      const a = (frame++ / 600) * Math.PI * 2;
      walk(Math.cos(a), Math.sin(a));
    }
    while (world.offer || world.evolution) autoPick(world, picks);
    results.push({
      time,
      level: world.level,
      form: `${currentStage(world).name}/${MOVES[world.moves[0]!.moveId].name}`,
      dps: measureDps(world, BALANCE_RING, () => autoPick(world, picks)),
      effectiveHp: world.player.maxHp / world.mods.damageTakenMult,
      kills: world.kills,
      moves: world.moves.map((m) => `${m.moveId}[${m.sockets.map((s) => s.augmentId + s.rank).join(',')}]`).join(' '),
      mutations: world.moves.flatMap((m) => (m.mutation ? [`${m.mutation}${m.mutationRank}`] : [])).join(' '),
      sites: sitesOpened,
      surges: world.bigBoosts,
    });
  }
  return results;
}
