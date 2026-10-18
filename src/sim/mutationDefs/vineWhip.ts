import { MOVES, type FieldDef, type MeleeMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { MAX_ENEMY_RADIUS, applySeed, applySlow, damageEnemy, findNearestEnemy, makeHitInfo, procHit } from '../combat';
import { SWING_SECONDS } from '../forms/melee';
import { atFullHp, bulbCapacity, defineMutation, healPlayer } from '../hooks';
import type { MoveSlot, World } from '../types';
import { spawnZone } from '../zones';
import { capEntities, dirTo, entitiesOf, forEachEnemyIn, signatureTier, spawnEntity } from './util';

// Bulbasaur signature Mutations: Vine Whip → Power Whip → Frenzy Plant (docs/moveset/bulbasaur §4).
// Each has a Bulb link from Ivysaur on and keeps its earlier tiers (rule 10).

const FRENZY_FIELD = (MOVES.frenzyPlant as MeleeMoveDef).field!;

/** A root field like Frenzy Plant's (Sap Lash heals inside these), scaled by `sizeMult`. */
function rootField(world: World, slot: MoveSlot, x: number, y: number, field: FieldDef, sizeMult: number): void {
  const s = slot.stats;
  spawnZone(
    world,
    x,
    y,
    field.radius * s.area * s.blastRadiusMult * sizeMult,
    field.duration * s.duration * s.zoneDurationMult,
    field.tickInterval,
    s.damage * field.damageFraction * s.zoneDamageMult,
    s.critChance,
    { slow: field.onTick?.slow ?? 0, stun: 0, poisonDps: 0, attackType: s.attackType },
    'frenzyPlant',
  );
}

// ── A. Long Lash ────────────────────────────────────────────────────────
const lash = MUTATIONS['vineWhip.longLash'].values;

/**
 * One lash: the tip always crits, enemies close to you take less; Frenzy tier sprouts a root field.
 * The free sweep from a Bloom is a proc (rule 5): plain damage, full circle, no fields.
 */
function longLash(world: World, slot: MoveSlot, fromBloom: boolean): boolean {
  const def = MOVES[slot.moveId] as MeleeMoveDef;
  const { player } = world;
  const reach = def.reach * slot.stats.area * slot.stats.reachMult * lash.reachMult;
  const target = findNearestEnemy(world, reach + MAX_ENEMY_RADIUS);
  if (!target) return false;
  const tier = signatureTier(world, slot);
  const halfArc = fromBloom || tier >= 1 ? Math.PI : (lash.arcDeg * Math.PI) / 360;
  const [dirX, dirY] = dirTo(player.x, player.y, target.x, target.y);
  const hit = fromBloom ? procHit(slot.stats.attackType) : makeHitInfo(slot.stats, slot);
  let sprouted = fromBloom;
  forEachEnemyIn(world, player.x, player.y, reach, (e) => {
    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    const inArc =
      halfArc >= Math.PI || dist <= e.radius || ((e.x - player.x) * dirX + (e.y - player.y) * dirY) / dist >= Math.cos(halfArc);
    if (!inArc) return;
    const tip = dist >= reach * (1 - lash.tipFraction);
    const close = dist < reach * lash.closeFraction;
    [hit.dirX, hit.dirY] = dirTo(player.x, player.y, e.x, e.y);
    damageEnemy(world, e, slot.stats.damage * (tip ? lash.tipCritMult : close ? lash.closeMult : 1), hit);
    if (tip && tier >= 2 && !sprouted) {
      rootField(world, slot, e.x, e.y, FRENZY_FIELD, lash.tier2.rootFieldSizeMult);
      sprouted = true;
    }
  });
  world.swings.push({ x: player.x, y: player.y, dirX, dirY, reach, halfArc, lifeLeft: SWING_SECONDS });
  // The move's own field (Frenzy Plant) stays part of the swing.
  if (def.field && !fromBloom) rootField(world, slot, target.x, target.y, def.field, 1);
  return true;
}

defineMutation('vineWhip.longLash', {
  cast: (world, slot) => longLash(world, slot, false),
  // Bulb link: each Bloom cracks a free 360° tip sweep.
  onEvent: (world, slot, event) => {
    if (event === 'bloom') longLash(world, slot, true);
  },
});

// ── B. Thorn Garden ─────────────────────────────────────────────────────
const garden = MUTATIONS['vineWhip.thornGarden'].values;

function sproutLash(world: World, slot: MoveSlot, x: number, y: number, damage: number): void {
  const hit = procHit(slot.stats.attackType);
  if (signatureTier(world, slot) >= 1) {
    forEachEnemyIn(world, x, y, garden.sproutRadius, (e) => {
      damageEnemy(world, e, damage, hit);
      applySlow(e, garden.tier1.sproutSlow, garden.lashInterval);
    });
  } else {
    const target = findNearestEnemy(world, garden.sproutRadius, x, y);
    if (target) damageEnemy(world, target, damage, hit);
  }
}

defineMutation('vineWhip.thornGarden', {
  stats: (s) => {
    s.damage *= garden.damageMult;
  },
  // Each swing plants a sprout at its target.
  onCast: (world, slot) => {
    const def = MOVES[slot.moveId] as MeleeMoveDef;
    const reach = def.reach * slot.stats.area * slot.stats.reachMult;
    const target = findNearestEnemy(world, reach + MAX_ENEMY_RADIUS);
    if (!target) return;
    const sprout = spawnEntity(world, 'vineWhip.thornGarden', target.x, target.y, garden.sproutSeconds);
    sprout.radius = garden.sproutRadius;
    sprout.timer = garden.lashInterval;
    // Sprouts lash for a fraction of the whip before its −30% cost.
    sprout.damage = (slot.stats.damage / garden.damageMult) * garden.lashDamageFraction;
    capEntities(world, 'vineWhip.thornGarden', garden.maxSprouts);
  },
  update: (world, slot, dt) => {
    for (const sprout of entitiesOf(world, 'vineWhip.thornGarden')) {
      sprout.lifeLeft -= dt;
      sprout.timer -= dt;
      if (sprout.timer <= 0) {
        sprout.timer += garden.lashInterval;
        sproutLash(world, slot, sprout.x, sprout.y, sprout.damage);
      }
      // Frenzy tier: an expiring sprout becomes a root field.
      if (sprout.lifeLeft <= 0 && signatureTier(world, slot) >= 2 && garden.tier2.expiringRootField) {
        rootField(world, slot, sprout.x, sprout.y, FRENZY_FIELD, 1);
      }
    }
  },
  // Bulb link: a Bloom makes every sprout lash at once, harder.
  onEvent: (world, slot, event) => {
    if (event !== 'bloom') return;
    for (const sprout of entitiesOf(world, 'vineWhip.thornGarden')) {
      sproutLash(world, slot, sprout.x, sprout.y, sprout.damage * garden.bloomLashMult);
    }
  },
});

// ── C. Sap Lash ─────────────────────────────────────────────────────────
const sap = MUTATIONS['vineWhip.sapLash'].values;
const SEED_PCT = MOVES.leechSeed.onHit?.seedPct ?? 0;

defineMutation('vineWhip.sapLash', {
  stats: (s) => {
    s.damage *= sap.damageMult;
  },
  onHit: (world, slot, enemy, dealt) => {
    if ((slot.mutState.heals ?? 0) < sap.maxHealPerSwing) {
      slot.mutState.heals = (slot.mutState.heals ?? 0) + 1;
      const hurt = !atFullHp(world);
      healPlayer(world, sap.healPerHit);
      // Bulb link: Sap heals fill the Bulb even while hurt, at half rate.
      const cap = bulbCapacity(world);
      if (hurt && cap > 0) world.player.bulb = Math.min(cap, world.player.bulb + sap.healPerHit * sap.bulbFillRateHurt);
    }
    // Power Whip tier: hit enemies are Seeded.
    if (signatureTier(world, slot) >= 1 && enemy.hp > 0) {
      applySeed(enemy, dealt * SEED_PCT * sap.tier1.seedStrength, sap.tier1.seedSeconds);
    }
  },
  update: (world, slot, dt) => {
    slot.mutState.heals = 0; // one swing per step at most
    // Frenzy tier: standing in your own root field heals.
    if (signatureTier(world, slot) < 2) return;
    const { player } = world;
    for (const zone of world.zones) {
      if (zone.source !== 'frenzyPlant' || zone.lifeLeft <= 0) continue;
      if ((player.x - zone.x) ** 2 + (player.y - zone.y) ** 2 <= zone.radius * zone.radius) {
        healPlayer(world, sap.tier2.rootHealPerSec * dt);
        break;
      }
    }
  },
});
