import { describe, expect, it } from 'vitest';
import { TUNING } from '../data/content';
import { ENEMY_ATTACKS, ENEMY_SHOT_CAP, WEB, type ChargeAttack, type DiveAttack, type RangedAttack } from '../data/enemyAttacks';
import { damageEnemy } from './combat';
import { createSeededRng } from './rng';
import type { World } from './types';
import { createWorld, spawnEnemy, step } from './world';

const DT = TUNING.stepSeconds;
const IDLE = { moveX: 0, moveY: 0 };
const ranged = ENEMY_ATTACKS.spearow as RangedAttack;
const charge = ENEMY_ATTACKS.tauros as ChargeAttack;
const dive = ENEMY_ATTACKS.fearow as DiveAttack;

function makeWorld(): World {
  const world = createWorld({ rng: createSeededRng(1) });
  world.moves = [];
  return world;
}
const run = (world: World, seconds: number, input = IDLE) => {
  for (let t = 0; t < seconds; t += DT) step(world, input, DT);
};
const dist = (world: World, e: { x: number; y: number }) => Math.hypot(e.x - world.player.x, e.y - world.player.y);

describe('ranged enemies (D35, Spearow)', () => {
  it('keep their distance: back off when close, hold in the band, close in from far', () => {
    for (const [start, expectation] of [[100, 'away'], [250, 'hold'], [600, 'closer']] as const) {
      const world = makeWorld();
      const e = spawnEnemy(world, 'spearow', world.player.x + start, world.player.y);
      e.atkCooldown = 99;
      run(world, 0.25);
      const d = dist(world, e);
      if (expectation === 'away') expect(d).toBeGreaterThan(start);
      if (expectation === 'hold') expect(d).toBeCloseTo(start, 0);
      if (expectation === 'closer') expect(d).toBeLessThan(start);
    }
  });

  it('lock the line, then fire a dart along it that hits for ×0.8 contact', () => {
    const world = makeWorld();
    const e = spawnEnemy(world, 'spearow', world.player.x + 250, world.player.y);
    e.atkCooldown = 0;
    step(world, IDLE, DT);
    expect(e.atkPhase).toBe('windup');
    const aim = { x: e.aimX, y: e.aimY };
    expect(aim.x).toBeCloseTo(-1);
    // You step aside during the telegraph: the line doesn't follow you.
    world.player.y += 40;
    step(world, IDLE, DT);
    expect(e.aimX).toBe(aim.x);
    expect(e.aimY).toBe(aim.y);
    world.player.y -= 40; // back on the line
    world.player.invulnLeft = 0;
    const hp = world.player.hp;
    run(world, ranged.telegraph + 1.2);
    expect(hp - world.player.hp).toBeCloseTo(e.contactDamage * ranged.damageFactor * world.mods.damageTakenMult, 0);
    expect(e.atkCooldown).toBeGreaterThan(0);
  });

  it('a stun drops the telegraph; darts respect their cap', () => {
    const world = makeWorld();
    const e = spawnEnemy(world, 'spearow', world.player.x + 250, world.player.y);
    e.atkCooldown = 0;
    step(world, IDLE, DT);
    e.stunLeft = 1;
    step(world, IDLE, DT);
    expect(e.atkPhase).toBeNull();

    for (let i = 0; i < ENEMY_SHOT_CAP; i++) {
      world.enemyShots.push({ x: 1e5, y: 1e5, vx: 0, vy: 0, radius: 1, left: 99, damage: 0, owner: e });
    }
    e.stunLeft = 0;
    e.atkCooldown = 0;
    run(world, ranged.telegraph + 0.1);
    expect(world.enemyShots.length).toBe(ENEMY_SHOT_CAP);
  });
});

describe('chargers (D35, Tauros)', () => {
  it('paw (still) behind a locked line, then dash along it at ×1.5 contact, then recover', () => {
    const world = makeWorld();
    const e = spawnEnemy(world, 'tauros', world.player.x + 300, world.player.y);
    e.atkCooldown = 0;
    world.player.invulnLeft = 99;
    step(world, IDLE, DT);
    expect(e.atkPhase).toBe('windup');
    const x0 = e.x;
    run(world, charge.telegraph - 2 * DT);
    expect(e.x).toBeCloseTo(x0, 0); // pawing in place
    run(world, 3 * DT);
    expect(e.atkPhase).toBe('dash');
    const start = e.x;
    for (let t = 0; t < 3 && e.atkPhase === 'dash'; t += DT) step(world, IDLE, DT);
    expect(start - e.x).toBeGreaterThan(charge.dashDistance * 0.9);
    expect(e.atkPhase).toBe('recover');

    // Contact during the dash hits harder.
    const w2 = makeWorld();
    const t2 = spawnEnemy(w2, 'tauros', w2.player.x + 5, w2.player.y);
    t2.atkPhase = 'dash';
    t2.aimX = -1;
    t2.dashLeft = 100;
    w2.player.invulnLeft = 0;
    const hp = w2.player.hp;
    step(w2, IDLE, DT);
    expect(hp - w2.player.hp).toBeCloseTo(t2.contactDamage * charge.damageFactor * w2.mods.damageTakenMult, 0);
  });
});

describe('divers (D35, Fearow)', () => {
  it('mark a ring on you, land on it, and hit only if you are still inside', () => {
    for (const stay of [true, false]) {
      const world = makeWorld();
      const e = spawnEnemy(world, 'fearow', world.player.x + 300, world.player.y);
      e.atkCooldown = 0;
      step(world, IDLE, DT);
      expect(e.atkPhase).toBe('windup');
      const mark = { x: e.markX, y: e.markY };
      expect(mark.x).toBeCloseTo(world.player.x);
      if (!stay) world.player.y += dive.radius + 40;
      world.player.invulnLeft = 0;
      const hp = world.player.hp;
      run(world, dive.telegraph);
      expect(e.x).toBeCloseTo(mark.x, 0);
      if (stay) expect(world.player.hp).toBeLessThan(hp);
      else expect(world.player.hp).toBe(hp);
    }
  });
});

describe('batch-2 attack styles (D37, ROSTER)', () => {
  const atk = <K extends keyof typeof ENEMY_ATTACKS>(k: K) => ENEMY_ATTACKS[k]!;
  function near(kind: Parameters<typeof spawnEnemy>[1], dx: number, pokemonId: 'charmander' | 'bulbasaur' | 'squirtle' = 'charmander') {
    const world = createWorld({ rng: createSeededRng(1), pokemonId });
    world.moves = [];
    const e = spawnEnemy(world, kind, world.player.x + dx, world.player.y);
    e.atkCooldown = 0;
    return { world, e };
  }

  it('Caterpie: String Shot leaves a web on your spot that slows you while you stand in it', () => {
    const { world, e } = near('caterpie', 200);
    step(world, IDLE, DT);
    expect(e.atkPhase).toBe('windup');
    run(world, atk('caterpie').telegraph);
    expect(world.webs).toHaveLength(1);
    const x = world.player.x;
    step(world, { moveX: 1, moveY: 0 }, DT);
    expect(world.player.x - x).toBeCloseTo(world.player.speed * (1 - WEB.slow) * DT, 1);
  });

  it('Weedle: its contact hit poisons you, but not through a Shell block', () => {
    for (const shell of [false, true]) {
      const { world } = near('weedle', 5, shell ? 'squirtle' : 'charmander');
      world.player.blockReadyLeft = shell ? 0 : 99;
      step(world, IDLE, DT);
      if (shell) expect(world.playerStatus.poisonLeft).toBe(0);
      else expect(world.playerStatus.poisonLeft).toBeGreaterThan(0);
    }
  });

  it('Zubat: Supersonic confuses you inside its locked cone, not behind it', () => {
    for (const behind of [false, true]) {
      const { world, e } = near('zubat', 100);
      step(world, IDLE, DT);
      expect(e.atkPhase).toBe('windup');
      e.stunLeft = 0;
      if (behind) world.player.x = e.x + 100;
      world.player.invulnLeft = 99;
      run(world, atk('zubat').telegraph);
      expect(world.playerStatus.confuseLeft > 0).toBe(!behind);
    }
  });

  it('Oddish: Poison Powder poisons you nearby; a Grass starter shrugs the powder off', () => {
    const dps: number[] = [];
    for (const id of ['charmander', 'bulbasaur'] as const) {
      const { world } = near('oddish', 70, id);
      world.player.invulnLeft = 99;
      run(world, atk('oddish').telegraph + DT);
      expect(world.playerStatus.poisonLeft).toBeGreaterThan(0);
      dps.push(world.playerStatus.poisonDps);
    }
    expect(dps[1]).toBeLessThan(dps[0]!); // Bulbasaur: Poison type ×0.25 and powder ×0.25
  });

  it('Psyduck: Water Gun darts Soak you', () => {
    const { world } = near('psyduck', 250);
    run(world, atk('psyduck').telegraph + 1.2);
    expect(world.playerStatus.soakLeft).toBeGreaterThan(0);
  });

  it('Geodude: Rollout is a long, fast roll along the locked line', () => {
    const { world, e } = near('geodude', 250);
    world.player.invulnLeft = 99;
    run(world, atk('geodude').telegraph + DT);
    expect(e.atkPhase).toBe('dash');
    const start = e.x;
    for (let t = 0; t < 3 && e.atkPhase === 'dash'; t += DT) step(world, IDLE, DT);
    expect(start - e.x).toBeGreaterThan((atk('geodude') as ChargeAttack).dashDistance * 0.9);
  });

  it('Gastly: drifts through other enemies, and its Lick paralyses', () => {
    const { world, e } = near('gastly', 300);
    e.atkCooldown = 99;
    const other = spawnEnemy(world, 'rattata', e.x, e.y);
    other.speed = 0;
    step(world, IDLE, DT);
    expect(other.x).toBeCloseTo(e.x + 0, -2); // Gastly isn't pushed off (it moved toward you only)
    const w2 = near('gastly', 5).world;
    step(w2, IDLE, DT);
    expect(w2.playerStatus.paraLeft).toBeGreaterThan(0);
  });

  it('Abra: blinks to a ring ahead of where you walk, then a Confusion pulse', () => {
    const { world, e } = near('abra', 300);
    step(world, { moveX: 0, moveY: 1 }, DT);
    expect(e.atkPhase).toBe('windup');
    expect(e.markY).toBeGreaterThan(world.player.y + 100); // ahead of you
    world.player.y = e.markY;
    world.player.invulnLeft = 0;
    const hp = world.player.hp;
    run(world, atk('abra').telegraph);
    expect(e.x).toBeCloseTo(e.markX);
    expect(world.player.hp).toBeLessThan(hp);
    expect(world.playerStatus.confuseLeft).toBeGreaterThan(0);
  });

  it('Voltorb: fuses (no stun), then Self-Destructs and pays no XP; killed while fusing, it is defused', () => {
    const { world, e } = near('voltorb', 50);
    step(world, IDLE, DT);
    expect(e.atkPhase).toBe('windup');
    e.stunLeft = 1; // can't stop the fuse
    world.player.invulnLeft = 0;
    const hp = world.player.hp;
    run(world, atk('voltorb').telegraph + DT);
    expect(world.player.hp).toBeLessThan(hp);
    expect(world.enemies.includes(e)).toBe(false);
    expect(world.gems).toHaveLength(0);
    expect(world.kills).toBe(0); // a self-KO pays nothing

    const w2 = near('voltorb', 50).world;
    step(w2, IDLE, DT);
    const v2 = w2.enemies.find((x) => x.kind === 'voltorb')!;
    w2.player.invulnLeft = 0;
    const hp2 = w2.player.hp;
    damageEnemy(w2, v2, 1e9);
    run(w2, atk('voltorb').telegraph + DT);
    expect(w2.player.hp).toBe(hp2); // defused
    expect(w2.kills).toBe(1); // a real KO (its gem is paid; you may have picked it up already)
  });

  it('Chansey: keeps its distance and heals nearby enemies, not itself', () => {
    const { world, e } = near('chansey', 250);
    const ally = spawnEnemy(world, 'rattata', e.x + 50, e.y);
    ally.hp = ally.maxHp * 0.5;
    e.hp = e.maxHp * 0.5;
    ally.speed = 0;
    run(world, atk('chansey').telegraph + DT);
    expect(ally.hp).toBeCloseTo(ally.maxHp * (0.5 + (atk('chansey') as { healPct: number }).healPct), 0);
    expect(e.hp).toBeCloseTo(e.maxHp * 0.5);
  });
});
