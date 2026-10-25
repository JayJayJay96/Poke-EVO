import type { ArenaEntranceKind } from './arena';

// Main-map terrain (D47, docs/map/README.md). M2: biomes and hand-made set pieces per chunk. Only trees and boulders
// have rules so far; water, marsh and tall grass get theirs in M3, ledges, berry trees and item balls in M4 (their
// tiles are already laid out, so the lane check and coverage caps count them now). Every number is provisional.

export type ObstacleKind = 'boulder' | 'tree';
export type BiomeId = 'meadow' | 'woods' | 'lakes' | 'canyon';
export type SlotKind = 'site' | 'entrance' | 'berry' | 'item';

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
  readonly filler: { readonly kind: ObstacleKind; readonly max: number } | null;
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
      { id: 'woods.clearing', startSafe: false, rows: [
        'TT..TT..TT',
        'T........T',
        '..gg..gg..',
        '.g......g.',
        'T..B..S..T',
        'T........T',
        '.g......g.',
        '..gg.Igg..',
        'T........T',
        'TT..TT..TT',
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
  /** Stuck enemies (README §11.4): this long pressed against obstacles and this far from you, they're recycled. */
  stuck: { seconds: 3, recycleBeyond: 450 },
} as const;
