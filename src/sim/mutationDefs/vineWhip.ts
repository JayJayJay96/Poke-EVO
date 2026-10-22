import { MOVES, type FieldDef, type MeleeMoveDef } from '../../data/moves';
import {
  MAX_ENEMY_RADIUS,
  applyNewStun,
  applySeed,
  applySlow,
  applyVuln,
  canTrap,
  damageEnemy,
  findNearestEnemy,
  procHit,
} from '../combat';
import { castMelee, tipBurstRadius } from '../forms/melee';
import { atFullHp, bulbCapacity, defineMutation, healPlayer } from '../hooks';
import type { Enemy, MoveSlot, World } from '../types';
import { spawnZone } from '../zones';
import { capEntities, entitiesOf, forEachEnemyIn, ranked, signatureTier, spawnEntity } from './util';

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

// ── A. Snare (D30, replaces Long Lash) ──────────────────────────────────
const snare = ranked('vineWhip.snare');

/**
 * Binds an enemy: a light one can't move or attack and takes more from Grass moves; a heavy one or a boss
 * is slowed instead. A whip bind at the Frenzy tier leaves a root patch when it ends (not a Bloom bind).
 */
function bind(world: World, slot: MoveSlot, enemy: Enemy, seconds: number, fromWhip: boolean): void {
  const v = snare(slot);
  if (!canTrap(enemy)) {
    applySlow(enemy, v.heavySlow, seconds);
    return;
  }
  if (!applyNewStun(enemy, seconds)) return;
  applyVuln(enemy, v.grassVulnPct, seconds, 'Grass');
  if (fromWhip && signatureTier(world, slot) >= 2) {
    spawnEntity(world, 'vineWhip.snare', enemy.x, enemy.y, seconds).hitIds.push(enemy.id);
  }
}

defineMutation('vineWhip.snare', {
  stats: (s, _world, slot) => {
    s.damage *= snare(slot).damageMult;
  },
  // The normal lash, then its tip binds the nearest enemies there; Power Whip's burst binds all it hits.
  cast: (world, slot) => {
    const def = MOVES[slot.moveId] as MeleeMoveDef;
    if (!castMelee(world, slot, def)) return false;
    const swing = world.swings[world.swings.length - 1]!;
    const v = snare(slot);
    const tipFrom = swing.reach * (1 - (def.tip?.fraction ?? 0));
    const cosHalf = Math.cos(swing.halfArc);
    const inTip: { e: Enemy; d: number }[] = [];
    forEachEnemyIn(world, swing.x, swing.y, swing.reach, (e) => {
      const d = Math.hypot(e.x - swing.x, e.y - swing.y);
      if (d >= tipFrom && ((e.x - swing.x) * swing.dirX + (e.y - swing.y) * swing.dirY) / d >= cosHalf) inTip.push({ e, d });
    });
    inTip.sort((a, b) => a.d - b.d);
    const bound = new Set<number>();
    for (const { e } of inTip.slice(0, v.maxBinds)) {
      bind(world, slot, e, v.bindSeconds, true);
      bound.add(e.id);
    }
    const burst = tipBurstRadius(slot, def);
    if (signatureTier(world, slot) >= 1 && burst > 0) {
      const bx = swing.x + swing.dirX * swing.reach;
      const by = swing.y + swing.dirY * swing.reach;
      forEachEnemyIn(world, bx, by, burst, (e) => {
        if (!bound.has(e.id)) bind(world, slot, e, v.tier1.burstBindSeconds, true);
      });
    }
    return true;
  },
  // Frenzy tier: a released enemy is left standing in a root patch.
  update: (world, slot, dt) => {
    for (const mark of entitiesOf(world, 'vineWhip.snare')) {
      mark.lifeLeft -= dt;
      if (mark.lifeLeft > 0) continue;
      const enemy = world.enemies.find((e) => e.id === mark.hitIds[0] && e.hp > 0);
      if (enemy) rootField(world, slot, enemy.x, enemy.y, FRENZY_FIELD, snare(slot).tier2.rootPatchSizeMult);
    }
  },
  // Bulb link: a Bloom binds everything close.
  onEvent: (world, slot, event) => {
    if (event !== 'bloom') return;
    const v = snare(slot);
    forEachEnemyIn(world, world.player.x, world.player.y, v.bloomBindRadius, (e) => bind(world, slot, e, v.bloomBindSeconds, false));
  },
});

// ── B. Thorn Garden ─────────────────────────────────────────────────────
const garden = ranked('vineWhip.thornGarden');

function sproutLash(world: World, slot: MoveSlot, x: number, y: number, damage: number): void {
  const hit = procHit(slot.stats.attackType);
  const v = garden(slot);
  if (signatureTier(world, slot) >= 1) {
    forEachEnemyIn(world, x, y, v.sproutRadius, (e) => {
      damageEnemy(world, e, damage, hit);
      applySlow(e, v.tier1.sproutSlow, v.lashInterval);
    });
  } else {
    const target = findNearestEnemy(world, v.sproutRadius, x, y);
    if (target) damageEnemy(world, target, damage, hit);
  }
}

defineMutation('vineWhip.thornGarden', {
  stats: (s, _world, slot) => {
    s.damage *= garden(slot).damageMult;
  },
  // Each swing plants a sprout at its target.
  onCast: (world, slot) => {
    const def = MOVES[slot.moveId] as MeleeMoveDef;
    const reach = def.reach * slot.stats.area * slot.stats.reachMult;
    const target = findNearestEnemy(world, reach + MAX_ENEMY_RADIUS);
    if (!target) return;
    const v = garden(slot);
    const sprout = spawnEntity(world, 'vineWhip.thornGarden', target.x, target.y, v.sproutSeconds);
    sprout.radius = v.sproutRadius;
    sprout.timer = v.lashInterval;
    // Sprouts lash for a fraction of the whip before its −30% cost.
    sprout.damage = (slot.stats.damage / v.damageMult) * v.lashDamageFraction;
    capEntities(world, 'vineWhip.thornGarden', v.maxSprouts);
  },
  update: (world, slot, dt) => {
    const v = garden(slot);
    for (const sprout of entitiesOf(world, 'vineWhip.thornGarden')) {
      sprout.lifeLeft -= dt;
      sprout.timer -= dt;
      if (sprout.timer <= 0) {
        sprout.timer += v.lashInterval;
        sproutLash(world, slot, sprout.x, sprout.y, sprout.damage);
      }
      // Frenzy tier: an expiring sprout becomes a root field.
      if (sprout.lifeLeft <= 0 && signatureTier(world, slot) >= 2 && v.tier2.expiringRootField) {
        rootField(world, slot, sprout.x, sprout.y, FRENZY_FIELD, 1);
      }
    }
  },
  // Bulb link: a Bloom makes every sprout lash at once, harder.
  onEvent: (world, slot, event) => {
    if (event !== 'bloom') return;
    for (const sprout of entitiesOf(world, 'vineWhip.thornGarden')) {
      sproutLash(world, slot, sprout.x, sprout.y, sprout.damage * garden(slot).bloomLashMult);
    }
  },
});

// ── C. Sap Lash ─────────────────────────────────────────────────────────
const sap = ranked('vineWhip.sapLash');
const SEED_PCT = MOVES.leechSeed.onHit?.seedPct ?? 0;

defineMutation('vineWhip.sapLash', {
  stats: (s, _world, slot) => {
    s.damage *= sap(slot).damageMult;
  },
  onHit: (world, slot, enemy, dealt) => {
    const v = sap(slot);
    if ((slot.mutState.heals ?? 0) < v.maxHealPerSwing) {
      slot.mutState.heals = (slot.mutState.heals ?? 0) + 1;
      const hurt = !atFullHp(world);
      healPlayer(world, v.healPerHit);
      // Bulb link: Sap heals fill the Bulb even while hurt, at half rate.
      const cap = bulbCapacity(world);
      if (hurt && cap > 0) world.player.bulb = Math.min(cap, world.player.bulb + v.healPerHit * v.bulbFillRateHurt);
    }
    // Power Whip tier: hit enemies are Seeded.
    if (signatureTier(world, slot) >= 1 && enemy.hp > 0) {
      applySeed(enemy, dealt * SEED_PCT * v.tier1.seedStrength, v.tier1.seedSeconds);
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
        healPlayer(world, sap(slot).tier2.rootHealPerSec * dt);
        break;
      }
    }
  },
});
