import { describe, expect, it } from 'vitest';
import { ABILITIES, POKEMON, TUNING, type AbilityId, type PokemonId } from '../data/content';
import { MUTATION_TUNING } from '../data/mutations';
import { damageEnemy, makeHitInfo } from './combat';
import { finishEvolutionCinematic, startEvolutionIfDue } from './evolution';
import { bulbCapacity, defineMutation, healPlayer, tideFlood, type HookEvent } from './hooks';
import { createSeededRng } from './rng';
import { refreshStats } from './stats';
import type { InputState, World } from './types';
import { createWorld, spawnEnemy, step } from './world';

// P4f-4: line mechanics and evolved ability tiers (docs/moveset/<line>/README.md).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** A line at a given trait, signature parked so only the ability acts. */
function make(pokemonId: PokemonId, ability?: AbilityId): World {
  const w = createWorld({ rng: createSeededRng(9), pokemonId, spawnEnabled: false });
  if (ability) w.player.ability = ability;
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  return w;
}

function listen(w: World): Record<string, number> {
  const heard: Record<string, number> = {};
  defineMutation('tackle.rollout', {
    onEvent: (_w, _s, event: HookEvent, amount) => {
      heard[event] = (heard[event] ?? 0) + amount;
    },
  });
  w.moves[0]!.mutation = 'tackle.rollout';
  return heard;
}

const touchers = new WeakMap<World, ReturnType<typeof spawnEnemy>>();

/** One contact hit from the pinned toucher (fresh invulnerability window; pops can't push it away). */
function touch(w: World): void {
  const e = touchers.get(w);
  if (e) {
    e.x = w.player.x;
    e.y = w.player.y;
    e.kbX = e.kbY = 0;
    e.stunLeft = 0;
  }
  w.player.invulnLeft = 0;
  step(w, IDLE, DT);
}

/** A tough enemy sitting on the player. */
function toucher(w: World, hpScale = 100) {
  const e = spawnEnemy(w, 'rattata', w.player.x, w.player.y, hpScale);
  e.speed = 0;
  touchers.set(w, e);
  return e;
}

describe('evolution grants the evolved tier', () => {
  it.each([
    ['charmander', 'blaze.flareUp'],
    ['squirtle', 'shell.tidalGuard'],
    ['bulbasaur', 'leech.bloom'],
    ['pikachu', 'static.discharge'],
  ] as const)('%s → %s', (line, tier) => {
    const w = make(line);
    w.level = POKEMON[line].stages[1]!.level;
    startEvolutionIfDue(w);
    finishEvolutionCinematic(w);
    expect(w.player.ability).toBe(tier);
  });
});

describe('Shell rework + Shell Burst (Squirtle line)', () => {
  it('hits while Shell is down cut its recharge by 1 s; a block pops a stagger ring with no damage', () => {
    const w = make('squirtle');
    const near = spawnEnemy(w, 'raticate', 40, 0, 100);
    near.speed = 0;
    const rat = toucher(w);
    touch(w); // blocked
    expect(w.player.blockReadyLeft).toBeCloseTo(8, 1);
    expect(near.kbX).toBeGreaterThan(0);
    expect(near.hp).toBe(near.maxHp);
    const before = w.player.blockReadyLeft;
    touch(w); // taken while down
    expect(w.player.blockReadyLeft).toBeCloseTo(before - DT - 1, 5);
    expect(rat.hp).toBe(rat.maxHp);
  });

  it('Tidal Guard: every 3rd block is a Shell Burst (10% max HP, Soak); Torrent+ every 2nd; Rain Dish heals', () => {
    const w = make('squirtle', 'shell.tidalGuard');
    const heard = listen(w);
    const target = spawnEnemy(w, 'raticate', 100, 0, 100);
    target.speed = 0;
    toucher(w);
    for (let i = 0; i < 3; i++) {
      w.player.blockReadyLeft = 0;
      touch(w);
    }
    expect(heard.shellBurst).toBe(1);
    expect(target.maxHp - target.hp).toBeCloseTo(w.player.maxHp * ABILITIES['shell.tidalGuard'].shell!.burst!.maxHpFraction);
    expect(target.soakLeft).toBeGreaterThan(0);

    const t = make('squirtle', 'torrentPlus');
    const heardT = listen(t);
    toucher(t);
    for (let i = 0; i < 4; i++) {
      t.player.blockReadyLeft = 0;
      touch(t);
    }
    expect(heardT.shellBurst).toBe(2);

    const r = make('squirtle', 'rainDish');
    r.player.hp = 100;
    toucher(r);
    touch(r);
    expect(r.player.hp).toBeGreaterThanOrEqual(100 + r.player.maxHp * 0.03 - 1e-6);
  });
});

describe('Flare Up (Charmander line)', () => {
  function charmeleon(ability: AbilityId = 'blaze.flareUp'): World {
    const w = make('charmander', ability);
    w.player.stage = 1;
    refreshStats(w);
    w.moves[0]!.cooldownLeft = 1e9;
    return w;
  }

  it('a hit that crosses 30% erupts a nova (3× signature hit, Burn, 1 s invulnerable) at most once per 25 s', () => {
    const w = charmeleon();
    const heard = listen(w);
    const sig = w.moves[0]!.stats.damage;
    const far = spawnEnemy(w, 'raticate', 120, 0, 100);
    far.speed = 0;
    toucher(w);
    w.player.hp = w.player.maxHp * 0.3 + 1;
    touch(w);
    expect(heard.flareUp).toBe(1);
    // 3× the signature hit, and Blaze is on by then (+50%): you're in the Blaze zone.
    expect(far.maxHp - far.hp).toBeCloseTo(sig * 3 * 1.5, 0);
    expect(far.burnLeft).toBeGreaterThan(0);
    expect(w.player.invulnLeft).toBeGreaterThan(0.9);
    w.player.hp = w.player.maxHp * 0.3 + 1;
    touch(w);
    expect(heard.flareUp).toBe(1); // cooling down
    expect(w.player.flareCooldownLeft).toBeGreaterThan(24);
  });

  it('plain Blaze has no Flare Up; Blaze+ erupts at 40%; Solar Power is wider and leaves Scorch', () => {
    const c = make('charmander');
    const heardC = listen(c);
    toucher(c);
    c.player.hp = c.player.maxHp * 0.3 + 1;
    touch(c);
    expect(heardC.flareUp).toBeUndefined();

    const plus = charmeleon('blazePlus');
    const heardP = listen(plus);
    toucher(plus);
    plus.player.hp = plus.player.maxHp * 0.4 + 1;
    touch(plus);
    expect(heardP.flareUp).toBe(1);
    expect(plus.player.flareCooldownLeft).toBeCloseTo(15, 0);

    const solar = charmeleon('solarPower');
    const wide = spawnEnemy(solar, 'raticate', 190, 0, 100); // outside 140, inside 210
    wide.speed = 0;
    toucher(solar);
    solar.player.hp = solar.player.maxHp * 0.3 + 1;
    touch(solar);
    expect(wide.hp).toBeLessThan(wide.maxHp);
    expect(solar.scorches.length).toBe(MUTATION_TUNING.scorch.maxAlive);
  });
});

describe('the Bulb and Bloom (Bulbasaur line)', () => {
  it('Bulbasaur has no Bulb; from Ivysaur overheal fills it up to 40% max HP', () => {
    const b = make('bulbasaur');
    healPlayer(b, 50);
    expect(b.player.bulb).toBe(0);

    const w = make('bulbasaur', 'leech.bloom');
    w.player.bloomCooldownLeft = 99; // hold the Bloom
    w.player.hp = w.player.maxHp - 10;
    healPlayer(w, 30);
    expect(w.player.bulb).toBeCloseTo(20);
    healPlayer(w, 1000);
    expect(w.player.bulb).toBeCloseTo(bulbCapacity(w));
    expect(bulbCapacity(w)).toBeCloseTo(w.player.maxHp * 0.4);
  });

  it('a full Bulb Blooms: stored × bloomMult around you, slow, empties; rate-limited; Bloom never heals', () => {
    const bulb = ABILITIES['leech.bloom'].bulb!;
    const w = make('bulbasaur', 'leech.bloom');
    const heard = listen(w);
    const e = spawnEnemy(w, 'raticate', 100, 0, 100);
    e.speed = 0;
    w.player.bulb = bulbCapacity(w);
    step(w, IDLE, DT);
    expect(heard.bloom).toBe(1);
    expect(e.maxHp - e.hp).toBeCloseTo(bulbCapacity(w) * bulb.bloomMult);
    expect(e.slow).toBeCloseTo(bulb.bloomSlow);
    expect(w.player.bulb).toBe(0); // Bloom damage didn't refill it (no Leech on procs)
    w.player.bulb = bulbCapacity(w);
    step(w, IDLE, DT);
    expect(heard.bloom).toBe(1);
    for (let i = 0; i < Math.round(bulb.minInterval / DT); i++) step(w, IDLE, DT);
    expect(heard.bloom).toBe(2);
  });

  it('Chlorophyll: smaller Bulb. Overgrow+: dropping below 40% with a half-full Bulb heals with it', () => {
    const c = make('bulbasaur', 'chlorophyll');
    expect(bulbCapacity(c)).toBeCloseTo(c.player.maxHp * 0.4 * 0.7);

    const o = make('bulbasaur', 'overgrowPlus');
    o.player.bloomCooldownLeft = 99;
    o.player.bulb = bulbCapacity(o) * 0.6;
    const stored = o.player.bulb;
    toucher(o);
    o.player.hp = o.player.maxHp * 0.4 + 1;
    touch(o);
    expect(o.player.bulb).toBe(0);
    expect(o.player.hp).toBeCloseTo(o.player.maxHp * 0.4 + 1 - 10 + stored, 0);
  });
});

describe('Charge and Discharge (Pikachu line)', () => {
  it('running fills Charge (1 per 20 px); a Static paralysis adds 15', () => {
    const w = make('pikachu');
    const run = Math.round(1 / DT);
    for (let i = 0; i < run; i++) step(w, { moveX: 1, moveY: 0 }, DT);
    expect(w.player.charge).toBeCloseTo((w.player.speed * run * DT) / 20, 0);
    const before = w.player.charge;
    toucher(w);
    touch(w);
    expect(w.player.charge).toBeCloseTo(before + 15, 0);
  });

  it('Pikachu: full Charge makes the next signature shot ×2, then resets', () => {
    const w = make('pikachu');
    const heard = listen(w);
    w.player.invulnLeft = 1e9;
    const target = spawnEnemy(w, 'raticate', 120, 0, 100);
    target.speed = 0;
    w.player.charge = 99.95;
    step(w, { moveX: 1, moveY: 0 }, DT); // tops it up
    expect(heard.chargeFull).toBe(1);
    w.moves[0]!.cooldownLeft = 0;
    const sig = w.moves[0]!.stats.damage;
    for (let i = 0; i < 30; i++) step(w, IDLE, DT);
    expect(w.player.charge).toBe(0);
    expect(target.maxHp - target.hp).toBeGreaterThanOrEqual(sig * 2 - 1e-6);
    expect(w.moves[0]!.stats.damage).toBeCloseTo(sig); // the doubling was only for that cast
  });

  it('Raichu: full Charge releases a Discharge (3× signature hit, paralysis with fatigue); traits twist it', () => {
    const w = make('pikachu', 'static.discharge');
    w.player.stage = 1;
    refreshStats(w);
    w.moves[0]!.cooldownLeft = 1e9;
    const heard = listen(w);
    const e = spawnEnemy(w, 'raticate', 100, 0, 100);
    e.speed = 0;
    w.player.charge = 100;
    step(w, IDLE, DT);
    expect(heard.discharge).toBe(1);
    expect(w.player.charge).toBe(0);
    expect(e.maxHp - e.hp).toBeCloseTo(w.moves[0]!.stats.damage * 3);
    expect(e.stunLeft).toBeGreaterThan(0);
    expect(e.fatigueOnEnd).toBe(true);

    expect(ABILITIES.staticPlus.charge!.perParalysis).toBe(30);
    const rod = make('pikachu', 'lightningRod');
    const wide = spawnEnemy(rod, 'raticate', 190, 0, 100); // outside 150, inside 210
    wide.speed = 0;
    rod.player.charge = 100;
    step(rod, IDLE, DT);
    expect(wide.hp).toBeLessThan(wide.maxHp);
  });
});

describe('the Tide (Lapras)', () => {
  it('Flood before Lv 30, Ebb from Lv 30', () => {
    const w = make('lapras');
    w.level = 29;
    expect(tideFlood(w)).toBe(true);
    w.level = MUTATION_TUNING.tideLevel;
    expect(tideFlood(w)).toBe(false);
  });
});

describe('ability procs stay procs', () => {
  it("a Bloom kill doesn't heal through Leech and doesn't count as a kill event", () => {
    const w = make('bulbasaur', 'leech.bloom');
    const heard = listen(w);
    const e = spawnEnemy(w, 'rattata', 50, 0);
    e.speed = 0;
    w.player.hp = 50;
    w.player.bulb = bulbCapacity(w);
    step(w, IDLE, DT);
    expect(e.hp).toBeLessThanOrEqual(0);
    expect(heard.kill).toBeUndefined();
    expect(w.player.hp).toBe(50);
    // A normal hit still heals through Leech.
    const f = spawnEnemy(w, 'rattata', 300, 300, 100);
    damageEnemy(w, f, 100, makeHitInfo(w.moves[0]!.stats, w.moves[0]!));
    expect(w.player.hp).toBeGreaterThan(50);
  });
});
