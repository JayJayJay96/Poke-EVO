import { describe, expect, it } from 'vitest';
import { POKEMON, TUNING } from '../data/content';
import { BIOME_IDS, BIOMES, CELL, MAP_TUNING, SET_PIECES, type BiomeId } from '../data/map';
import { MAX_ENEMY_RADIUS, dropGem } from './combat';
import { updateEnemyAttacks } from './enemyAttacks';
import { createProjectile, updateProjectiles } from './forms/projectile';
import { biomeAt, cellAt, cellsOf, chunkKey, clearSpot, entranceSlot, generateChunk, hitsObstacle, mapChunk, obstaclesAt, transformTiles } from './map';
import { createSeededRng } from './rng';
import { updateSites } from './sites';
import type { MapChunk, Obstacle, World } from './types';
import { createWorld, spawnEnemy, step, swimTilt } from './world';

// The main map (D47, docs/map/README.md): M1 obstacle core, M2 biomes and set pieces.

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };
const OPEN_ROWS = [...SET_PIECES.open!.rows];
const { chunkSize, tileSize, cellSize, startClear, laneMargin } = MAP_TUNING;

function makeWorld(mapSeed = 1): World {
  return createWorld({ rng: createSeededRng(1), spawnEnabled: false, mapSeed, obstacleDensity: 1 });
}

/** Replaces the start chunk with an empty one holding a hand-placed set (chunk 0 spans −500…500). */
function place(world: World, ...obstacles: Obstacle[]): void {
  const chunk: MapChunk = {
    cx: 0,
    cy: 0,
    biome: 'meadow',
    piece: 'open',
    transform: 0,
    tiles: SET_PIECES.open!.rows,
    own: obstacles,
    near: obstacles,
    slots: [],
    cells: cellsOf(SET_PIECES.open!.rows),
    water: false,
    patches: null,
  };
  world.map.chunks.set(chunkKey(0, 0), chunk);
}

function boulder(x: number, y: number, radius: number): Obstacle {
  return { x, y, radius, kind: 'boulder' };
}

function tree(x: number, y: number, radius: number): Obstacle {
  return { x, y, radius, kind: 'tree' };
}

function inside(o: Obstacle, x: number, y: number, radius: number): boolean {
  return Math.hypot(x - o.x, y - o.y) < o.radius + radius - 0.01;
}

/** Every chunk in a square of chunks, generated as a world would (seeded, lazily). */
function region(world: World, from: number, to: number): MapChunk[] {
  const out: MapChunk[] = [];
  for (let cy = from; cy <= to; cy++) for (let cx = from; cx <= to; cx++) out.push(mapChunk(world, cx, cy));
  return out;
}

function tileAt(chunk: MapChunk, x: number, y: number): string {
  const c = Math.floor((x - (chunk.cx - 0.5) * chunkSize) / tileSize);
  const r = Math.floor((y - (chunk.cy - 0.5) * chunkSize) / tileSize);
  return chunk.tiles[r]![c]!;
}

describe('map: generation (M2)', () => {
  it('the same seed lays out the same chunks; another seed lays out different ones', () => {
    expect(generateChunk(7, 3, -2)).toEqual(generateChunk(7, 3, -2));
    const a = [-6, -3, 3, 6].map((cx) => generateChunk(7, cx, 4));
    const b = [-6, -3, 3, 6].map((cx) => generateChunk(8, cx, 4));
    expect(a).not.toEqual(b);
  });

  it('a world with density 0 (the sim default) has no map at all', () => {
    const world = createWorld({ rng: createSeededRng(1) });
    expect(obstaclesAt(world, 3000, 3000)).toHaveLength(0);
    expect(world.map.chunks.size).toBe(0);
  });

  it('transforms: four quarter turns or two mirrors give the piece back; ledges turn with it', () => {
    const rows = SET_PIECES['canyon.ledgeTerraces']!.rows;
    let turned = [...rows];
    for (let k = 0; k < 4; k++) turned = transformTiles(turned, 1);
    expect(turned).toEqual(rows);
    expect(transformTiles(transformTiles(rows, 4), 4)).toEqual(rows);
    expect(transformTiles(['v.........', ...rows.slice(1)], 1).join('')).toContain('<'); // south → west
    expect(transformTiles(rows, 2).join('')).toContain('^'); // half a turn would face north: never used
  });

  it('every set piece is used somewhere (none of them always fails the lane check)', () => {
    const used = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (let cy = -12; cy <= 12; cy++) for (let cx = -12; cx <= 12; cx++) used.add(generateChunk(seed, cx, cy).piece);
    }
    expect([...used].sort()).toEqual(Object.keys(SET_PIECES).sort());
  });

  it('R1: a walker can reach every open spot of an 8 × 8-chunk region from any other (across chunk edges)', () => {
    for (const seed of [1, 2, 3]) {
      const world = makeWorld(seed);
      const chunks = region(world, -4, 3);
      const n = (8 * chunkSize) / cellSize;
      const origin = -4.5 * chunkSize;
      const open = new Uint8Array(n * n);
      let openCount = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = origin + (j + 0.5) * cellSize;
          const y = origin + (i + 0.5) * cellSize;
          const chunk = mapChunk(world, Math.floor(x / chunkSize + 0.5), Math.floor(y / chunkSize + 0.5));
          if (tileAt(chunk, x, y) === 'w') continue;
          if (obstaclesAt(world, x, y).some((o) => Math.hypot(x - o.x, y - o.y) < o.radius + laneMargin)) continue;
          open[i * n + j] = 1;
          openCount++;
        }
      }
      const start = open.indexOf(1);
      const seen = new Uint8Array(n * n);
      const stack = [start];
      seen[start] = 1;
      let reached = 0;
      while (stack.length > 0) {
        const cell = stack.pop()!;
        reached++;
        const i = Math.floor(cell / n);
        const j = cell % n;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const ni = i + di;
          const nj = j + dj;
          const next = ni * n + nj;
          if (ni >= 0 && nj >= 0 && ni < n && nj < n && open[next] && !seen[next]) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
      expect(chunks.length).toBe(64);
      expect(reached).toBe(openCount);
    }
  });

  it('R7: no chunk blocks more than its biome allows; the 9 start chunks are meadow and nearly open', () => {
    for (const seed of [11, 12, 13, 14]) {
      for (let cy = -8; cy <= 7; cy++) {
        for (let cx = -8; cx <= 7; cx++) {
          const chunk = generateChunk(seed, cx, cy);
          const start = Math.abs(cx) <= 1 && Math.abs(cy) <= 1;
          let area = 0;
          for (const o of chunk.own) area += Math.PI * o.radius ** 2;
          for (const s of chunk.slots) if (s.kind === 'berry') area += Math.PI * MAP_TUNING.berryTreeRadius ** 2;
          for (const row of chunk.tiles) for (const ch of row) if (ch === 'w') area += tileSize ** 2;
          const cap = start ? MAP_TUNING.startMaxBlocking : BIOMES[chunk.biome].maxBlocking;
          expect(area / chunkSize ** 2).toBeLessThanOrEqual(cap + 1e-9);
          if (start) {
            expect(chunk.biome).toBe('meadow');
            expect(SET_PIECES[chunk.piece]!.startSafe).toBe(true);
            for (const o of chunk.own) expect(Math.hypot(o.x, o.y)).toBeGreaterThanOrEqual(startClear + o.radius);
          }
        }
      }
    }
  });

  it('biomes come in regions with shares near README §5.2 (meadow ~40%, the others ~20%)', () => {
    const count: Record<BiomeId, number> = { meadow: 0, woods: 0, lakes: 0, canyon: 0 };
    let same = 0;
    let total = 0;
    for (const seed of [21, 22, 23, 24, 25]) {
      for (let cy = -30; cy < 30; cy++) {
        for (let cx = -30; cx < 30; cx++) {
          const b = biomeAt(seed, cx, cy);
          count[b]++;
          total++;
          if (biomeAt(seed, cx + 1, cy) === b) same++;
        }
      }
    }
    const share = (id: BiomeId) => count[id] / total;
    console.log('biome shares', Object.fromEntries(BIOME_IDS.map((id) => [id, share(id).toFixed(3)])), 'same-as-right', (same / total).toFixed(3));
    expect(share('meadow')).toBeGreaterThan(0.3);
    expect(share('meadow')).toBeLessThan(0.5);
    for (const id of BIOME_IDS.filter((b) => b !== 'meadow')) {
      expect(share(id)).toBeGreaterThan(0.13);
      expect(share(id)).toBeLessThan(0.28);
    }
    expect(same / total).toBeGreaterThan(0.6); // regions, not a checkerboard
  });

  it('every mover is narrower than the lookup reach, so one chunk’s list covers everything it can touch', () => {
    const playerRadius = Math.max(...Object.values(POKEMON).flatMap((line) => line.stages.map((s) => s.radius)));
    expect(MAX_ENEMY_RADIUS).toBeLessThan(MAP_TUNING.reach);
    expect(playerRadius).toBeLessThan(MAP_TUNING.reach);
  });
});

describe('map: slots (M2)', () => {
  it('Mutation Sites use their chunk’s site slot when it has one, and never sit on an obstacle or in water', () => {
    let slotted = 0;
    for (const mapSeed of [1, 2, 3, 4]) {
      const world = makeWorld(mapSeed);
      for (const [x, y] of [[0, 0], [3000, 0], [0, -3000], [-3000, 3000], [5000, 5000]] as const) {
        world.player.x = x;
        world.player.y = y;
        updateSites(world, DT);
      }
      expect(world.sites.length).toBeGreaterThan(5);
      for (const site of world.sites) {
        const chunk = mapChunk(world, Math.floor(site.x / chunkSize + 0.5), Math.floor(site.y / chunkSize + 0.5));
        const slot = chunk.slots.find((s) => s.kind === 'site');
        if (slot) {
          expect([site.x, site.y]).toEqual([slot.x, slot.y]);
          slotted++;
        }
        // A pushed-clear site ends exactly touching the obstacle, so allow for rounding.
        expect(hitsObstacle(world, site.x, site.y, site.radius - 0.01)).toBe(false);
        expect(tileAt(chunk, site.x, site.y)).not.toBe('w');
      }
    }
    expect(slotted).toBeGreaterThan(5);
  });

  it('an arena entrance prefers the nearest slot in a matching biome, 300–800 px away', () => {
    let found = 0;
    for (const mapSeed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const world = makeWorld(mapSeed);
      world.player.x = 4000;
      world.player.y = 4000;
      for (const kind of ['pool', 'mountainHole', 'dojo'] as const) {
        const slot = entranceSlot(world, kind);
        if (!slot) continue;
        found++;
        const chunk = mapChunk(world, Math.floor(slot.x / chunkSize + 0.5), Math.floor(slot.y / chunkSize + 0.5));
        expect(chunk.biome).toBe({ pool: 'lakes', mountainHole: 'canyon', dojo: 'meadow' }[kind]);
        const d = Math.hypot(slot.x - 4000, slot.y - 4000);
        expect(d).toBeGreaterThanOrEqual(MAP_TUNING.entranceSlot.min);
        expect(d).toBeLessThanOrEqual(MAP_TUNING.entranceSlot.max);
      }
    }
    console.log('entrance slot hit rate', `${found}/24`);
    expect(found).toBeGreaterThan(0);
    expect(entranceSlot(createWorld({ rng: createSeededRng(1) }), 'dojo')).toBeNull(); // no map: today's rule
  });
});

describe('map obstacles: movement (M1)', () => {
  it('the player slides round a boulder instead of stopping or passing through it', () => {
    const world = makeWorld();
    const rock = boulder(200, 0, 50);
    place(world, rock);
    world.player.x = 100;
    world.player.y = -5; // a touch off the centre line
    for (let i = 0; i < 180; i++) {
      step(world, { moveX: 1, moveY: 0 }, DT);
      expect(inside(rock, world.player.x, world.player.y, world.player.radius)).toBe(false);
    }
    expect(world.player.x).toBeGreaterThan(rock.x + rock.radius); // it got round
  });

  it('enemies are kept out of obstacles, and one spawned on top of a boulder is pushed clear', () => {
    const world = makeWorld();
    world.player.invulnLeft = 999;
    const rock = boulder(200, 0, 60);
    place(world, rock);
    const walker = spawnEnemy(world, 'rattata', 330, 3);
    const dropped = spawnEnemy(world, 'rattata', 205, 0);
    for (let i = 0; i < 120; i++) {
      step(world, IDLE, DT);
      for (const e of [walker, dropped]) expect(inside(rock, e.x, e.y, e.radius)).toBe(false);
    }
  });

  /** Spawner on (it does the recycling) but nothing spawns during the test. */
  function quietSpawner(world: World): void {
    world.spawnEnabled = true;
    world.spawnTimer = 1e9;
    world.player.invulnLeft = 999;
    world.moves = [];
  }

  /** One step with `enemy` already stuck long enough; true if it was moved onto the spawn ring. */
  function recycledWhenStuck(world: World, enemy: ReturnType<typeof spawnEnemy>): boolean {
    enemy.blockedFor = MAP_TUNING.stuck.seconds;
    step(world, IDLE, DT);
    return Math.abs(Math.hypot(enemy.x - world.player.x, enemy.y - world.player.y) - world.spawnRadius) < 10;
  }

  it('a stuck enemy far from you is recycled to the spawn ring ahead of you', () => {
    const world = makeWorld();
    quietSpawner(world);
    world.player.x = -400;
    world.player.faceX = -1; // ahead = away from the rock
    place(world, boulder(400, -80, 60)); // beside it, not between you
    const stuck = spawnEnemy(world, 'rattata', 400, 0);
    expect(recycledWhenStuck(world, stuck)).toBe(true);
    expect(stuck.x).toBeLessThan(world.player.x);
    expect(stuck.blockedFor).toBeLessThan(MAP_TUNING.stuck.seconds);
  });

  it('a stuck enemy near you with a clear line stays (you can fight it)', () => {
    const world = makeWorld();
    quietSpawner(world);
    place(world, boulder(300, -80, 60));
    const near = spawnEnemy(world, 'rattata', 300, 0);
    expect(recycledWhenStuck(world, near)).toBe(false);
  });

  it('a stuck enemy near you with a tree between you is recycled (D47 amendment)', () => {
    const world = makeWorld();
    quietSpawner(world);
    place(world, tree(200, 0, 48));
    const behind = spawnEnemy(world, 'rattata', 300, 0);
    expect(recycledWhenStuck(world, behind)).toBe(true);
  });

  it('an enemy that keeps getting somewhere along a wall never counts as stuck', () => {
    const world = makeWorld();
    quietSpawner(world);
    place(world, ...[-300, -200, -100, 0, 100, 200, 300].map((y) => tree(200, y, 48)));
    const walker = spawnEnemy(world, 'rattata', 300, 50);
    let most = 0;
    for (let i = 0; i < 3 / DT; i++) {
      step(world, IDLE, DT);
      most = Math.max(most, walker.blockedFor);
    }
    expect(most).toBeLessThan(MAP_TUNING.stuck.seconds);
  });
});

describe('map obstacles: wall-follow (D47 amendment)', () => {
  /** Lets `enemy` chase an idle, unhittable player with no moves for `seconds`; returns its closest distance. */
  function chase(world: World, enemy: ReturnType<typeof spawnEnemy>, seconds: number): number {
    world.player.invulnLeft = 999;
    world.moves = [];
    let closest = Infinity;
    for (let i = 0; i < seconds / DT; i++) {
      step(world, IDLE, DT);
      closest = Math.min(closest, Math.hypot(enemy.x - world.player.x, enemy.y - world.player.y));
    }
    return closest;
  }

  it('an enemy wedged between two trees of a wall walks round the wall to you', () => {
    const world = makeWorld();
    place(world, ...[-200, -100, 0, 100, 200].map((y) => tree(200, y, 48)));
    const wedged = spawnEnemy(world, 'rattata', 330, 50); // straight at you is the seam between two trees
    expect(chase(world, wedged, 16)).toBeLessThan(wedged.radius + world.player.radius + 5);
  });

  it('a pack wedged along a tree wall all get round it, even followers meeting head-on', () => {
    const world = makeWorld();
    place(world, ...[-250, -150, -50, 50, 150, 250].map((y) => tree(200, y, 48)));
    const pack = [-200, -100, 0, 100, 200].map((y) => spawnEnemy(world, 'rattata', 330, y + 50));
    world.player.invulnLeft = 999;
    world.moves = [];
    for (let i = 0; i < 25 / DT; i++) step(world, IDLE, DT);
    for (const e of pack) expect(Math.hypot(e.x - world.player.x, e.y - world.player.y)).toBeLessThan(60);
  });

  it('an enemy head-on behind a boulder gets round it', () => {
    const world = makeWorld();
    place(world, boulder(200, 0, 60));
    const headOn = spawnEnemy(world, 'rattata', 400, 0);
    expect(chase(world, headOn, 8)).toBeLessThan(headOn.radius + world.player.radius + 5);
  });

  it('with no wall in the way it stops following and chases straight', () => {
    const world = makeWorld();
    place(world, boulder(200, 0, 60));
    const e = spawnEnemy(world, 'rattata', 400, 0);
    chase(world, e, 8);
    expect(e.followSign).toBe(0);
  });
});

describe('map obstacles: shots (M1)', () => {
  it('a boulder stops your projectile where it reaches it', () => {
    const world = makeWorld();
    place(world, boulder(300, 0, 50));
    const shot = createProjectile();
    Object.assign(shot, { x: 100, y: 0, vx: 300, vy: 0, speed: 300, radius: 6, lifeLeft: 5, dead: false });
    world.projectiles.push(shot);
    for (let i = 0; i < 120 && !shot.dead; i++) updateProjectiles(world, DT);
    expect(shot.dead).toBe(true);
    expect(shot.x).toBeLessThan(300);
  });

  it('cover works both ways: a boulder stops an enemy dart before it reaches you', () => {
    const world = makeWorld();
    place(world, boulder(250, 0, 50));
    const owner = spawnEnemy(world, 'rattata', 480, 300);
    world.enemyShots.push({ x: 450, y: 0, vx: -300, vy: 0, radius: 4, left: 5, damage: 10, owner });
    const hp = world.player.hp;
    for (let i = 0; i < 2 / DT; i++) updateEnemyAttacks(world, DT);
    expect(world.enemyShots).toHaveLength(0);
    expect(world.player.hp).toBe(hp);
  });

  it('nothing on the map blocks anything during an arena fight (the arena sits on the same ground)', () => {
    const world = makeWorld();
    place(world, boulder(300, 0, 50));
    expect(hitsObstacle(world, 300, 0, 5)).toBe(true);
    world.arena = {} as World['arena'];
    expect(hitsObstacle(world, 300, 0, 5)).toBe(false);
  });
});

describe('map terrain: water and marsh (M3)', () => {
  /** Chunk 0 (−500…500) with hand-drawn tiles; column c spans x −500 + 100c … −400 + 100c. */
  function tiles(world: World, rows: string[]): void {
    place(world);
    const chunk = world.map.chunks.get(chunkKey(0, 0))!;
    world.map.chunks.set(chunkKey(0, 0), { ...chunk, tiles: rows, cells: cellsOf(rows), water: rows.some((r) => r.includes('w')), patches: null });
  }
  const column = (ch: string, from: number): string[] => Array.from({ length: 10 }, () => '.'.repeat(from) + ch.repeat(10 - from));
  /** Water from x = 200 to the chunk edge. */
  const lakeEast = column('w', 7);
  /** Marsh from x = −100 to the chunk edge. */
  const marshEast = column('m', 4);
  const RIGHT = { moveX: 1, moveY: 0 };

  function player(pokemonId: 'squirtle' | 'lapras' | 'charmander' = 'squirtle'): World {
    const world = createWorld({ rng: createSeededRng(1), spawnEnabled: false, mapSeed: 1, obstacleDensity: 1, pokemonId });
    world.player.invulnLeft = 999;
    world.moves = [];
    return world;
  }

  /** px the player covers in `seconds` holding right from x. */
  function run(world: World, x: number, seconds: number): number {
    world.player.x = x;
    world.player.y = 0;
    for (let i = 0; i < seconds / DT; i++) step(world, RIGHT, DT);
    return world.player.x - x;
  }

  it('cells come from the tiles: 2 × 2 cells per tile', () => {
    const cells = cellsOf(SET_PIECES['lakes.pond']!.rows);
    expect(cells[4 * 20 + 4]).toBe(CELL.water); // tile (2, 2) is `w`
    expect(cells[2 * 20 + 4]).toBe(CELL.slow); // tile (1, 2) is `m`
    expect(cells[0]).toBe(CELL.open);
  });

  it('deep water stops a walker at the shore', () => {
    const world = player('charmander');
    tiles(world, lakeEast);
    run(world, 0, 3);
    expect(world.player.x).toBeLessThanOrEqual(200 - world.player.radius + 0.01);
  });

  it('the Squirtle line swims at ×0.85, Lapras at ×1.0 (D47 15-2)', () => {
    for (const [id, factor] of [['squirtle', 0.85], ['lapras', 1]] as const) {
      const land = run(player(id), -400, 1);
      const water = player(id);
      tiles(water, lakeEast);
      const swum = run(water, 210, 1);
      expect(swum / land).toBeCloseTo(factor, 2);
      expect(water.player.swimFor).toBeGreaterThan(0.9);
    }
  });

  it('Charizard flies over water and marsh at full speed', () => {
    const land = player('charmander');
    land.player.stage = 2;
    const free = run(land, -400, 1);
    for (const rows of [lakeEast, marshEast]) {
      const world = player('charmander');
      world.player.stage = 2;
      tiles(world, rows);
      expect(run(world, -50, 1) / free).toBeCloseTo(1, 2);
    }
  });

  it('marsh slows walkers by 30%, not swimmers', () => {
    const land = run(player('charmander'), -400, 1);
    const walker = player('charmander');
    tiles(walker, marshEast);
    expect(run(walker, 0, 1) / land).toBeCloseTo(0.7, 2);
    const swimLand = run(player(), -400, 1);
    const sw = player();
    tiles(sw, marshEast);
    expect(run(sw, 0, 1) / swimLand).toBeCloseTo(1, 2);
  });

  it('enemies: walkers and a levitator stop at water, flyers cross it', () => {
    const world = player('charmander');
    world.player.x = 460; // on the far bank: water x 200…400, dry 400…500
    tiles(world, column('w', 7).map((row) => row.slice(0, 9) + '.'));
    const rattata = spawnEnemy(world, 'rattata', 0, 0);
    const pidgey = spawnEnemy(world, 'pidgey', 0, 40);
    const gastly = spawnEnemy(world, 'gastly', 0, -40);
    gastly.elite = true;
    for (let i = 0; i < 6 / DT; i++) step(world, IDLE, DT);
    expect(rattata.x).toBeLessThan(200);
    expect(gastly.x).toBeLessThan(200);
    expect(pidgey.x).toBeGreaterThan(200);
  });

  it('an enemy in marsh moves 30% slower; a flyer and a levitator do not', () => {
    const speedIn = (kind: 'rattata' | 'pidgey' | 'gastly', rows: string[]): number => {
      const world = player('charmander');
      world.player.x = -450;
      tiles(world, rows);
      const e = spawnEnemy(world, kind, 300, 0);
      e.elite = kind === 'gastly';
      step(world, IDLE, DT);
      const x = e.x;
      for (let i = 0; i < 30; i++) step(world, IDLE, DT);
      return x - e.x;
    };
    const all = column('m', 0);
    expect(speedIn('rattata', all) / speedIn('rattata', OPEN_ROWS)).toBeCloseTo(0.7, 2);
    expect(speedIn('pidgey', all) / speedIn('pidgey', OPEN_ROWS)).toBeCloseTo(1, 2);
    expect(speedIn('gastly', all) / speedIn('gastly', OPEN_ROWS)).toBeCloseTo(1, 2);
  });

  it('no rest regen while swimming', () => {
    const world = player();
    tiles(world, lakeEast);
    world.player.x = 350;
    world.player.hp = 50;
    world.player.calmFor = 999;
    for (let i = 0; i < 1 / DT; i++) step(world, IDLE, DT);
    expect(world.player.hp).toBe(50);
    world.player.x = -300;
    for (let i = 0; i < 1 / DT; i++) step(world, IDLE, DT);
    expect(world.player.hp).toBeGreaterThan(50);
  });

  it('after 3 s of swimming, Flying species weigh double until you leave', () => {
    const world = player();
    const weights = { rattata: 3, pidgey: 1, spearow: 2 };
    world.player.swimFor = MAP_TUNING.swim.flyerTiltAfter - 0.1;
    expect(swimTilt(world, weights)).toBe(weights);
    world.player.swimFor = MAP_TUNING.swim.flyerTiltAfter;
    expect(swimTilt(world, weights)).toEqual({ rattata: 3, pidgey: 2, spearow: 4 });
  });

  it('pickups dropped in water rest on the shore', () => {
    const world = makeWorld();
    tiles(world, lakeEast);
    dropGem(world, 400, 0, 1);
    const gem = world.gems.at(-1)!;
    expect(cellAt(world, gem.x, gem.y)).not.toBe(CELL.water);
    expect(Math.abs(gem.x - 400)).toBeLessThanOrEqual(MAP_TUNING.cellSize * 3); // the nearest bank, not just anywhere
  });

  it('a placed spot (site, entrance) never lands in water or marsh', () => {
    const world = makeWorld();
    tiles(world, column('w', 3).map((row) => row.slice(0, 7) + 'mmm'));
    for (const x of [100, 400]) {
      const spot = clearSpot(world, x, 0, 55);
      expect([CELL.open, CELL.grass]).toContain(cellAt(world, spot.x, spot.y));
    }
  });

  it('an enemy spawned in water is lifted to dry ground', () => {
    const world = player('charmander');
    tiles(world, lakeEast);
    const e = spawnEnemy(world, 'rattata', 350, 0);
    step(world, IDLE, DT);
    expect(cellAt(world, e.x, e.y)).not.toBe(CELL.water);
  });

  it('a walker behind a stream walks round it to you (wall-follow along the shore)', () => {
    const world = player('charmander');
    world.player.x = -300;
    // Water x −100…100, y −300…300.
    tiles(world, ['..........', '..........', '....ww....', '....ww....', '....ww....', '....ww....', '....ww....', '....ww....', '..........', '..........']);
    const e = spawnEnemy(world, 'rattata', 300, 0);
    let closest = Infinity;
    for (let i = 0; i < 25 / DT; i++) {
      step(world, IDLE, DT);
      closest = Math.min(closest, Math.hypot(e.x - world.player.x, e.y - world.player.y));
    }
    expect(closest).toBeLessThan(e.radius + world.player.radius + 5);
  });
});
