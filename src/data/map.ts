import type { ArenaEntranceKind } from './arena';

// Main-map terrain (D47, docs/map/README.md). M2: biomes and hand-made set pieces per chunk. Only trees and boulders
// have rules so far; water, marsh and tall grass get theirs in M3, ledges, berry trees and item balls in M4 (their
// tiles are already laid out, so the lane check and coverage caps count them now). Every number is provisional.

export type ObstacleKind = 'boulder' | 'tree' | 'berryTree';
export type BiomeId = 'meadow' | 'woods' | 'lakes' | 'canyon';
export type SlotKind = 'site' | 'entrance' | 'berry' | 'item';

/**
 * Who can go where (README §4.2). `ground` is blocked by deep water and slowed by marsh; `swim` moves in water at its
 * line's speed and isn't slowed by marsh; `fly` ignores both; `levitate` ignores marsh but can't cross deep water.
 * Tall obstacles stop everyone.
 */
export type Traversal = 'ground' | 'swim' | 'fly' | 'levitate';

/** Map notices (docs/map/INDEX.md §8, M5): first-time tips, plus the horde and foreshadow warnings every time. */
export type MapNoticeId = 'grassRest' | 'grassBurning' | 'swimming' | 'iceBridge' | 'ledgeClimb' | 'hordeEmerge' | `foreshadow.${ArenaEntranceKind}`;

/** What a 50 px cell holds (README §4.3); one byte per cell. */
export const CELL = { open: 0, grass: 1, slow: 2, water: 3 } as const;
export type CellClass = (typeof CELL)[keyof typeof CELL];

/** Set-piece tile → cell class (every other tile is open floor). */
export const CELL_OF_TILE: Readonly<Record<string, CellClass>> = { g: CELL.grass, m: CELL.slow, w: CELL.water };

/**
 * A chunk layout on a 10 × 10 grid of 100 px tiles (README §9). Legend: `.` open · `g` tall grass · `w` deep water ·
 * `m` marsh · `T` tree · `o` boulder · `v` ledge on the tile's south edge · `r` rocky floor · `B` berry tree ·
 * `I` item ball · `S` site · `E` arena entrance. Every edge keeps its doors (tiles 2–3 and 6–7) passable.
 */
export interface SetPieceDef {
  readonly id: string;
  /** Allowed in the start chunk and its 8 neighbours (nothing tall near the middle). */
  readonly startSafe: boolean;
  readonly rows: readonly string[];
}

export interface BiomeDef {
  readonly id: BiomeId;
  /** Added to this biome's noise field before the biggest field wins; tuned so shares land near README §5.2. */
  readonly bias: number;
  /** Most of the chunk's area that may block a walker (tall circles + deep water), R7. */
  readonly maxBlocking: number;
  readonly pieces: readonly { readonly id: string; readonly weight: number }[];
  /** Lone obstacles scattered into empty tiles after the piece, up to `max` and the coverage cap. */
  readonly filler: { readonly kind: Exclude<ObstacleKind, 'berryTree'>; readonly max: number } | null;
}

const OPEN = ['..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........'];

export const SET_PIECES: Readonly<Record<string, SetPieceDef>> = Object.fromEntries(
  (
    [
      { id: 'open', startSafe: true, rows: OPEN },
      // prettier-ignore
      { id: 'meadow.grassRing', startSafe: true, rows: [
        '..........',
        '.gg....gg.',
        '.ggg..ggg.',
        '..g....g..',
        '....S.....',
        '......E...',
        '..g....g..',
        '.ggg..ggg.',
        '.gg..I.gg.',
        '..........',
      ] },
      // prettier-ignore
      { id: 'meadow.ledgeSteps', startSafe: true, rows: [
        '..........',
        '.vvvv.....',
        '..........',
        '....vvvv..',
        '.g........',
        '.gg..vvvv.',
        '..........',
        '..vvvv..I.',
        '..E.......',
        '....B.....',
      ] },
      // prettier-ignore
      { id: 'meadow.berryCopse', startSafe: false, rows: [
        '..........',
        '...g......',
        '..gTBT....',
        '..gT.Tg...',
        '...g.g....',
        '.......I..',
        '......E...',
        '....o.....',
        '.........S',
        '..........',
      ] },
      // prettier-ignore
      { id: 'woods.corridor', startSafe: false, rows: [
        'T...TT...T',
        'T...TT...T',
        '..........',
        '..........',
        'TTTT..TTTT',
        '..........',
        '..S.......',
        '.......I..',
        'T...TT...T',
        'T...TT...T',
      ] },
      // prettier-ignore
      // Corners are pairs, not L's of 3 (D47 amendment 2026-10-26: at most 2 tall tiles touch).
      { id: 'woods.clearing', startSafe: false, rows: [
        'T...TT...T',
        'T........T',
        '..gg..gg..',
        '.g......g.',
        'T..B..S..T',
        'T........T',
        '.g......g.',
        '..gg.Igg..',
        'T........T',
        'T...TT...T',
      ] },
      // prettier-ignore
      { id: 'lakes.pond', startSafe: false, rows: [
        '..........',
        '..mmmm....',
        '.mwwwwm...',
        '.mwwwwwm..',
        '.mwwwwwm..',
        '..mwwwm.E.',
        '...mmm..I.',
        '..........',
        '.g.....S..',
        '.gg.......',
      ] },
      // prettier-ignore
      { id: 'lakes.streamFord', startSafe: false, rows: [
        '..........',
        '....ww....',
        '....ww....',
        '....mm....',
        '....ww....',
        '.I..ww....',
        '....mm..g.',
        '....ww..gg',
        '....ww.E..',
        '..........',
      ] },
      // prettier-ignore
      { id: 'lakes.marshland', startSafe: false, rows: [
        '..........',
        '.mmm..mmm.',
        '.mmmm.mmm.',
        '..mm...m..',
        '....S.....',
        '..m...mm..',
        '.mmm.mmmm.',
        '.mmw..mmm.',
        '..m...I...',
        '.......E..',
      ] },
      // prettier-ignore
      { id: 'canyon.boulderField', startSafe: false, rows: [
        'r.r..rr..r',
        '.o...r..o.',
        'r..rr..r..',
        '..o....o..',
        '.r..S.r...',
        '...o.....o',
        '.o..rr.o..',
        'r....o..r.',
        '..o..I..o.',
        'r..r...r..',
      ] },
      // prettier-ignore
      { id: 'canyon.ledgeTerraces', startSafe: false, rows: [
        'rrrrrrrrrr',
        'vvvv..vvvv',
        '......E...',
        '...o...o..',
        'vv..vvvv..',
        '.....I....',
        '..vvvv..vv',
        '.o.....o..',
        '...S......',
        'rrrrrrrrrr',
      ] },
      // prettier-ignore
      { id: 'canyon.pass', startSafe: false, rows: [
        'oo..oo..oo',
        'oo......oo',
        '..........',
        '..........',
        'r..I..E..r',
        'r........r',
        '..........',
        '..........',
        'oo......oo',
        'oo..oo.Soo',
      ] },
    ] satisfies SetPieceDef[]
  ).map((piece) => [piece.id, piece]),
);

export const BIOMES: Readonly<Record<BiomeId, BiomeDef>> = {
  meadow: {
    id: 'meadow',
    bias: 0.1,
    maxBlocking: 0.08,
    pieces: [
      { id: 'meadow.grassRing', weight: 3 },
      { id: 'meadow.ledgeSteps', weight: 2 },
      { id: 'meadow.berryCopse', weight: 2 },
      { id: 'open', weight: 2 },
    ],
    filler: { kind: 'boulder', max: 2 },
  },
  woods: {
    id: 'woods',
    bias: 0,
    maxBlocking: 0.2,
    pieces: [
      { id: 'woods.corridor', weight: 3 },
      { id: 'woods.clearing', weight: 3 },
      { id: 'open', weight: 1 },
    ],
    filler: { kind: 'tree', max: 3 },
  },
  lakes: {
    id: 'lakes',
    bias: 0,
    maxBlocking: 0.2,
    pieces: [
      { id: 'lakes.pond', weight: 3 },
      { id: 'lakes.streamFord', weight: 3 },
      { id: 'lakes.marshland', weight: 2 },
      { id: 'open', weight: 1 },
    ],
    filler: null,
  },
  canyon: {
    id: 'canyon',
    bias: -0.01,
    maxBlocking: 0.18,
    pieces: [
      { id: 'canyon.boulderField', weight: 3 },
      { id: 'canyon.ledgeTerraces', weight: 2 },
      { id: 'canyon.pass', weight: 3 },
      { id: 'open', weight: 1 },
    ],
    filler: { kind: 'boulder', max: 3 },
  },
};

export const BIOME_IDS = Object.keys(BIOMES) as BiomeId[];

/**
 * Which biome each arena entrance prefers (README §10.1, D47 15-4). Keyed by name so an entrance kind can be listed
 * here before or after its boss lands; a kind not listed simply has no preferred biome.
 */
export const ENTRANCE_BIOME: Readonly<Partial<Record<ArenaEntranceKind | 'iceCave', BiomeId>>> = {
  mountainHole: 'canyon',
  dojo: 'meadow',
  whirlwind: 'meadow',
  iceCave: 'lakes',
  pool: 'lakes',
};

export const MAP_TUNING = {
  /** Same chunks as Mutation Sites (`SITE_TUNING.chunkSize`): chunk (0, 0) is centred on the start. */
  chunkSize: 1000,
  /** Set pieces are drawn on 10 × 10 tiles of this size; the lane check rasterises at half of it. */
  tileSize: 100,
  cellSize: 50,
  /** Door tiles on every chunk edge (README §5.4 as built): kept passable, so neighbouring chunks always connect. */
  doorTiles: [2, 3, 6, 7],
  /** One noise feature spans about this many chunks, so biomes come in regions. */
  noiseScale: 3.5,
  /** The start chunk and its 8 neighbours: meadow, start-safe pieces only, at most this much blocking (R7). */
  startMaxBlocking: 0.05,
  /** Nothing tall within this many px of the start. */
  startClear: 300,
  /** Radius ranges; set-piece obstacles sit on their tile's centre (± jitter px), fillers too. */
  tree: { radius: [45, 50], jitter: 0 },
  boulder: { radius: [35, 45], jitter: 5 },
  filler: { tree: [40, 50], boulder: [30, 45], jitter: 15 },
  /** Berry tree trunks (M4) are counted by the lane check and caps already. */
  berryTreeRadius: 30,
  /** The lane check treats a cell as blocked when its centre is this close to a tall circle's edge. */
  laneMargin: 10,
  /**
   * px past its chunk's edge an obstacle is still looked up from. Must be at least the widest mover's radius, so a
   * lookup is one list per chunk (its own obstacles plus its neighbours' near the shared edges).
   */
  reach: 75,
  /** Arena entrances (D47 15-4): the nearest matching-biome slot this far from you, else today's placement. */
  entranceSlot: { min: 300, max: 800 },
  /**
   * Stuck enemies (README §11.4): a step counts as stuck when an obstacle pushed the enemy and it moved less than
   * `progress` × its speed. This long stuck, and either this far from you or with an obstacle between you, it's recycled.
   */
  stuck: { seconds: 3, recycleBeyond: 450, progress: 0.25 },
  /**
   * Wall-follow (D47 amendment, README §11.4): stuck this long, an enemy walks along the wall, leaning in by `hug` so it
   * stays on it, until the way to you points off the wall and is clear for `look` px, or it's been off the wall for
   * `hold` s. Stuck while following (two followers meeting head-on), it turns round every `flip` s.
   */
  follow: { after: 0.3, hold: 0.6, hug: 0.3, look: 150, flip: 1 },
  /**
   * Swimming (README §7.2, D47 15-2): speed in water by line, and the swimming counter: after `flyerTiltAfter` s in
   * water, the spawner weights Flying species ×`flyerTiltWeight` until you leave. No rest regen while swimming.
   */
  swim: { speed: { lapras: 1, squirtle: 0.85 }, flyerTiltAfter: 3, flyerTiltWeight: 2 },
  /**
   * Marsh (README §7.4): `ground` movers lose `slow` of their speed in it. An Electric hit charges the patch (grounded
   * enemies in it are paralysed and take a share of the hit; per-patch cooldown); an Ice hit freezes it (no slow,
   * grounded enemies may slip).
   */
  marsh: {
    slow: 0.3,
    charge: { paralyse: 0.4, damageFraction: 0.2, cooldown: 4, shows: 1 },
    freeze: { seconds: 6, slipPerSec: 0.2, slipStun: 0.3 },
  },
  /**
   * Tall grass (README §7.1): Grass-type players rest sooner in it. Fire ignites a patch: the fire spreads
   * `spreadCellsPerSec` from where it landed, each cell burns `burnSeconds` (enemies in it Burn at `burnFraction` of
   * the igniting hit per second, flyers at `flyerBurnMult`), then lies as ash and regrows. At most `maxBurning` patches.
   */
  grass: { restDelayGrassType: 2, burnSeconds: 4, spreadCellsPerSec: 3, burnFraction: 0.3, flyerBurnMult: 0.5, ashSeconds: 60, regrowSeconds: 1, maxBurning: 2 },
  /** Ice bridges (README §7.3): an Ice hit on water freezes a strip `cells` long and `width` wide. */
  iceBridge: { cells: 8, width: 2, seconds: 6, crack: 1, pushStun: 0.5, max: 3 },
  /** Electric on deep water: a 2 s charge that only shows (no swimming enemies exist yet). */
  waterCharge: { seconds: 2 },
  /** Each patch's cooldown per reaction kind (README §8.1); the marsh charge uses its own. */
  reactionCooldown: 1,
  /**
   * Trigger caps per hit (README §8.1): a projectile reacts in each cell it enters, at most `projectile` times; a
   * zone at its centre and up to `zoneCells` cells it covers; a beam every 50 px, at most `beamSamples`; an orbit at
   * each ball every `orbitEvery` s.
   */
  trigger: { projectile: 4, zoneCells: 8, beamSamples: 8, orbitEvery: 0.5 },
  /** How many cells out to look for dry ground when something lands in water (pickups, a mover, a site). */
  shoreSearch: 12,
  /**
   * Far sites (D47 15-1, README §5.5): a Mutation Site at least `fromStart` px from the start rolls bound (Bond or
   * signature) cards ×`boundWeight` and rank-up cards ×`rankUpWeight` as often, so exploring pays.
   */
  farSites: { fromStart: 3000, boundWeight: 1.5, rankUpWeight: 1.5 },
  /**
   * Ledges (README §7.5, M4): crossing toward the drop is a hop for the player (`hopSeconds`, `hopDistance` px, input
   * locked, no invulnerability); enemies just step down. Moving against the drop within `band` px of the lip is a
   * climb at `climbFactor` speed, for everyone on the ground or swimming. Flyers and levitators ignore ledges.
   */
  ledge: { hopSeconds: 0.35, hopDistance: 60, climbFactor: 0.3, band: 20 },
  /**
   * Berry trees (README §7.8, M4): stand within `ring` px for `capture` s (progress drains `drain`/s outside) and the
   * tree shakes `shake` s and drops 1–2 Oran Berries `dropOut` px past its trunk, within the berry cap; then it's bare
   * for `regrow` s.
   */
  berryTree: { ring: 70, capture: 2, drain: 1, shake: 0.4, regrow: 90, berries: [1, 2], dropOut: 40 },
  /**
   * Item balls (README §7.9, M4): each `I` slot holds one with `chance` (≈ 1 per 2 chunks). Walking over one gives an
   * XP cluster (`xpGems` gems), an Oran Berry or a Magnet by `loot` weight. From `ambusherFrom` s of run clock, while
   * Voltorb is in season, `ambusherChance` of them are a Voltorb: it wobbles `wobble` s once you come within
   * `wakeRange` px, then wakes.
   */
  /**
   * M5 (README §10.1–§10.2): an arena entrance's spot is marked `foreshadow.seconds` before it opens, the mark
   * growing to `foreshadow.radius` px. A horde whose side has living tall grass between `horde.minDistance` px and the
   * spawn ring comes out of that grass, which rustles for the warning.
   */
  foreshadow: { seconds: 15, radius: 300 },
  horde: { minDistance: 250, arc: 0.45 },
  itemBall: { chance: 0.5, radius: 10, xpGems: 8, loot: { xp: 0.6, berry: 0.25, magnet: 0.15 }, ambusherFrom: 180, ambusherChance: 0.25, wakeRange: 160, wobble: 0.6 },
} as const;
