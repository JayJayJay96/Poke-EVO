import { TUNING } from '../../data/content';
import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { addCharge } from '../abilities';
import { applyNewStun, damageEnemy, findNearestEnemy, makeHitInfo, procHit } from '../combat';
import { ARC_SECONDS, castProjectile } from '../forms/projectile';
import { chargeLevel, defineMutation } from '../hooks';
import type { Enemy, MoveSlot, World } from '../types';
import { dirTo, entitiesOf, forEachEnemyOnSegment, signatureTier, spawnEntity } from './util';

// Pikachu signature Mutations: Thunder Shock → Thunderbolt (docs/moveset/pikachu §4).
// Each has a Charge link and keeps its Thunder Shock part at Raichu (rule 10). Chain cap stays 3.

// ── A. Live Wire ────────────────────────────────────────────────────────
const wire = MUTATIONS['thunderShock.liveWire'].values;

defineMutation('thunderShock.liveWire', {
  cast: (world, slot) => {
    const before = world.projectiles.length;
    if (!castProjectile(world, slot, MOVES[slot.moveId] as ProjectileMoveDef)) return false;
    for (const p of world.projectiles.slice(before)) p.chainFraction *= wire.jumpDamageMult;
    return true;
  },
  // Every jump leaves a live wire between the two enemies.
  onChainJump: (world, slot, from, to) => {
    const tier = signatureTier(world, slot);
    const charged = chargeLevel(world) > wire.chargeThreshold ? wire.chargeWireMult : 1;
    const seconds = (tier >= 1 ? wire.tier1.wireSeconds : wire.wireSeconds) * charged;
    const w = spawnEntity(world, 'thunderShock.liveWire', from.x, from.y, seconds);
    w.x2 = to.x;
    w.y2 = to.y;
    w.damage = slot.stats.damage * wire.wireDamageFraction;
  },
  update: (world, slot, dt) => {
    const paralyse = signatureTier(world, slot) >= 1 ? wire.tier1.paralyseSeconds : 0;
    for (const w of entitiesOf(world, 'thunderShock.liveWire')) {
      w.lifeLeft -= dt;
      w.timer -= dt;
      if (w.timer > 0) continue;
      w.timer += wire.wireTickInterval;
      const hit = procHit('Electric');
      // Each wire hits an enemy once, as it crosses.
      forEachEnemyOnSegment(world, w.x, w.y, w.x2, w.y2, wire.wireWidth, (e) => {
        if (w.hitIds.includes(e.id)) return;
        w.hitIds.push(e.id);
        damageEnemy(world, e, w.damage, hit);
        if (paralyse > 0) applyNewStun(e, paralyse, 'paralysis');
      });
    }
  },
});

// ── B. Ball Lightning ───────────────────────────────────────────────────
const ball = MUTATIONS['thunderShock.ballLightning'].values;

/** Thunderbolt tier: the orb pops into the move's full chain from where it ends. */
function chainFrom(world: World, slot: MoveSlot, x: number, y: number): void {
  const def = MOVES[slot.moveId] as ProjectileMoveDef;
  const first = findNearestEnemy(world, TUNING.chain.range, x, y);
  if (!first) return;
  const hit = makeHitInfo(slot.stats, slot);
  damageEnemy(world, first, slot.stats.damage, hit);
  world.arcs.push({ x1: x, y1: y, x2: first.x, y2: first.y, lifeLeft: ARC_SECONDS });
  const hitIds = [first.id];
  let current: Enemy = first;
  for (let jump = 0; jump < (def.chain?.jumps ?? 0); jump++) {
    let next: Enemy | undefined;
    let best = TUNING.chain.range * TUNING.chain.range;
    for (const e of world.enemies) {
      if (e.hp <= 0 || hitIds.includes(e.id)) continue;
      const d2 = (e.x - current.x) ** 2 + (e.y - current.y) ** 2;
      if (d2 <= best) {
        best = d2;
        next = e;
      }
    }
    if (!next) break;
    world.arcs.push({ x1: current.x, y1: current.y, x2: next.x, y2: next.y, lifeLeft: ARC_SECONDS });
    damageEnemy(world, next, slot.stats.damage * (def.chain?.damageFraction ?? 0), hit);
    hitIds.push(next.id);
    current = next;
  }
}

defineMutation('thunderShock.ballLightning', {
  // The bolt becomes a slow orb that zaps the nearest enemy as it rolls. No chain on Thunder Shock.
  cast: (world, slot) => {
    const def = MOVES[slot.moveId] as ProjectileMoveDef;
    const target = findNearestEnemy(world, def.range);
    if (!target) return false;
    const { x, y } = world.player;
    const boost = 1 + ball.chargeMaxBonus * chargeLevel(world);
    const [dx, dy] = dirTo(x, y, target.x, target.y);
    const orb = spawnEntity(world, 'thunderShock.ballLightning', x, y, ball.orbSeconds * slot.stats.duration);
    orb.vx = dx * ball.orbSpeed * boost;
    orb.vy = dy * ball.orbSpeed * boost;
    orb.radius = ball.zapRadius;
    orb.damage = slot.stats.damage * ball.zapDamageFraction;
    return true;
  },
  update: (world, slot, dt) => {
    const boost = 1 + ball.chargeMaxBonus * chargeLevel(world);
    for (const orb of entitiesOf(world, 'thunderShock.ballLightning')) {
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.timer -= dt;
      if (orb.timer <= 0) {
        orb.timer += ball.zapInterval / boost;
        const target = findNearestEnemy(world, orb.radius, orb.x, orb.y);
        if (target) {
          damageEnemy(world, target, orb.damage, makeHitInfo(slot.stats, slot));
          world.arcs.push({ x1: orb.x, y1: orb.y, x2: target.x, y2: target.y, lifeLeft: ARC_SECONDS });
        }
      }
      orb.lifeLeft -= dt;
      if (orb.lifeLeft <= 0 && signatureTier(world, slot) >= 1 && ball.tier1.endChain) chainFrom(world, slot, orb.x, orb.y);
    }
  },
});

// ── C. Return Arc ───────────────────────────────────────────────────────
const ret = MUTATIONS['thunderShock.returnArc'].values;

defineMutation('thunderShock.returnArc', {
  stats: (s) => {
    s.damage *= ret.damageMult;
  },
  onChainJump: (world) => {
    addCharge(world, ret.chargePerJump);
  },
  // The chain's last jump arcs back to you; at Thunderbolt it hurts everything on the way.
  onChainEnd: (world, slot, last) => {
    const { player } = world;
    world.arcs.push({ x1: last.x, y1: last.y, x2: player.x, y2: player.y, lifeLeft: ARC_SECONDS });
    if (signatureTier(world, slot) < 1) return;
    const hit = procHit('Electric');
    const damage = slot.stats.damage * ret.tier1.returnLineFraction;
    forEachEnemyOnSegment(world, last.x, last.y, player.x, player.y, ret.tier1.returnLineWidth, (e) => {
      if (e !== last) damageEnemy(world, e, damage, hit);
    });
  },
});
