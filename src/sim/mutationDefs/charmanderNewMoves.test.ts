import { describe, expect, it } from 'vitest';
import { ENEMIES, POKEMON, TUNING } from '../../data/content';
import { MOVES, type MoveId, type ZoneMoveDef } from '../../data/moves';
import { MUTATION_TUNING, MUTATIONS, type MutationId } from '../../data/mutations';
import { CRIT_MULTIPLIER } from '../../data/upgrades';
import { applyBlind, isAbilityActive } from '../combat';
import { grantMutation, mutationOffers } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import { spawnScorch } from '../terrain';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4f-7: Smokescreen, Slash and Wing Attack (the new Charmander-line moves) and their Mutations.

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };
const smokescreen = MOVES.smokescreen as ZoneMoveDef;
const slash = MOVES.slash as ZoneMoveDef;

/** Charmander (at `stage`) with only `move` acting, holding `id`, invulnerable. */
function withMove(move: MoveId, id: MutationId | null, stage = 0): { w: World; slot: MoveSlot } {
  const w = createWorld({ rng: createSeededRng(71), pokemonId: 'charmander', spawnEnabled: false });
  w.player.stage = stage;
  w.moves.push(createSlot(move));
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  if (id) expect(grantMutation(w, id)).toBe('granted');
  w.player.invulnLeft = 1e9;
  return { w, slot: w.moves[1]! };
}

function run(w: World, seconds: number, input: InputState = IDLE): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.player.invulnLeft = 1e9;
    step(w, input, DT);
    if (w.offer) w.offer = null;
  }
}

function dummy(w: World, x: number, y: number): Enemy {
  const e = spawnEnemy(w, 'raticate', x, y, 200);
  e.speed = 0;
  return e;
}

const lost = (e: Enemy) => e.maxHp - e.hp;
const smokes = (w: World) => w.zones.filter((z) => z.source === 'smokescreen' && z.lifeLeft > 0);

describe('Charmander learnset (P4f-7)', () => {
  it('8 moves: Smokescreen and Wing Attack from Charmander, Slash from Charmeleon', () => {
    const learnset = POKEMON.charmander.learnset;
    expect(learnset).toHaveLength(8);
    expect(learnset.find((e) => e.move === 'smokescreen')?.fromStage).toBe(0);
    expect(learnset.find((e) => e.move === 'wingAttack')?.fromStage).toBe(0);
    expect(learnset.find((e) => e.move === 'slash')?.fromStage).toBe(1);
  });
});

describe('Smokescreen (base)', () => {
  it('drops a cloud on you once an enemy is close; enemies inside are Blinded and take no damage', () => {
    const { w } = withMove('smokescreen', null);
    const e = dummy(w, 60, 0);
    run(w, DT);
    expect(smokes(w)).toHaveLength(1);
    expect(smokes(w)[0]!.x).toBe(0);
    run(w, smokescreen.tickInterval + DT);
    expect(e.blindLeft).toBeGreaterThan(0);
    expect(lost(e)).toBe(0);
  });

  it('a Blinded enemy walks to its own random point instead of you', () => {
    const { w } = withMove('smokescreen', null);
    w.moves[1]!.cooldownLeft = 1e9;
    const e = spawnEnemy(w, 'raticate', 200, 0, 200);
    applyBlind(w, e, 1);
    const target = { x: e.wanderX, y: e.wanderY };
    const before = Math.hypot(target.x - e.x, target.y - e.y);
    expect(before).toBeCloseTo(TUNING.status.blindWanderPx);
    run(w, 0.3);
    expect(Math.hypot(target.x - e.x, target.y - e.y)).toBeLessThan(before);
  });

  it('a Blinded enemy deals −30% contact damage', () => {
    const { w } = withMove('smokescreen', null);
    w.moves[1]!.cooldownLeft = 1e9;
    const e = dummy(w, 5, 0);
    applyBlind(w, e, 5);
    w.player.invulnLeft = 0;
    const hp = w.player.hp;
    step(w, IDLE, DT);
    expect(hp - w.player.hp).toBeCloseTo(e.contactDamage * TUNING.status.blindContactMult * w.mods.damageTakenMult);
  });

  it('bosses are immune to Blinded', () => {
    const { w } = withMove('smokescreen', null);
    const e = dummy(w, 300, 0);
    // No boss exists before P5: mark a dummy kind as one for this check.
    const def = ENEMIES.raticate as { boss?: boolean };
    def.boss = true;
    try {
      applyBlind(w, e, 2);
      expect(e.blindLeft).toBe(0);
    } finally {
      delete def.boss;
    }
  });
});

describe('Slash (base)', () => {
  it('cuts the nearest enemy up to 220 px away instantly, with +25% innate crit', () => {
    const { w, slot } = withMove('slash', null, 1);
    expect(slot.stats.critChance).toBeCloseTo(slash.critChance!);
    const e = dummy(w, 200, 0);
    run(w, DT);
    expect(lost(e)).toBeGreaterThan(0);
    expect(w.cuts).toHaveLength(1);
  });
});

describe('Wing Attack (base)', () => {
  it('beats both wings to your left and right; nothing straight ahead is hit', () => {
    const { w } = withMove('wingAttack', null);
    const ahead = dummy(w, 50, 0);
    const left = dummy(w, 0, -50);
    const right = dummy(w, 0, 50);
    run(w, DT);
    expect(lost(left)).toBeGreaterThan(0);
    expect(lost(right)).toBeGreaterThan(0);
    expect(lost(ahead)).toBe(0);
  });
});

describe('Smokescreen Mutations', () => {
  it('Choking Smoke: a 30% smaller cloud that deals 4 per tick', () => {
    const v = MUTATIONS['smokescreen.chokingSmoke'].values;
    const { w, slot } = withMove('smokescreen', 'smokescreen.chokingSmoke');
    const e = dummy(w, 40, 0);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    expect(smokes(w)[0]!.radius).toBeCloseTo(smokescreen.radius * v.radiusMult);
    run(w, smokescreen.tickInterval + DT);
    expect(lost(e)).toBeCloseTo(v.tickDamage);
  });

  it('Smoke Trail: puffs fall behind you while you move, none while you stand still', () => {
    const v = MUTATIONS['smokescreen.smokeTrail'].values;
    const { w, slot } = withMove('smokescreen', 'smokescreen.smokeTrail');
    dummy(w, 100, 0);
    run(w, 1);
    expect(smokes(w)).toHaveLength(0);
    slot.cooldownLeft = 1e9;
    run(w, 1, { moveX: -1, moveY: 0 });
    const puffs = smokes(w);
    expect(puffs.length).toBeGreaterThanOrEqual(2);
    expect(puffs[0]!.radius).toBeCloseTo(v.puffRadius);
    expect(puffs[0]!.duration).toBeCloseTo(v.puffSeconds);
  });

  it('Hidden Flame: inside your own (smaller) smoke, Blaze counts as active at full HP', () => {
    const v = MUTATIONS['smokescreen.hiddenFlame'].values;
    const { w, slot } = withMove('smokescreen', 'smokescreen.hiddenFlame');
    dummy(w, 100, 0);
    expect(isAbilityActive(w)).toBe(false);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    expect(smokes(w)[0]!.radius).toBeCloseTo(smokescreen.radius * v.radiusMult);
    expect(w.player.hp).toBe(w.player.maxHp);
    expect(isAbilityActive(w)).toBe(true);
    w.player.x = 500; // stepped out
    expect(isAbilityActive(w)).toBe(false);
  });
});

describe('Slash Mutations', () => {
  it('Afterimage: crit drops to 15%; an enemy walking into the mark is cut again for 50%', () => {
    const v = MUTATIONS['slash.afterimage'].values;
    const { w, slot } = withMove('slash', 'slash.afterimage', 1);
    expect(slot.stats.critChance).toBeCloseTo(v.innateCrit);
    const first = dummy(w, 100, 0);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    const walker = dummy(w, 100, 10);
    run(w, DT * 2);
    expect(lost(walker)).toBeCloseTo(slot.stats.damage * v.recutFraction);
    const once = lost(first);
    run(w, v.markSeconds);
    expect(lost(first)).toBe(once); // its own mark doesn't cut it again
  });

  it('Flurry: three single cuts on the 3 nearest enemies at the cut fraction each', () => {
    const v = MUTATIONS['slash.flurry'].values;
    const { w, slot } = withMove('slash', 'slash.flurry', 1);
    slot.stats.critChance = 0;
    const es = [dummy(w, 100, 0), dummy(w, -100, 0), dummy(w, 0, 150)];
    const far = dummy(w, 0, -210);
    run(w, DT);
    for (const e of es) expect(lost(e)).toBeCloseTo(slot.stats.damage * v.cutDamageFraction);
    expect(lost(far)).toBe(0);
  });

  it('Searing Slash: always crits a Burning enemy and cashes in its whole Burn', () => {
    const { w, slot } = withMove('slash', 'slash.searingSlash', 1);
    slot.stats.critChance = 0;
    const e = dummy(w, 100, 0);
    e.burnDps = 4;
    e.burnLeft = 2;
    e.burnTickLeft = 1; // no burn tick in this step
    run(w, DT);
    expect(e.burnLeft).toBe(0);
    // The burn ran one step before the cut cashed in the rest.
    expect(lost(e)).toBeCloseTo(slot.stats.damage * CRIT_MULTIPLIER + 4 * (2 - DT), 1);
  });

  it('Searing Slash: −20% against enemies that are not Burning', () => {
    const v = MUTATIONS['slash.searingSlash'].values;
    const { w, slot } = withMove('slash', 'slash.searingSlash', 1);
    slot.stats.critChance = 0;
    const e = dummy(w, 100, 0);
    run(w, DT);
    expect(lost(e)).toBeCloseTo(slot.stats.damage * v.damageMultNotBurning);
  });
});

describe('Wing Attack Mutations', () => {
  it('Updraft: a light enemy is lifted 0.6 s, then lands staggered away from you', () => {
    const v = MUTATIONS['wingAttack.updraft'].values;
    const { w, slot } = withMove('wingAttack', 'wingAttack.updraft');
    const e = dummy(w, 0, -50);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    expect(e.stunLeft).toBeCloseTo(v.liftSeconds, 1);
    e.kbX = 0;
    e.kbY = 0;
    run(w, v.liftSeconds);
    expect(e.kbY).toBeLessThan(0); // pushed further up, away from you
  });

  it('Backdraft: one wide gust behind you; nothing in front or to the side is hit', () => {
    const v = MUTATIONS['wingAttack.backdraft'].values;
    const { w, slot } = withMove('wingAttack', 'wingAttack.backdraft');
    const ahead = dummy(w, 50, 0);
    const side = dummy(w, 0, -60);
    const behind = dummy(w, -50, 10);
    run(w, DT);
    expect(lost(behind)).toBeGreaterThan(0);
    expect(lost(ahead)).toBe(0);
    expect(lost(side)).toBe(0);
    expect(slot.stats.knockback).toBe(v.stagger);
  });

  it('Fan the Flames: a Scorch patch the gust touches flares to 3 s, grows 50% and drifts 40 px', () => {
    const v = MUTATIONS['wingAttack.fanTheFlames'].values;
    const { w, slot } = withMove('wingAttack', 'wingAttack.fanTheFlames', 2);
    const patch = spawnScorch(w, 0, -60, 10);
    patch.lifeLeft = 0.5;
    const away = spawnScorch(w, 60, 0, 10); // straight ahead: no gust there
    dummy(w, 0, 60);
    run(w, DT);
    slot.cooldownLeft = 1e9;
    expect(patch.lifeLeft).toBeGreaterThan(v.refreshSeconds - 0.1);
    expect(patch.radius).toBeCloseTo(MUTATION_TUNING.scorch.radius * (1 + v.growPct));
    expect(patch.y).toBeCloseTo(-60 - v.driftPx);
    expect(away.radius).toBe(MUTATION_TUNING.scorch.radius);
  });

  it('Fan the Flames is only offered when the build makes Scorch', () => {
    const { w } = withMove('wingAttack', null, 2);
    expect(mutationOffers(w)).not.toContain('wingAttack.fanTheFlames');
    expect(grantMutation(w, 'ember.kindle')).toBe('granted');
    expect(mutationOffers(w)).toContain('wingAttack.fanTheFlames');
  });
});
