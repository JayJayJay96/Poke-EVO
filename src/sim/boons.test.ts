import { describe, expect, it } from 'vitest';
import { BOON_TUNING as B, BOONS } from '../data/boons';
import { TUNING } from '../data/content';
import { chooseBoon } from './arena';
import { boonDamageMult, boonMoveSpeedMult, boonOffer, chargeBeamMult, learnBoon, onBoonCast, onBoonKill, updateBoons } from './boons';
import { restoreBuild, snapshotBuild } from './buildSnapshot';
import { NO_HIT, applyBurn, applySlow, damageEnemy, maybeDropBerry } from './combat';
import { createSeededRng } from './rng';
import { refreshStats } from './stats';
import type { InputState, World } from './types';
import { createWorld, hitPlayer, spawnEnemy, step } from './world';

// Legendary Boons (D49): the boss reward that replaced the combine step.
const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

function makeWorld(seed = 1): World {
  return createWorld({ rng: createSeededRng(seed), spawnRadius: 600, spawnEnabled: false, pokemonId: 'charmander' });
}

/** Spawns still enemies at offsets from the player, with no moves left to hit them, and steps once for the hash. */
function around(world: World, offsets: readonly [number, number][]) {
  const { x, y } = world.player;
  const enemies = offsets.map(([dx, dy]) => spawnEnemy(world, 'raticate', x + dx, y + dy));
  for (const e of enemies) e.speed = 0;
  const signature = world.moves[0]!;
  world.moves = [];
  step(world, IDLE, DT);
  world.moves = [signature]; // boons scale off the signature's damage
  return enemies;
}

const hurt = (e: { hp: number; maxHp: number }) => e.hp < e.maxHp;

describe('boon pick', () => {
  it("offers the boss's 3 boons with its horde-clearer first, minus owned ones; picking leads to the reward pick", () => {
    const world = makeWorld();
    const offer = boonOffer(world, 'zapdos');
    if (offer?.kind !== 'boon') throw new Error('expected a boon offer');
    expect(offer.cards).toHaveLength(3);
    expect(BOONS[offer.cards[0]!].clears).toBe(true);
    learnBoon(world, 'tailwind');
    const again = boonOffer(world, 'zapdos');
    expect(again?.kind === 'boon' && again.cards).not.toContain('tailwind');

    world.offer = offer;
    chooseBoon(world, 0);
    expect(world.boons).toContain('thunderCall');
    expect(world.offer?.kind).toBe('arenaReward');
  });
});

describe('horde-clearers', () => {
  it('Body Slam Quake hits everything within 180 px every 8 s, and its kills trigger nothing', () => {
    const world = makeWorld();
    learnBoon(world, 'bodySlamQuake');
    world.techniques.push({ id: 'kindling', rank: 3 });
    const [inside, outside, burning, neighbour] = around(world, [[100, 0], [300, 0], [-60, 0], [-250, 0]]);
    burning!.hp = 1;
    applyBurn(burning!, 5);
    world.boon.quakeLeft = 0.001;
    updateBoons(world, DT);
    expect(hurt(inside!)).toBe(true);
    expect(hurt(outside!)).toBe(false);
    expect(burning!.hp).toBeLessThanOrEqual(0);
    expect(neighbour!.burnLeft).toBe(0); // the quake's kill spread no burn (D29)
  });

  it('Thunder Call strikes the densest cluster', () => {
    const world = makeWorld();
    learnBoon(world, 'thunderCall');
    const cluster = around(world, [[400, 0], [410, 10], [395, -12], [420, 5], [405, 20]]);
    world.boon.thunderLeft = 0.001;
    updateBoons(world, DT);
    expect(cluster.every(hurt)).toBe(true);
  });

  it('Blizzard Aura slows and damages enemies in its ring', () => {
    const world = makeWorld();
    const [inside, outside] = around(world, [[120, 0], [260, 0]]);
    learnBoon(world, 'blizzardAura');
    updateBoons(world, DT);
    expect(inside!.slowLeft).toBeGreaterThan(0);
    expect(hurt(inside!)).toBe(true);
    expect(hurt(outside!)).toBe(false);
  });

  it("Dynamic Punch: every 5th cast of a move slams the nearest enemy's area", () => {
    const world = makeWorld();
    learnBoon(world, 'dynamicPunch');
    const [target] = around(world, [[150, 0]]);
    const slot = world.moves[0]!;
    for (let i = 0; i < 4; i++) onBoonCast(world, slot, false);
    expect(hurt(target!)).toBe(false);
    onBoonCast(world, slot, false);
    expect(hurt(target!)).toBe(true);
  });
});

describe('other boons', () => {
  it('Bulk Up: 25 KOs give 6 s of +60% damage', () => {
    const world = makeWorld();
    learnBoon(world, 'bulkUp');
    for (let i = 0; i < 24; i++) onBoonKill(world);
    expect(boonDamageMult(world)).toBe(1);
    onBoonKill(world);
    expect(boonDamageMult(world)).toBeCloseTo(1 + B.bulkUp.damagePct);
    updateBoons(world, B.bulkUp.seconds + 0.01);
    expect(boonDamageMult(world)).toBe(1);
  });

  it('Guts: below 40% HP, more damage and speed', () => {
    const world = makeWorld();
    learnBoon(world, 'guts');
    expect(boonDamageMult(world)).toBe(1);
    world.player.hp = world.player.maxHp * 0.3;
    expect(boonDamageMult(world)).toBeCloseTo(1 + B.guts.damagePct);
    expect(boonMoveSpeedMult(world)).toBeCloseTo(1 + B.guts.speedPct);
  });

  it('Charge Beam: the cast after 20 is ×3, then it recharges', () => {
    const world = makeWorld();
    learnBoon(world, 'chargeBeam');
    const slot = world.moves[0]!;
    for (let i = 0; i < 20; i++) onBoonCast(world, slot, chargeBeamMult(world) > 1);
    expect(chargeBeamMult(world)).toBe(B.chargeBeam.mult);
    onBoonCast(world, slot, true);
    expect(chargeBeamMult(world)).toBe(1);
  });

  it('Mist ignores one hit, then the next one lands', () => {
    const world = makeWorld();
    learnBoon(world, 'mist');
    const enemy = spawnEnemy(world, 'raticate', 900, 0);
    expect(hitPlayer(world, 30, enemy)).toBe(false);
    expect(world.player.hp).toBe(world.player.maxHp);
    world.player.invulnLeft = 0;
    expect(hitPlayer(world, 30, enemy)).toBe(true);
    expect(world.player.hp).toBeLessThan(world.player.maxHp);
  });

  it("Sheer Cold finishes a slowed, low enemy with a move's own hit, but not a boss", () => {
    const world = makeWorld();
    learnBoon(world, 'sheerCold');
    const slot = world.moves[0]!;
    const low = spawnEnemy(world, 'raticate', 900, 0);
    low.hp = low.maxHp * 0.12;
    applySlow(low, 0.3, 2);
    damageEnemy(world, low, 1, { ...NO_HIT, slot });
    expect(low.hp).toBeLessThanOrEqual(0);
    const boss = spawnEnemy(world, 'snorlax', 1200, 0);
    boss.hp = boss.maxHp * 0.1;
    applySlow(boss, 0.3, 2);
    damageEnemy(world, boss, 1, { ...NO_HIT, slot });
    expect(boss.hp).toBeGreaterThan(0);
  });

  it('Thick Fat, Tailwind and Gluttony', () => {
    const world = makeWorld();
    const baseHp = world.player.maxHp;
    const baseSpeed = world.player.speed;
    learnBoon(world, 'thickFat');
    learnBoon(world, 'tailwind');
    refreshStats(world);
    expect(world.player.maxHp).toBeCloseTo(baseHp * (1 + B.thickFat.maxHpPct));
    expect(world.player.speed).toBeCloseTo(baseSpeed * (1 + B.tailwind.moveSpeedPct));
    learnBoon(world, 'gluttony');
    const before = world.berries.length;
    for (let i = 0; i < 5; i++) maybeDropBerry(world, 2000 + i * 10, 0, 0.5); // ×2 = always
    expect(world.berries.length).toBe(before + 5);
  });

  it('the build snapshot keeps boons', () => {
    const world = makeWorld();
    learnBoon(world, 'thunderCall');
    learnBoon(world, 'guts');
    const json = JSON.stringify(snapshotBuild(world));
    const next = makeWorld(5);
    restoreBuild(next, JSON.parse(json));
    expect(next.boons).toEqual(['thunderCall', 'guts']);
  });
});
