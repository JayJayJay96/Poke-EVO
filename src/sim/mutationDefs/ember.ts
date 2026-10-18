import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { MUTATIONS, MUTATION_TUNING } from '../../data/mutations';
import { findNearestEnemy } from '../combat';
import { castProjectile } from '../forms/projectile';
import { blazeActive, defineMutation } from '../hooks';
import { spawnScorch } from '../terrain';
import type { MoveSlot, Projectile, World } from '../types';
import { spawnZone, strikeZone } from '../zones';
import { dirTo, entitiesOf, signatureTier, spawnEntity } from './util';

// Charmander signature Mutations: Ember → Flame Burst → Blast Burn (docs/moveset/charmander §3).
// Each has a Blaze link (a bonus while Blaze is active) and keeps its earlier tiers (rule 10).

const KINDLED = 1;

/** Fires the move with temporarily scaled damage / size; returns the projectiles it launched. */
function fireScaled(
  world: World,
  slot: MoveSlot,
  def: ProjectileMoveDef,
  damageMult: number,
  areaMult: number,
): Projectile[] | null {
  const s = slot.stats;
  const before = world.projectiles.length;
  s.damage *= damageMult;
  s.area *= areaMult;
  const cast = castProjectile(world, slot, def);
  s.damage /= damageMult;
  s.area /= areaMult;
  return cast ? world.projectiles.slice(before) : null;
}

// ── A. Kindle ───────────────────────────────────────────────────────────
const kindle = MUTATIONS['ember.kindle'].values;

/** Blast Burn tier: the Kindled shot is a meteor: a telegraphed circle, then a big crater. */
function meteor(world: World, slot: MoveSlot, def: ProjectileMoveDef): boolean {
  const target = findNearestEnemy(world, def.range);
  if (!target) return false;
  const s = slot.stats;
  const damage = s.damage * kindle.kindledMult;
  const radius = (def.explosion?.radius ?? def.projectileRadius) * s.area * s.blastRadiusMult * kindle.kindledSizeMult;
  const delay = kindle.tier2.meteorTelegraph;
  // One tick, after the telegraph: the impact.
  strikeZone(world, target.x, target.y, radius, delay, damage, s.critChance, {
    slow: 0,
    stun: 0,
    poisonDps: 0,
    attackType: s.attackType,
  });
  const landing = spawnEntity(world, 'ember.kindle', target.x, target.y, delay);
  landing.damage = damage;
  return true;
}

defineMutation('ember.kindle', {
  cast: (world, slot) => {
    const def = MOVES[slot.moveId] as ProjectileMoveDef;
    const shot = (slot.mutState.shots ?? 0) + 1;
    const every = blazeActive(world) ? kindle.everyNBlaze : kindle.everyN;
    const kindled = shot % every === 0;
    if (kindled && signatureTier(world, slot) >= 2) {
      if (!meteor(world, slot, def)) return false;
      slot.mutState.shots = shot;
      return true;
    }
    const fired = kindled
      ? fireScaled(world, slot, def, kindle.kindledMult, kindle.kindledSizeMult)
      : fireScaled(world, slot, def, kindle.otherMult, 1);
    if (!fired) return false;
    slot.mutState.shots = shot;
    if (kindled) for (const p of fired) p.tag = KINDLED;
    return true;
  },
  // Flame Burst tier: a Kindled explosion leaves a ring of Scorch.
  onProjectileHit: (world, slot, proj) => {
    if (proj.tag !== KINDLED || signatureTier(world, slot) < 1) return;
    const n = kindle.tier1.scorchRingPatches;
    const r = Math.max(proj.explodeRadius, MUTATION_TUNING.scorch.radius) * 0.6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      spawnScorch(world, proj.x + Math.cos(a) * r, proj.y + Math.sin(a) * r, proj.damage);
    }
  },
  // The meteor's crater appears when it lands.
  update: (world, slot, dt) => {
    const def = MOVES[slot.moveId] as ProjectileMoveDef;
    for (const landing of entitiesOf(world, 'ember.kindle')) {
      landing.lifeLeft -= dt;
      if (landing.lifeLeft > 0 || !def.crater) continue;
      const s = slot.stats;
      spawnZone(
        world,
        landing.x,
        landing.y,
        def.crater.radius * s.area * s.blastRadiusMult * kindle.tier2.craterSizeMult,
        def.crater.duration * s.duration * s.zoneDurationMult,
        def.crater.tickInterval,
        landing.damage * def.crater.damageFraction * s.zoneDamageMult,
        s.critChance,
        { slow: def.crater.slow ?? 0, stun: 0, poisonDps: 0, attackType: s.attackType },
      );
    }
  },
});

// ── B. Flamethrower ─────────────────────────────────────────────────────
const flame = MUTATIONS['ember.flamethrower'].values;

defineMutation('ember.flamethrower', {
  stats: (s, world, slot) => {
    if (signatureTier(world, slot) >= 1) s.burnPct += flame.tier1.burnPct;
  },
  cast: (world, slot) => {
    const def = MOVES[slot.moveId] as ProjectileMoveDef;
    const reach = flame.reach * slot.stats.reachMult * (blazeActive(world) ? flame.blazeReachMult : 1);
    const target = findNearestEnemy(world, reach);
    if (!target) return false;
    // A short stream: the flames live just long enough to cover the cone's reach.
    const stream: ProjectileMoveDef = {
      ...def,
      range: reach,
      count: flame.flames,
      projectileLifetime: reach / (def.projectileSpeed * slot.stats.speedMult * slot.stats.duration),
    };
    const fired = fireScaled(world, slot, stream, flame.flameDamageFraction, 1);
    if (!fired) return false;
    // Fan the flames evenly across the cone; only the first keeps a crater.
    const { x, y } = world.player;
    const [bx, by] = dirTo(x, y, target.x, target.y);
    const base = Math.atan2(by, bx);
    const cone = (flame.coneDeg * Math.PI) / 180;
    fired.forEach((p, i) => {
      const a = base + (fired.length > 1 ? (i / (fired.length - 1) - 0.5) * cone : 0);
      p.vx = Math.cos(a) * p.speed;
      p.vy = Math.sin(a) * p.speed;
      if (i > 0) p.craterRadius = 0;
    });
    // Blast Burn tier: a line of Scorch across the end of the cone.
    if (signatureTier(world, slot) >= 2 && flame.tier2.scorchLine) {
      const r = MUTATION_TUNING.scorch.radius;
      for (const k of [-1, 0, 1]) {
        spawnScorch(world, x + bx * reach - by * k * r * 2, y + by * reach + bx * k * r * 2, slot.stats.damage * flame.flameDamageFraction);
      }
    }
    return true;
  },
});

// ── C. Will-o-Wisp ──────────────────────────────────────────────────────
const wisp = MUTATIONS['ember.wisp'].values;

/** Wisps orbiting the player (for drawing). */
export function wispCount(slot: MoveSlot): number {
  return slot.mutation === 'ember.wisp' ? (slot.mutState.wisps ?? 0) : 0;
}

defineMutation('ember.wisp', {
  // Ember stops firing on its own: each cast adds a wisp instead.
  cast: (world, slot) => {
    const max = blazeActive(world) ? wisp.maxWispsBlaze : wisp.maxWisps;
    slot.mutState.wisps = Math.min(max, (slot.mutState.wisps ?? 0) + 1);
    return true;
  },
  update: (world, slot, dt) => {
    slot.mutState.launchCd = Math.max(0, (slot.mutState.launchCd ?? 0) - dt);
    if (!slot.mutState.wisps || slot.mutState.launchCd > 0) return;
    const def = MOVES[slot.moveId] as ProjectileMoveDef;
    const launch: ProjectileMoveDef = { ...def, range: wisp.triggerRadius, count: 1 };
    const fired = fireScaled(world, slot, launch, wisp.damageMult, 1);
    if (!fired) return;
    slot.mutState.wisps--;
    slot.mutState.launchCd = wisp.launchInterval;
    // Blast Burn tier: a small crater (Flame Burst tier's splash comes with the move).
    if (signatureTier(world, slot) >= 2) for (const p of fired) p.craterRadius *= wisp.tier2.craterSizeMult;
  },
});
