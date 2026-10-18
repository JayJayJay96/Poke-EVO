import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/content';
import { MOVES, type BeamMoveDef, type MoveId, type OrbitMoveDef, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS, type MutationId } from '../../data/mutations';
import { applyStatuses, damageEnemy, makeHitInfo } from '../combat';
import { bulbCapacity, emit, mutationDamageTakenMult, mutationMoveSpeedMult } from '../hooks';
import { grantMutation } from '../mutations';
import { createSeededRng } from '../rng';
import { createSlot, refreshStats } from '../stats';
import type { Enemy, InputState, MoveSlot, World } from '../types';
import { createWorld, spawnEnemy, step } from '../world';

// P4f-6c: the Bulbasaur-line learnset Mutations.

const DT = TUNING.stepSeconds;
const IDLE: InputState = { moveX: 0, moveY: 0 };

/** Bulbasaur (at `stage`, Bulb Bloom from stage 1) with only `move` acting, holding `id`, invulnerable. */
function withMove(move: MoveId, id: MutationId | null, stage = 0): { w: World; slot: MoveSlot } {
  const w = createWorld({ rng: createSeededRng(41), pokemonId: 'bulbasaur', spawnEnabled: false });
  w.player.stage = stage;
  if (stage >= 1) w.player.ability = 'leech.bloom';
  w.moves.push(createSlot(move));
  refreshStats(w);
  w.moves[0]!.cooldownLeft = 1e9;
  if (id) expect(grantMutation(w, id)).toBe('granted');
  w.player.invulnLeft = 1e9;
  w.player.bloomCooldownLeft = 1e9; // no Blooms unless a test asks
  return { w, slot: w.moves[1]! };
}

function run(w: World, seconds: number, input: InputState = IDLE): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.player.invulnLeft = 1e9;
    step(w, input, DT);
    if (w.offer) w.offer = null;
  }
}

function dummy(w: World, x: number, y: number, kind: 'rattata' | 'raticate' = 'raticate'): Enemy {
  const e = spawnEnemy(w, kind, x, y, 200);
  e.speed = 0;
  return e;
}

const lost = (e: Enemy) => e.maxHp - e.hp;

describe('Tackle', () => {
  it('Rollout: each connecting Tackle adds a stack (more damage and reach), up to 5', () => {
    const v = MUTATIONS['tackle.rollout'].values;
    const { w, slot } = withMove('tackle', 'tackle.rollout');
    dummy(w, 30, 0);
    for (let i = 0; i < 7; i++) {
      slot.cooldownLeft = 0;
      run(w, DT);
    }
    expect(slot.mutState.stacks).toBe(v.maxStacks);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * v.damageMult * (1 + v.stackDamagePct * v.maxStacks));
    expect(slot.stats.reachMult).toBeCloseTo(1 + v.stackReachPct * v.maxStacks);
  });

  it('Bowling: Tackle staggers, and the knocked enemy hurts the one behind it', () => {
    const { w } = withMove('tackle', 'tackle.bowling');
    dummy(w, 30, 0);
    const behind = dummy(w, 58, 0);
    run(w, DT);
    expect(lost(behind)).toBeGreaterThan(0);
  });

  it('Bulb Bash: up to +80% damage with a full Bulb, −20% with an empty one', () => {
    const v = MUTATIONS['tackle.bulbBash'].values;
    const { w, slot } = withMove('tackle', 'tackle.bulbBash', 1);
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * v.emptyMult);
    w.player.bulb = bulbCapacity(w);
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * (1 + v.maxBonus));
  });
});

describe('Razor Leaf', () => {
  it('Leaf Spiral: the leaves fly out evenly around you, not at the target', () => {
    const { w } = withMove('razorLeaf', 'razorLeaf.spiral');
    dummy(w, 200, 0);
    run(w, DT);
    const [a, b] = w.projectiles;
    expect(a!.vx * b!.vx + a!.vy * b!.vy).toBeLessThan(0); // opposite directions
  });

  it('Embed: the leaf rips out for a second hit after 1.5 s', () => {
    const v = MUTATIONS['razorLeaf.embed'].values;
    const { w, slot } = withMove('razorLeaf', 'razorLeaf.embed');
    const e = dummy(w, 100, 0);
    run(w, 0.4);
    slot.cooldownLeft = 1e9;
    const first = lost(e);
    run(w, v.embedSeconds + 0.1);
    expect(lost(e)).toBeGreaterThan(first);
  });

  it('Healthy Growth: at full HP one more leaf that pierces; weaker when hurt', () => {
    const v = MUTATIONS['razorLeaf.healthyGrowth'].values;
    const { w, slot } = withMove('razorLeaf', 'razorLeaf.healthyGrowth');
    run(w, DT);
    expect(slot.stats.extraCount).toBe(v.extraLeaves);
    expect(slot.stats.pierce).toBe(v.pierce);
    w.player.hp -= 5;
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * v.damageMultHurt);
  });
});

describe('Leech Seed', () => {
  it('Spreading Seed: a Seeded enemy that faints passes its seed on, once', () => {
    const { w } = withMove('leechSeed', 'leechSeed.spread');
    const a = dummy(w, 100, 0);
    const b = dummy(w, 150, 0);
    a.seedDps = 5;
    a.seedLeft = 2;
    run(w, DT);
    damageEnemy(w, a, 1e9);
    expect(b.seedLeft).toBeGreaterThan(0);
    expect(b.seedJumped).toBe(true);
  });

  it('Seed Bomb: the seed bursts and Seeds everything around the impact', () => {
    const { w } = withMove('leechSeed', 'leechSeed.seedBomb');
    dummy(w, 120, 0);
    const near = dummy(w, 150, 0);
    run(w, 0.5);
    expect(near.seedLeft).toBeGreaterThan(0);
  });

  it('Seed Network: every Seeded enemy raises Leech (capped); seeds hit softer', () => {
    const v = MUTATIONS['leechSeed.seedNetwork'].values;
    const { w, slot } = withMove('leechSeed', 'leechSeed.seedNetwork');
    expect(slot.stats.seedPct).toBeCloseTo((MOVES.leechSeed.onHit?.seedPct ?? 0) * v.seedDamageMult);
    for (let i = 0; i < 20; i++) dummy(w, 300 + i * 30, 300).seedLeft = 5;
    run(w, DT);
    expect(slot.mutState.bonus).toBeCloseTo(v.maxLeechBonus);
  });
});

describe('Poison Powder', () => {
  const def = MOVES.poisonPowder as ZoneMoveDef;

  it('Drift Cloud: the cloud follows the nearest enemy', () => {
    const { w } = withMove('poisonPowder', 'poisonPowder.drift');
    const first = dummy(w, 150, 0);
    run(w, DT);
    const zone = w.zones.find((z) => z.source === 'poisonPowder')!;
    first.hp = 0; // the cloud's own target is gone; the next one is below it
    dummy(w, zone.x, zone.y + 200);
    const y0 = zone.y;
    run(w, 1);
    expect(zone.y).toBeGreaterThan(y0);
  });

  it('Toxic: poison stacks while the enemy stays in the cloud', () => {
    const v = MUTATIONS['poisonPowder.toxic'].values;
    const { w } = withMove('poisonPowder', 'poisonPowder.toxic');
    const e = dummy(w, 150, 0);
    run(w, def.duration * v.durationMult - 0.1);
    expect(e.poisonStacks).toBeGreaterThan(1);
  });

  it('Spore Sac: getting hit puffs a small poison cloud at your feet, at most once per 2 s', () => {
    const { w } = withMove('poisonPowder', 'poisonPowder.sporeSac');
    emit(w, 'hitTaken', 5);
    emit(w, 'hitTaken', 5);
    expect(w.zones.filter((z) => z.source === 'poisonPowder').length).toBe(1);
    expect(w.zones[0]!.x).toBe(w.player.x);
  });
});

describe('Sleep Powder', () => {
  it('Drowsy Haze: a big slowing cloud; sleep only after 1.5 s inside', () => {
    const v = MUTATIONS['sleepPowder.drowsy'].values;
    const { w } = withMove('sleepPowder', 'sleepPowder.drowsy');
    const e = dummy(w, 150, 0);
    run(w, 0.6);
    expect(e.stunLeft).toBe(0);
    expect(e.slow).toBeCloseTo(v.slow);
    run(w, v.sleepAfter);
    expect(e.stunKind).toBe('sleep');
  });

  it('Nightmare: sleeping enemies take +25% from everything', () => {
    const v = MUTATIONS['sleepPowder.nightmare'].values;
    const { w } = withMove('sleepPowder', 'sleepPowder.nightmare');
    const e = dummy(w, 400, 400);
    applyStatuses(e, { slow: 0, stun: 1, poisonDps: 0, stunKind: 'sleep' });
    w.moves[1]!.cooldownLeft = 1e9;
    run(w, DT);
    const other = dummy(w, -400, -400);
    damageEnemy(w, e, 10, makeHitInfo(createSlot('tackle').stats));
    damageEnemy(w, other, 10, makeHitInfo(createSlot('tackle').stats));
    expect(lost(e) / lost(other)).toBeCloseTo(1 + v.damageTakenPct);
  });

  it('Sweet Dreams: hits on sleeping enemies heal through Leech at ×3', () => {
    const { w } = withMove('sleepPowder', 'sleepPowder.sweetDreams');
    w.moves[1]!.cooldownLeft = 1e9;
    const awake = dummy(w, 400, 400);
    const asleep = dummy(w, -400, -400);
    applyStatuses(asleep, { slow: 0, stun: 5, poisonDps: 0, stunKind: 'sleep' });
    const hit = makeHitInfo(w.moves[0]!.stats, w.moves[0]!);
    w.player.hp = 10;
    damageEnemy(w, awake, 100, hit);
    const awakeHeal = w.player.hp - 10;
    w.player.hp = 10;
    damageEnemy(w, asleep, 100, hit);
    expect(w.player.hp - 10).toBeCloseTo(awakeHeal * 3);
  });
});

describe('Sludge', () => {
  it('Sludge Pool: the glob leaves a poison pool', () => {
    const { w } = withMove('sludge', 'sludge.pool');
    dummy(w, 120, 0);
    run(w, 0.5);
    expect(w.zones.some((z) => z.source === 'sludge' && z.poisonDps > 0)).toBe(true);
  });

  it('Acid: hit enemies take +15% from every source for 3 s', () => {
    const v = MUTATIONS['sludge.acid'].values;
    const { w } = withMove('sludge', 'sludge.acid');
    const e = dummy(w, 120, 0);
    run(w, 0.5);
    expect(e.vulnPct).toBeCloseTo(v.damageTakenPct);
    expect(e.vulnType).toBeNull();
  });

  it('Sludge Bomb: below 50% HP the glob splashes and poisons ×2; above it, −15%', () => {
    const v = MUTATIONS['sludge.sludgeBomb'].values;
    const { w, slot } = withMove('sludge', 'sludge.sludgeBomb');
    run(w, DT);
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * v.damageMultAbove);
    w.player.hp = w.player.maxHp * 0.3;
    dummy(w, 120, 0);
    const near = dummy(w, 150, 0);
    run(w, 0.5);
    expect(slot.stats.poisonPct).toBeCloseTo(slot.baseStats.poisonPct * v.poisonMult);
    expect(lost(near)).toBeGreaterThan(0);
  });
});

describe('Petal Dance', () => {
  const def = MOVES.petalDance as OrbitMoveDef;

  it('Frenzy Dance: spins faster over time, the petals fly out at the end; you move slower while dancing', () => {
    const v = MUTATIONS['petalDance.frenzy'].values;
    const { w, slot } = withMove('petalDance', 'petalDance.frenzy');
    run(w, DT);
    expect(mutationMoveSpeedMult(w)).toBeCloseTo(v.moveSpeedMult);
    run(w, 1.5);
    expect(slot.stats.spinMult).toBeGreaterThan(1.3);
    run(w, def.duration - v.flyOutSeconds - 1.4);
    expect(w.entities.filter((e) => e.owner === 'petalDance.frenzy').length).toBe(def.count);
    expect(slot.activeLeft).toBe(0);
  });

  it('Pollen Ring: petal hits heal, capped per second', () => {
    const v = MUTATIONS['petalDance.pollen'].values;
    const { w } = withMove('petalDance', 'petalDance.pollen');
    for (let i = 0; i < 8; i++) dummy(w, Math.cos(i) * 80, Math.sin(i) * 80);
    w.player.hp = 20;
    run(w, 1);
    expect(w.player.hp).toBeGreaterThan(20);
    expect(w.player.hp).toBeLessThanOrEqual(20 + v.maxHealPerSec * 2 + 5); // Leech heals too
  });

  it('Petal Blizzard: each Bloom sets the dance off with double petals', () => {
    const { w, slot } = withMove('petalDance', 'petalDance.petalBlizzard', 1);
    slot.cooldownLeft = 1e9;
    emit(w, 'bloom', 1);
    run(w, DT);
    expect(slot.activeLeft).toBeGreaterThan(0);
    expect(slot.stats.extraCount).toBe(def.count);
  });
});

describe('Solar Beam (Venusaur)', () => {
  const def = MOVES.solarBeam as BeamMoveDef;

  it('Full Charge: a telegraphed charge, then a wider, harder beam', () => {
    const v = MUTATIONS['solarBeam.fullCharge'].values;
    const { w, slot } = withMove('solarBeam', 'solarBeam.fullCharge', 2);
    const e = dummy(w, 200, 0);
    run(w, v.chargeSeconds - 0.1);
    expect(lost(e)).toBe(0);
    expect(w.entities.some((x) => x.owner === 'solarBeam.fullCharge')).toBe(true);
    run(w, 0.3);
    expect(lost(e)).toBeGreaterThan(0);
    expect(slot.stats.widthMult).toBeCloseTo(v.widthMult);
  });

  it('Prism: past the first enemy the beam fans into thinner beams', () => {
    const { w } = withMove('solarBeam', 'solarBeam.prism', 2);
    dummy(w, 100, 0);
    const off = dummy(w, 300, Math.tan(Math.PI / 12) * 200); // 15° off the line, behind the first
    run(w, def.duration);
    expect(lost(off)).toBeGreaterThan(0);
  });

  it('Ingrain: standing still roots you: faster recharge, −15% damage taken; moving costs 20%', () => {
    const v = MUTATIONS['solarBeam.ingrain'].values;
    const { w, slot } = withMove('solarBeam', 'solarBeam.ingrain', 2);
    run(w, v.stillSeconds + DT);
    expect(mutationDamageTakenMult(w)).toBeCloseTo(v.damageTakenMult);
    slot.cooldownLeft = 2;
    run(w, 0.5);
    expect(slot.cooldownLeft).toBeCloseTo(2 - 0.5 * v.cooldownRate, 1);
    run(w, DT, { moveX: 1, moveY: 0 });
    expect(slot.stats.damage).toBeCloseTo(slot.baseStats.damage * v.damageMultMoving);
  });
});
