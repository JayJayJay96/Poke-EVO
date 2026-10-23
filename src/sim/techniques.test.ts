import { describe, expect, it } from 'vitest';
import { TUNING, type PokemonId } from '../data/content';
import type { TechniqueId } from '../data/techniques';
import { restoreBuild, snapshotBuild } from './buildSnapshot';
import { NO_HIT, applyBurn, applySlow, applyStatuses, damageEnemy } from './combat';
import { chooseCard, makeOffer } from './progression';
import { createSeededRng } from './rng';
import { computeModifiers, createSlot, refreshStats } from './stats';
import { cooldownRate, learnTechnique, onGemCollected, techniqueCards, updateTechniques } from './techniques';
import type { InputState, World } from './types';
import { createWorld, drainPlayer, hitPlayer, spawnEnemy, step } from './world';

// D40: Techniques (ranked passives on normal levels) and Natures.
const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };
const RIGHT: InputState = { moveX: 1, moveY: 0 };

function makeWorld(pokemonId: PokemonId = 'charmander', seed = 1): World {
  return createWorld({ rng: createSeededRng(seed), spawnRadius: 600, spawnEnabled: false, pokemonId });
}

function own(world: World, id: TechniqueId, rank = 1): void {
  world.techniques.push({ id, rank });
}

/** Spawns far from the player and steps once so the spatial hash sees the enemies. */
function cluster(world: World, xs: readonly number[]) {
  const enemies = xs.map((x) => spawnEnemy(world, 'raticate', 1000 + x, 0));
  step(world, IDLE, DT);
  return enemies;
}

const ids = (world: World) => techniqueCards(world).map((c) => (c.kind === 'technique' ? c.techniqueId : null));

describe('Technique cards', () => {
  it('tag-linked Techniques need a move with the tag', () => {
    expect(ids(makeWorld('charmander'))).toContain('kindling');
    expect(ids(makeWorld('charmander'))).not.toContain('riptide');
    expect(ids(makeWorld('squirtle'))).toContain('riptide');
    expect(ids(makeWorld('squirtle'))).not.toContain('kindling');
    const world = makeWorld('charmander');
    expect(ids(world)).not.toContain('brawler');
    world.moves.push(createSlot('scratch'));
    expect(ids(world)).toContain('brawler');
  });

  it('5 slots: once full, only rank-ups below III are offered', () => {
    const world = makeWorld();
    for (const id of ['rollout', 'moxie', 'endure', 'rage', 'pickup'] as const) own(world, id);
    world.techniques[0]!.rank = 3;
    const cards = techniqueCards(world);
    expect(cards).toHaveLength(4);
    expect(cards.every((c) => c.kind === 'technique' && c.rank === 2)).toBe(true);
  });

  it('learning again ranks up, capped at III; chooseCard applies a Technique card', () => {
    const world = makeWorld();
    for (let i = 0; i < 4; i++) learnTechnique(world, 'moxie');
    expect(world.techniques).toEqual([{ id: 'moxie', rank: 3 }]);
    world.pendingLevelUps = 1;
    world.offer = { kind: 'cards', cards: [{ kind: 'technique', techniqueId: 'endure', rank: 1 }] };
    chooseCard(world, 0);
    expect(world.techniques.map((t) => t.id)).toEqual(['moxie', 'endure']);
  });

  it('every normal-level offer holds at least one Technique while one is available', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const offer = makeOffer(makeWorld('charmander', seed));
      if (offer.kind !== 'cards') throw new Error('expected a normal card offer');
      expect(offer.cards).toHaveLength(3);
      expect(offer.cards.some((c) => c.kind === 'technique')).toBe(true);
    }
  });
});

describe('playstyle Techniques', () => {
  /** Damage of the first Ember hit after 2.2 s of walking right. */
  function firstHit(rollout: boolean): { damage: number; world: World } {
    const world = makeWorld();
    if (rollout) learnTechnique(world, 'rollout');
    for (let t = 0; t < 2.2; t += DT) step(world, RIGHT, DT);
    const enemy = spawnEnemy(world, 'raticate', world.player.x + 120, world.player.y);
    for (let i = 0; i < 300 && enemy.hp === enemy.maxHp; i++) step(world, RIGHT, DT);
    return { damage: enemy.maxHp - enemy.hp, world };
  }

  it('Rollout: the first cast after 2 s of moving deals +40%, then the timer resets', () => {
    const plain = firstHit(false);
    const rolled = firstHit(true);
    expect(plain.damage).toBeGreaterThan(0);
    expect(rolled.damage / plain.damage).toBeCloseTo(1.4, 5);
    expect(rolled.world.tech.rollout).toBeLessThan(0.5);
  });

  it('Moxie: kills stack +1% damage to the cap; a landed hit resets it', () => {
    const world = makeWorld();
    own(world, 'moxie');
    for (let i = 0; i < 15; i++) damageEnemy(world, spawnEnemy(world, 'rattata', 900, 0), 1e6);
    expect(world.tech.moxie).toBeCloseTo(0.1);
    const target = spawnEnemy(world, 'raticate', 900, 0);
    expect(damageEnemy(world, target, 10)).toBeCloseTo(11);
    hitPlayer(world, 1, target);
    expect(world.tech.moxie).toBe(0);
  });

  it('Endure: a lethal hit leaves 1 HP once per cooldown; non-lethal hits and poison are covered', () => {
    const world = makeWorld();
    own(world, 'endure');
    const enemy = spawnEnemy(world, 'raticate', 900, 0);
    hitPlayer(world, 1, enemy);
    expect(world.tech.endureLeft).toBe(0); // not lethal: not used
    hitPlayer(world, 1e4, enemy);
    expect(world.status).toBe('running');
    expect(world.player.hp).toBe(1);
    expect(world.player.invulnLeft).toBe(1);
    expect(world.tech.endureLeft).toBe(90);
    drainPlayer(world, 1e4);
    expect(world.status).toBe('fainted'); // still on cooldown

    const poisoned = makeWorld();
    own(poisoned, 'endure');
    drainPlayer(poisoned, 1e4);
    expect(poisoned.status).toBe('running');
    expect(poisoned.player.hp).toBe(1);
  });

  it('Rage: a landed hit speeds cooldowns up for 3 s', () => {
    const world = makeWorld();
    own(world, 'rage');
    expect(cooldownRate(world)).toBe(1);
    hitPlayer(world, 1, spawnEnemy(world, 'raticate', 900, 0));
    expect(cooldownRate(world)).toBeCloseTo(1 / 0.8);
    updateTechniques(world, 3.01);
    expect(cooldownRate(world)).toBe(1);
  });

  it('Pickup: some gems heal; without it the RNG is untouched', () => {
    const world = makeWorld();
    own(world, 'pickup', 3);
    let heals = 0;
    for (let i = 0; i < 200; i++) {
      world.player.hp = 10;
      onGemCollected(world);
      if (world.player.hp > 10) heals++;
    }
    expect(heals).toBeGreaterThan(0);
    expect(heals).toBeLessThan(30); // 4% of 200 ≈ 8

    const a = makeWorld('charmander', 7);
    const b = makeWorld('charmander', 7);
    for (let i = 0; i < 10; i++) onGemCollected(a);
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it("Focus Energy: each move's next own hit is a ×2 crit, once per timer", () => {
    const world = makeWorld();
    own(world, 'focusEnergy');
    updateTechniques(world, DT);
    const slot = world.moves[0]!;
    expect(slot.focusReady).toBe(true);
    const enemy = spawnEnemy(world, 'raticate', 900, 0);
    expect(damageEnemy(world, enemy, 10, { ...NO_HIT, slot })).toBeCloseTo(20);
    expect(damageEnemy(world, enemy, 10, { ...NO_HIT, slot })).toBeCloseTo(10);
    updateTechniques(world, 8);
    expect(slot.focusReady).toBe(true);
  });
});

describe('tag-linked Techniques', () => {
  it('Kindling: a burning death spreads to the nearest N; a spread burn spreads nothing', () => {
    const world = makeWorld();
    own(world, 'kindling', 2);
    const [a, b, c, e, d] = cluster(world, [0, 30, 60, 140, 200]);
    applyBurn(a!, 5);
    damageEnemy(world, a!, 1e6);
    expect(b!.burnLeft).toBeGreaterThan(0);
    expect(c!.burnLeft).toBeGreaterThan(0);
    expect(e!.burnLeft).toBe(0);
    expect(d!.burnLeft).toBe(0);
    damageEnemy(world, b!, 1e6); // marked: E is within 120 px of B but must not catch fire
    expect(e!.burnLeft).toBe(0);
  });

  it('Spore Cloud: a poisoned death poisons enemies in the radius', () => {
    const world = makeWorld();
    own(world, 'sporeCloud'); // 50 px
    const [a, near, far] = cluster(world, [0, 40, 80]);
    applyStatuses(a!, { slow: 0, stun: 0, poisonDps: 4 });
    damageEnemy(world, a!, 1e6);
    expect(near!.poisonLeft).toBeGreaterThan(0);
    expect(far!.poisonLeft).toBe(0);
  });

  it('Frostbite: a slowed death shatters nearby; a shatter kill shatters nothing', () => {
    const world = makeWorld();
    own(world, 'frostbite'); // 20%
    const [a, b, c, d] = cluster(world, [0, 30, 40, 80]);
    applySlow(a!, 0.3, 2);
    applySlow(b!, 0.3, 2);
    b!.hp = 1; // dies to the shatter while slowed
    const shatter = a!.hp * 0.2;
    damageEnemy(world, a!, 1e6);
    expect(b!.hp).toBeLessThanOrEqual(0);
    expect(c!.maxHp - c!.hp).toBeCloseTo(shatter);
    expect(d!.hp).toBe(d!.maxHp); // 80 px from A; 50 px from B, whose shatter must not happen
  });

  it('Riptide: Water hits slow', () => {
    const world = makeWorld('squirtle');
    own(world, 'riptide');
    const enemy = spawnEnemy(world, 'raticate', 900, 0);
    damageEnemy(world, enemy, 1, { ...NO_HIT, slot: world.moves[0]! });
    expect(enemy.slow).toBeCloseTo(0.15);
    expect(enemy.slowLeft).toBeGreaterThan(0);
  });

  it('Brawler: melee hits heal, capped per second', () => {
    const world = makeWorld();
    own(world, 'brawler'); // 3 HP/s
    const slot = createSlot('scratch');
    world.moves.push(slot);
    updateTechniques(world, 1);
    world.player.hp = 50;
    const enemy = spawnEnemy(world, 'raticate', 900, 0);
    for (let i = 0; i < 5; i++) damageEnemy(world, enemy, 1, { ...NO_HIT, slot });
    expect(world.player.hp).toBeCloseTo(53);
  });

  it('Static Field and Sharpshooter multiply damage', () => {
    const world = makeWorld();
    own(world, 'staticField'); // +15% on paralysed
    own(world, 'sharpshooter'); // +20% beyond 300 px for Projectile moves
    const slot = world.moves[0]!; // Ember: Projectile
    const close = spawnEnemy(world, 'raticate', world.player.x + 100, world.player.y);
    const far = spawnEnemy(world, 'raticate', world.player.x + 400, world.player.y);
    const neutral = { ...NO_HIT, slot, attackType: null };
    expect(damageEnemy(world, close, 10, neutral)).toBeCloseTo(10);
    expect(damageEnemy(world, far, 10, neutral)).toBeCloseTo(12);
    close.stunLeft = 1;
    close.stunKind = 'paralysis';
    expect(damageEnemy(world, close, 10, neutral)).toBeCloseTo(11.5);
  });
});

describe('Natures', () => {
  it('raise one stat and lower another; stacked downsides stop at half', () => {
    const none = { brave: 0, timid: 0, bold: 0, hasty: 0, hp: 0, pickup: 0 };
    const brave = computeModifiers({ ...none, brave: 1 }, []);
    expect(brave.damageMult).toBeCloseTo(1.25);
    expect(brave.moveSpeedMult).toBeCloseTo(0.9);
    const meek = computeModifiers({ ...none, bold: 3, timid: 3 }, []);
    expect(meek.damageMult).toBe(0.5);
  });

  it('max HP never drops below 20', () => {
    const world = makeWorld();
    world.boosts.hasty = 50;
    refreshStats(world);
    expect(world.player.maxHp).toBe(20);
  });
});

describe('build snapshot', () => {
  it('round-trips Techniques', () => {
    const world = makeWorld();
    own(world, 'moxie', 2);
    own(world, 'kindling');
    world.boosts.brave = 2;
    const json = JSON.stringify(snapshotBuild(world));
    const next = makeWorld('charmander', 9);
    restoreBuild(next, JSON.parse(json));
    expect(next.techniques).toEqual([
      { id: 'moxie', rank: 2 },
      { id: 'kindling', rank: 1 },
    ]);
    expect(snapshotBuild(next)).toEqual(JSON.parse(json));
  });
});
