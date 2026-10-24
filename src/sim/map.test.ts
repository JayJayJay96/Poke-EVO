import { describe, expect, it } from 'vitest';
import { POKEMON, TUNING } from '../data/content';
import { MAP_TUNING } from '../data/map';
import { MAX_ENEMY_RADIUS } from './combat';
import { updateEnemyAttacks } from './enemyAttacks';
import { createProjectile, updateProjectiles } from './forms/projectile';
import { chunkKey, chunkOf, generateObstacles, hitsObstacle, obstaclesAt } from './map';
import { createSeededRng } from './rng';
import { updateSites } from './sites';
import type { Obstacle, World } from './types';
import { createWorld, spawnEnemy, step } from './world';

// Map obstacles (D47, docs/map/README.md, build step M1).

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };

function makeWorld(mapSeed = 1): World {
  return createWorld({ rng: createSeededRng(1), spawnEnabled: false, mapSeed, obstacleDensity: 1 });
}

/** Replaces the start chunk's obstacles with a hand-placed set (chunk 0 spans −500…500). */
function place(world: World, ...obstacles: Obstacle[]): void {
  world.map.chunks.set(chunkKey(0, 0), obstacles);
}

function boulder(x: number, y: number, radius: number): Obstacle {
  return { x, y, radius, kind: 'boulder' };
}

function inside(o: Obstacle, x: number, y: number, radius: number): boolean {
  return Math.hypot(x - o.x, y - o.y) < o.radius + radius - 0.01;
}

describe('map obstacles: generation (M1)', () => {
  it('the same seed lays out the same obstacles; another seed lays out different ones', () => {
    expect(generateObstacles(7, 3, -2, 1)).toEqual(generateObstacles(7, 3, -2, 1));
    const a = [-2, -1, 0, 1, 2].map((cx) => generateObstacles(7, cx, 4, 1));
    const b = [-2, -1, 0, 1, 2].map((cx) => generateObstacles(8, cx, 4, 1));
    expect(a).not.toEqual(b);
  });

  it('a world with density 0 (the sim default) has no obstacles at all', () => {
    const world = createWorld({ rng: createSeededRng(1) });
    expect(world.map.density).toBe(0);
    expect(obstaclesAt(world, 3000, 3000)).toHaveLength(0);
  });

  it('R1: every gap between obstacles is ≥ 150 px, across chunk borders too, at normal and stress density', () => {
    const { gap, chunkSize, startClear } = MAP_TUNING;
    for (const density of [1, MAP_TUNING.stressDensity]) {
      for (const seed of [1, 2, 3]) {
        const all: Obstacle[] = [];
        for (let cy = -3; cy <= 3; cy++) {
          for (let cx = -3; cx <= 3; cx++) {
            for (const o of generateObstacles(seed, cx, cy, density)) {
              // Inside its own chunk, with half a gap to every edge.
              expect(chunkOf(o.x)).toBe(cx);
              expect(chunkOf(o.y)).toBe(cy);
              const left = (cx - 0.5) * chunkSize;
              const top = (cy - 0.5) * chunkSize;
              expect(o.x - o.radius - left).toBeGreaterThanOrEqual(gap / 2 - 1e-6);
              expect(left + chunkSize - o.x - o.radius).toBeGreaterThanOrEqual(gap / 2 - 1e-6);
              expect(o.y - o.radius - top).toBeGreaterThanOrEqual(gap / 2 - 1e-6);
              expect(top + chunkSize - o.y - o.radius).toBeGreaterThanOrEqual(gap / 2 - 1e-6);
              expect(Math.hypot(o.x, o.y)).toBeGreaterThanOrEqual(startClear);
              all.push(o);
            }
          }
        }
        expect(all.length).toBeGreaterThan(100);
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            const a = all[i]!;
            const b = all[j]!;
            expect(Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius).toBeGreaterThanOrEqual(gap - 1e-6);
          }
        }
      }
    }
  });

  it('every mover is narrower than half a gap, so it only ever touches its own chunk’s obstacles', () => {
    const playerRadius = Math.max(...Object.values(POKEMON).flatMap((line) => line.stages.map((s) => s.radius)));
    expect(MAX_ENEMY_RADIUS).toBeLessThan(MAP_TUNING.gap / 2);
    expect(playerRadius).toBeLessThan(MAP_TUNING.gap / 2);
  });

  it('the start is open ground: few obstacles in the 9 chunks around it', () => {
    const near = [-1, 0, 1].flatMap((cy) => [-1, 0, 1].flatMap((cx) => generateObstacles(5, cx, cy, 1)));
    expect(near.length).toBeLessThanOrEqual(9 * MAP_TUNING.startPerChunk);
  });

  it('Mutation Sites never sit on an obstacle', () => {
    for (const mapSeed of [1, 2, 3, 4]) {
      const world = makeWorld(mapSeed);
      for (const [x, y] of [[0, 0], [3000, 0], [0, -3000], [-3000, 3000], [5000, 5000]] as const) {
        world.player.x = x;
        world.player.y = y;
        updateSites(world, DT);
      }
      expect(world.sites.length).toBeGreaterThan(5);
      // A pushed-clear site ends exactly touching the obstacle, so allow for rounding.
      for (const site of world.sites) expect(hitsObstacle(world, site.x, site.y, site.radius - 0.01)).toBe(false);
    }
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

  it('an enemy stuck behind a boulder far from you is recycled to the spawn ring ahead of you', () => {
    const world = makeWorld();
    quietSpawner(world);
    world.player.x = -400;
    world.player.faceX = -1; // ahead = away from the rock
    place(world, boulder(200, 0, 60));
    const stuck = spawnEnemy(world, 'rattata', 400, 0); // head-on: it can't slide off
    let recycled = false;
    for (let i = 0; i < 6 / DT && !recycled; i++) {
      step(world, IDLE, DT);
      recycled = stuck.x < world.player.x;
    }
    expect(recycled).toBe(true);
    expect(Math.hypot(stuck.x - world.player.x, stuck.y - world.player.y)).toBeCloseTo(world.spawnRadius, -1);
    expect(stuck.blockedFor).toBeLessThan(MAP_TUNING.stuck.seconds);
  });

  it('a stuck enemy near you stays where it is (you can fight it across the rock)', () => {
    const world = makeWorld();
    quietSpawner(world);
    place(world, boulder(200, 0, 60));
    const near = spawnEnemy(world, 'rattata', 330, 0);
    for (let i = 0; i < 6 / DT; i++) {
      step(world, IDLE, DT);
      expect(Math.hypot(near.x - world.player.x, near.y - world.player.y)).toBeLessThan(MAP_TUNING.stuck.recycleBeyond);
    }
    expect(near.blockedFor).toBeGreaterThan(MAP_TUNING.stuck.seconds);
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
