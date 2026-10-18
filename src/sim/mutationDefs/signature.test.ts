import { describe, expect, it } from 'vitest';
import { POKEMON, TUNING, type PokemonId } from '../../data/content';
import { MOVES, type MeleeMoveDef, type ProjectileMoveDef } from '../../data/moves';
import { MUTATIONS, type MutationId } from '../../data/mutations';
import { emit, hooksOf } from '../hooks';
import { makeHitInfo } from '../combat';
import { grantMutation } from '../mutations';
import { augmentPool } from '../progression';
import { createSeededRng } from '../rng';
import { refreshStats } from '../stats';
import type { Enemy, InputState, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';
import { wispCount } from './ember';
import { signatureTier } from './util';

// P4f-5: the 15 signature Mutations, each checked at the tiers where it adds behaviour (rule 10).

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** A line with its signature at `tier`, holding `id`, invulnerable, no spawns. */
function sig(pokemonId: PokemonId, id: MutationId, tier = 0): World {
  const w = createWorld({ rng: createSeededRng(11), pokemonId, spawnEnabled: false });
  const line = POKEMON[pokemonId];
  if (line.stages.length > 1) {
    w.player.stage = tier;
    w.moves[0]!.moveId = line.stages[tier]!.signatureMove;
  } else if (tier > 0) {
    w.moves[0]!.moveId = line.signatureTiers![tier - 1]!.move;
  }
  expect(grantMutation(w, id)).toBe('granted');
  refreshStats(w);
  w.player.invulnLeft = 1e9;
  return w;
}

function run(w: World, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.player.invulnLeft = 1e9;
    step(w, IDLE, DT);
    if (w.offer) w.offer = null;
  }
}

function dummy(w: World, x: number, y: number, kind: 'rattata' | 'raticate' = 'raticate'): Enemy {
  const e = spawnEnemy(w, kind, x, y, 200);
  e.speed = 0;
  return e;
}

const lost = (e: Enemy) => e.maxHp - e.hp;

it('signatureTier follows the line: Ember 0, Flame Burst 1, Blast Burn 2; Sheer Cold 1', () => {
  const c = sig('charmander', 'ember.kindle', 2);
  expect(signatureTier(c, c.moves[0]!)).toBe(2);
  const lapras = sig('lapras', 'iceShard.hail', 1);
  expect(lapras.moves[0]!.moveId).toBe('sheerCold');
  expect(signatureTier(lapras, lapras.moves[0]!)).toBe(1);
});

describe('Squirtle — Bubble → Water Pulse → Hydro Cannon', () => {
  const trap = MUTATIONS['bubble.trap'].values;

  it('Bubble Trap: engulfs the first light enemy (no hit damage), then pops in a splash', () => {
    const w = sig('squirtle', 'bubble.trap');
    const target = dummy(w, 120, 0, 'rattata');
    const near = dummy(w, 150, 0);
    run(w, 0.5);
    expect(target.trapLeft).toBeGreaterThan(0);
    expect(target.stunLeft).toBeGreaterThan(0);
    expect(lost(target)).toBe(0);
    const nearBefore = lost(near);
    w.moves[0]!.cooldownLeft = 1e9;
    run(w, trap.floatSeconds);
    expect(target.trapLeft).toBe(0);
    expect(lost(target)).toBeGreaterThan(0);
    expect(lost(near)).toBeGreaterThan(nearBefore);
  });

  it('Bubble Trap at Hydro Cannon: traps up to 3 in the splash and leaves a puddle', () => {
    const w = sig('squirtle', 'bubble.trap', 2);
    const group = [dummy(w, 150, 0), dummy(w, 165, 15), dummy(w, 165, -15), dummy(w, 175, 0)];
    run(w, 0.6);
    expect(group.filter((e) => e.trapLeft > 0).length).toBe(trap.tier2.maxTrapped);
    w.moves[0]!.cooldownLeft = 1e9;
    run(w, trap.floatSeconds + 0.1);
    expect(w.puddles.length).toBeGreaterThan(0);
  });

  it('Froth Mines: each shot leaves 3 mines that pop on touch; capped at 9; −30% shot damage', () => {
    const froth = MUTATIONS['bubble.froth'].values;
    const plain = createWorld({ rng: createSeededRng(11), pokemonId: 'squirtle', spawnEnabled: false });
    const w = sig('squirtle', 'bubble.froth');
    expect(w.moves[0]!.stats.damage).toBeCloseTo(plain.moves[0]!.stats.damage * froth.damageMult);
    dummy(w, 200, 0);
    step(w, IDLE, DT);
    const alive = () => w.entities.filter((e) => e.owner === 'bubble.froth' && e.lifeLeft > 0);
    expect(alive().length).toBe(froth.minesPerShot);
    const walker = dummy(w, alive()[0]!.x, alive()[0]!.y, 'rattata');
    step(w, IDLE, DT);
    expect(lost(walker)).toBeGreaterThan(0);
    for (let i = 0; i < 6; i++) {
      w.moves[0]!.cooldownLeft = 0;
      step(w, IDLE, DT);
    }
    expect(alive().length).toBeLessThanOrEqual(froth.maxMines);
  });

  it('Undertow: bubbles return, −25% damage, Return no longer offered; Water Pulse drags back', () => {
    const w = sig('squirtle', 'bubble.undertow', 1);
    expect(w.moves[0]!.stats.returns).toBe(true);
    expect(augmentPool(w, 0).some((c) => c.augmentId === 'boomerang')).toBe(false);
    const slot = w.moves[0]!;
    const e = dummy(w, 150, 0, 'rattata');
    const hit = makeHitInfo(slot.stats, slot);
    hit.dirX = 1; // outbound (away from the player): no drag
    hooksOf(slot)!.onHit!(w, slot, e, 1, hit);
    expect(e.kbX).toBe(0);
    hit.dirX = -1; // on the way back: dragged toward the player
    hooksOf(slot)!.onHit!(w, slot, e, 1, hit);
    expect(e.kbX).toBeLessThan(0);
  });
});

describe('Charmander — Ember → Flame Burst → Blast Burn', () => {
  const kindle = MUTATIONS['ember.kindle'].values;

  /** Damage and tag of the next few shots. */
  function shots(w: World, n: number): { damage: number; tag: number }[] {
    const out: { damage: number; tag: number }[] = [];
    for (let i = 0; i < n; i++) {
      w.moves[0]!.cooldownLeft = 0;
      const before = w.projectiles.length;
      step(w, IDLE, DT);
      const p = w.projectiles[before]!;
      out.push({ damage: p.damage, tag: p.tag });
    }
    return out;
  }

  it('Kindle: every 3rd shot ×2.2 (others ×0.6); with Blaze every 2nd', () => {
    const w = sig('charmander', 'ember.kindle');
    dummy(w, 200, 0);
    const s = shots(w, 3);
    const base = w.moves[0]!.stats.damage;
    expect(s[0]!.damage).toBeCloseTo(base * kindle.otherMult);
    expect(s[2]!.damage).toBeCloseTo(base * kindle.kindledMult);
    expect(s.map((x) => x.tag)).toEqual([0, 0, 1]);

    const b = sig('charmander', 'ember.kindle');
    b.player.hp = b.player.maxHp * 0.2; // Blaze on
    dummy(b, 200, 0);
    expect(shots(b, 2).map((x) => x.tag)).toEqual([0, 1]);
  });

  it('Kindle at Flame Burst: Kindled hits leave Scorch; at Blast Burn: a telegraphed meteor and a crater', () => {
    const w = sig('charmander', 'ember.kindle', 1);
    dummy(w, 150, 0);
    w.moves[0]!.mutState.shots = 2;
    run(w, 0.6);
    expect(w.scorches.length).toBe(kindle.tier1.scorchRingPatches);

    const m = sig('charmander', 'ember.kindle', 2);
    const target = dummy(m, 150, 0);
    m.moves[0]!.mutState.shots = 2;
    step(m, IDLE, DT);
    expect(m.projectiles.length).toBe(0); // no fireball: a meteor
    expect(lost(target)).toBe(0);
    m.moves[0]!.cooldownLeft = 1e9;
    run(m, kindle.tier2.meteorTelegraph + 0.05);
    expect(lost(target)).toBeGreaterThan(0);
    expect(m.zones.some((z) => z.lifeLeft > 1)).toBe(true); // the crater
  });

  it('Flamethrower: 4 flames at 35% only up close; Burn from Flame Burst; Scorch line at Blast Burn', () => {
    const flame = MUTATIONS['ember.flamethrower'].values;
    const far = sig('charmander', 'ember.flamethrower');
    dummy(far, 250, 0);
    run(far, 0.2);
    expect(far.projectiles.length).toBe(0); // out of the short reach

    const w = sig('charmander', 'ember.flamethrower');
    dummy(w, 100, 0);
    step(w, IDLE, DT);
    expect(w.projectiles.length).toBe(flame.flames);
    expect(w.projectiles[0]!.damage).toBeCloseTo(w.moves[0]!.stats.damage * flame.flameDamageFraction);

    expect(sig('charmander', 'ember.flamethrower', 1).moves[0]!.stats.burnPct).toBeCloseTo(flame.tier1.burnPct);
    const t2 = sig('charmander', 'ember.flamethrower', 2);
    dummy(t2, 100, 0);
    step(t2, IDLE, DT);
    expect(t2.scorches.length).toBe(3);
  });

  it('Will-o-Wisp: Ember stops firing; casts store wisps (max 3) that launch at close enemies ×1.4', () => {
    const wisp = MUTATIONS['ember.wisp'].values;
    const w = sig('charmander', 'ember.wisp');
    const slot = w.moves[0]!;
    for (let i = 0; i < 5; i++) {
      slot.cooldownLeft = 0;
      step(w, IDLE, DT);
    }
    expect(wispCount(slot)).toBe(wisp.maxWisps);
    expect(w.projectiles.length).toBe(0);
    dummy(w, 300, 0);
    run(w, 0.2);
    expect(w.projectiles.length).toBe(0); // nothing within 110 px
    dummy(w, 90, 0);
    step(w, IDLE, DT);
    expect(w.projectiles.length).toBe(1);
    expect(w.projectiles[0]!.damage).toBeCloseTo(slot.stats.damage * wisp.damageMult);
    expect(wispCount(slot)).toBe(wisp.maxWisps - 1);
  });
});

describe('Bulbasaur — Vine Whip → Power Whip → Frenzy Plant', () => {
  const lash = MUTATIONS['vineWhip.longLash'].values;

  it('Long Lash: reach ×1.8 in a 50° arc; the tip crits, close enemies take less', () => {
    const w = sig('bulbasaur', 'vineWhip.longLash');
    const reach = (MOVES.vineWhip as MeleeMoveDef).reach * lash.reachMult;
    const tip = dummy(w, reach * 0.9, 0);
    const close = dummy(w, reach * 0.2, 5);
    const behind = dummy(w, -reach * 0.5, 0);
    step(w, IDLE, DT);
    const d = w.moves[0]!.stats.damage;
    expect(lost(tip)).toBeCloseTo(d * lash.tipCritMult);
    expect(lost(close)).toBeCloseTo(d * lash.closeMult);
    expect(lost(behind)).toBe(0);
  });

  it('Long Lash: Power Whip sweeps 360°; Frenzy tip hits sprout a root field; a Bloom cracks a free sweep', () => {
    const w = sig('bulbasaur', 'vineWhip.longLash', 1);
    const behind = dummy(w, -60, 0);
    step(w, IDLE, DT);
    expect(lost(behind)).toBeGreaterThan(0);

    const f = sig('bulbasaur', 'vineWhip.longLash', 2);
    const reach = (MOVES.frenzyPlant as MeleeMoveDef).reach * lash.reachMult;
    dummy(f, reach * 0.9, 0);
    step(f, IDLE, DT);
    expect(f.zones.filter((z) => z.source === 'frenzyPlant').length).toBe(2); // the move's own + the tip's

    const b = sig('bulbasaur', 'vineWhip.longLash', 1);
    const e = dummy(b, 60, 0);
    b.moves[0]!.cooldownLeft = 1e9;
    step(b, IDLE, DT); // builds the spatial hash; the lash itself is on cooldown
    expect(lost(e)).toBe(0);
    emit(b, 'bloom', 1);
    expect(lost(e)).toBeGreaterThan(0);
  });

  it('Thorn Garden: swings plant sprouts that lash every 1 s; max 4; Frenzy sprouts end as root fields', () => {
    const garden = MUTATIONS['vineWhip.thornGarden'].values;
    const w = sig('bulbasaur', 'vineWhip.thornGarden');
    const e = dummy(w, 60, 0);
    step(w, IDLE, DT);
    const alive = () => w.entities.filter((s) => s.owner === 'vineWhip.thornGarden' && s.lifeLeft > 0);
    expect(alive().length).toBe(1);
    w.moves[0]!.cooldownLeft = 1e9;
    const before = lost(e);
    run(w, garden.lashInterval + 0.05);
    expect(lost(e)).toBeGreaterThan(before);
    for (let i = 0; i < 6; i++) {
      w.moves[0]!.cooldownLeft = 0;
      step(w, IDLE, DT);
    }
    expect(alive().length).toBe(garden.maxSprouts);

    const f = sig('bulbasaur', 'vineWhip.thornGarden', 2);
    dummy(f, 60, 0);
    step(f, IDLE, DT);
    f.moves[0]!.cooldownLeft = 1e9;
    run(f, garden.sproutSeconds + 0.1);
    expect(f.zones.some((z) => z.source === 'frenzyPlant' && z.lifeLeft > 0)).toBe(true);
  });

  it('Sap Lash: hits heal 1 HP (max 4 per swing); Power Whip seeds; Frenzy root fields heal you', () => {
    const sap = MUTATIONS['vineWhip.sapLash'].values;
    const w = sig('bulbasaur', 'vineWhip.sapLash', 1);
    w.player.hp = 50;
    for (let i = 0; i < 6; i++) dummy(w, 40 + i * 5, (i % 2) * 10);
    step(w, IDLE, DT);
    // Leech heals too, so at least the 4 Sap heals.
    expect(w.player.hp).toBeGreaterThanOrEqual(50 + sap.maxHealPerSwing * sap.healPerHit);
    expect(w.enemies.every((e) => e.seedLeft > 0)).toBe(true);

    const f = sig('bulbasaur', 'vineWhip.sapLash', 2);
    f.moves[0]!.cooldownLeft = 1e9;
    f.zones.push({
      id: 999,
      x: 0,
      y: 0,
      radius: 60,
      lifeLeft: 5,
      duration: 5,
      tickInterval: 9,
      tickLeft: 9,
      damage: 0,
      critChance: 0,
      slow: 0,
      stun: 0,
      poisonDps: 0,
      attackType: null,
      source: 'frenzyPlant',
    });
    f.player.hp = 50;
    run(f, 1);
    expect(f.player.hp).toBeCloseTo(50 + sap.tier2.rootHealPerSec, 0);
  });
});

describe('Pikachu — Thunder Shock → Thunderbolt', () => {
  it('Live Wire: chain jumps leave wires that hurt enemies crossing them', () => {
    const wire = MUTATIONS['thunderShock.liveWire'].values;
    const w = sig('pikachu', 'thunderShock.liveWire');
    dummy(w, 150, 0);
    dummy(w, 220, 0);
    run(w, 0.4);
    const wires = w.entities.filter((e) => e.owner === 'thunderShock.liveWire');
    expect(wires.length).toBeGreaterThan(0);
    const crosser = dummy(w, (wires[0]!.x + wires[0]!.x2) / 2, (wires[0]!.y + wires[0]!.y2) / 2 + 2, 'rattata');
    w.moves[0]!.cooldownLeft = 1e9;
    run(w, wire.wireTickInterval * 2);
    expect(lost(crosser)).toBeGreaterThan(0);
  });

  it('Ball Lightning: no bolt, a slow orb that zaps nearby enemies; at Thunderbolt it ends in a chain', () => {
    const ball = MUTATIONS['thunderShock.ballLightning'].values;
    const w = sig('pikachu', 'thunderShock.ballLightning');
    const e = dummy(w, 100, 0);
    step(w, IDLE, DT);
    expect(w.projectiles.length).toBe(0);
    expect(w.entities.some((x) => x.owner === 'thunderShock.ballLightning')).toBe(true);
    w.moves[0]!.cooldownLeft = 1e9;
    run(w, 0.5);
    expect(lost(e)).toBeGreaterThan(0);

    const t = sig('pikachu', 'thunderShock.ballLightning', 1);
    const path = ball.orbSpeed * ball.orbSeconds;
    dummy(t, path + 200, 0); // only a target far along the line, to aim the orb
    const end = dummy(t, path + 10, 0);
    const next = dummy(t, path + 70, 0);
    step(t, IDLE, DT);
    t.moves[0]!.cooldownLeft = 1e9;
    run(t, ball.orbSeconds + 0.1);
    expect(lost(end)).toBeGreaterThan(0);
    expect(lost(next)).toBeGreaterThan(0);
  });

  it('Return Arc: each jump +4 Charge; at Thunderbolt the arc back hurts enemies on the way', () => {
    const ret = MUTATIONS['thunderShock.returnArc'].values;
    const w = sig('pikachu', 'thunderShock.returnArc');
    dummy(w, 150, 0);
    dummy(w, 220, 0);
    dummy(w, 290, 0);
    step(w, IDLE, DT);
    w.moves[0]!.cooldownLeft = 1e9;
    run(w, 0.4);
    expect(w.player.charge).toBeGreaterThanOrEqual(ret.chargePerJump * 2);

    // The arc back from the chain's last enemy hurts what it crosses, from Thunderbolt on.
    for (const [tier, hurts] of [[0, false], [1, true]] as const) {
      const t = sig('pikachu', 'thunderShock.returnArc', tier);
      t.moves[0]!.cooldownLeft = 1e9;
      const last = dummy(t, 200, 0);
      const between = dummy(t, 100, 0);
      step(t, IDLE, DT); // builds the spatial hash
      hooksOf(t.moves[0]!)!.onChainEnd!(t, t.moves[0]!, last);
      expect(lost(between) > 0).toBe(hurts);
      expect(lost(last)).toBe(0);
      expect(t.arcs.length).toBe(1);
    }
  });
});

describe('Lapras — Ice Shard → Sheer Cold', () => {
  it('Hail: shards fall on the 2 nearest within 200 px after a shadow; Sheer Cold leaves small freezing fields', () => {
    const hail = MUTATIONS['iceShard.hail'].values;
    const w = sig('lapras', 'iceShard.hail');
    const a = dummy(w, 80, 0);
    const b = dummy(w, 120, 0);
    const c = dummy(w, 150, 60); // third nearest, clear of the other impacts
    const far = dummy(w, 260, 0);
    step(w, IDLE, DT);
    expect(w.projectiles.length).toBe(0);
    expect(lost(a)).toBe(0);
    w.moves[0]!.cooldownLeft = 1e9;
    run(w, hail.shadowSeconds + 0.05);
    expect(lost(a)).toBeGreaterThan(0);
    expect(lost(b)).toBeGreaterThan(0);
    expect(lost(c)).toBe(0);
    expect(lost(far)).toBe(0);

    const t = sig('lapras', 'iceShard.hail', 1);
    dummy(t, 80, 0);
    step(t, IDLE, DT);
    expect(t.zones.filter((z) => z.slow > 0 && z.duration > 1).length).toBe(1);
  });

  it('Frost Lance: pierces every enemy in a line and slows; cooldown ×1.4; Sheer Cold freezes a strip', () => {
    const lance = MUTATIONS['iceShard.frostLance'].values;
    const w = sig('lapras', 'iceShard.frostLance');
    const line = [dummy(w, 80, 0), dummy(w, 140, 0), dummy(w, 200, 0)];
    run(w, 0.6);
    expect(line.every((e) => lost(e) > 0)).toBe(true);
    expect(line.every((e) => e.slow >= lance.slow)).toBe(true);
    expect(w.moves[0]!.stats.cooldown).toBeCloseTo((MOVES.iceShard as ProjectileMoveDef).cooldown * lance.cooldownMult);

    const t = sig('lapras', 'iceShard.frostLance', 1);
    dummy(t, 100, 0);
    step(t, IDLE, DT);
    expect(t.zones.length).toBeGreaterThanOrEqual(lance.tier1.stripPatches);
  });

  it('Song of the Sea: every 4th cast sleeps light enemies around you (no damage); Sheer Cold adds a calm field', () => {
    const song = MUTATIONS['iceShard.song'].values;
    const w = sig('lapras', 'iceShard.song');
    const e = dummy(w, 100, 0, 'rattata');
    w.moves[0]!.mutState.casts = song.everyN - 1;
    step(w, IDLE, DT);
    expect(w.projectiles.length).toBe(0);
    expect(e.stunLeft).toBeGreaterThan(0);
    expect(lost(e)).toBe(0);

    const t = sig('lapras', 'iceShard.song', 1);
    dummy(t, 100, 0);
    t.moves[0]!.mutState.casts = song.everyN - 1;
    step(t, IDLE, DT);
    expect(t.zones.some((z) => z.radius === song.tier1.fieldRadius && z.slow === song.tier1.slow)).toBe(true);
  });
});
