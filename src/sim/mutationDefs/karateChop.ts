import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { damageEnemy, findNearestEnemy, procHit } from '../combat';
import { ARC_SECONDS, BLAST_SECONDS } from '../forms/projectile';
import { defineMutation } from '../hooks';
import { rageLevel } from '../rage';
import type { MoveSlot, World } from '../types';
import { entitiesOf, fireScaled, forEachEnemyIn, forEachEnemyOnSegment, ranked, signatureTier, spawnEntity } from './util';

// Mankey signature Mutations: Karate Chop → Cross Chop → Rage Fist (docs/moveset/mankey §3, D56).
// Each keeps its earlier tiers (rule 10). Everything they add beside the move's own hits is a proc.

/** Extra Rage Fist fists: copies, so they trigger nothing (rule 5). */
function extraFists(world: World, slot: MoveSlot, count: number): void {
  const def = MOVES[slot.moveId];
  if (def.form !== 'projectile') return;
  for (let i = 0; i < count; i++) for (const p of fireScaled(world, slot, def as ProjectileMoveDef, 1, 1) ?? []) p.hit.fromProc = true;
}

// ── A. Combo Chain ──────────────────────────────────────────────────────
const combo = ranked('karateChop.combo');

function stacks(world: World, slot: MoveSlot): number {
  return world.time - (slot.mutState.lastHit ?? -1e9) > combo(slot).stackWindow ? 0 : (slot.mutState.stacks ?? 0);
}

defineMutation('karateChop.combo', {
  stats: (s, _world, slot) => {
    s.damage *= combo(slot).damageMult;
  },
  damageMult: (world, slot) => 1 + combo(slot).stackPct * stacks(world, slot),
  onHit: (world, slot) => {
    slot.mutState.stacks = Math.min(combo(slot).maxStacks, stacks(world, slot) + 1);
    slot.mutState.lastHit = world.time;
  },
  // A full combo bursts (Cross Chop+) and, at Rage Fist, throws extra fists; then it starts over.
  onCast: (world, slot) => {
    const v = combo(slot);
    const tier = signatureTier(world, slot);
    if (tier < 1 || stacks(world, slot) < v.maxStacks) return;
    slot.mutState.stacks = 0;
    const { x, y } = world.player;
    const radius = v.tier1.shockRadius * slot.stats.area;
    const hit = procHit(slot.stats.attackType);
    forEachEnemyIn(world, x, y, radius, (e) => damageEnemy(world, e, slot.stats.damage * v.tier1.shockFraction, hit));
    world.blasts.push({ x, y, radius, lifeLeft: BLAST_SECONDS * 2, type: 'Fighting' });
    if (tier >= 2) extraFists(world, slot, v.tier2.extraFists);
  },
});

// ── B. Vacuum Chop ──────────────────────────────────────────────────────
const vacuum = ranked('karateChop.vacuum');

defineMutation('karateChop.vacuum', {
  stats: (s, _world, slot) => {
    s.damage *= vacuum(slot).damageMult;
  },
  onCast: (world, slot) => {
    const v = vacuum(slot);
    const tier = signatureTier(world, slot);
    const length = v.waveLength * slot.stats.area;
    const { x, y } = world.player;
    const target = findNearestEnemy(world, length + 60);
    if (!target) return;
    const base = Math.atan2(target.y - y, target.x - x);
    const spread = (v.tier1.xWaveDeg * Math.PI) / 180;
    const angles = tier >= 1 ? [0, spread, -spread] : [0];
    const hit = procHit(slot.stats.attackType);
    const damage = slot.stats.damage * v.waveFraction;
    const struck = new Set<number>();
    for (const da of angles) {
      const x2 = x + Math.cos(base + da) * length;
      const y2 = y + Math.sin(base + da) * length;
      forEachEnemyOnSegment(world, x, y, x2, y2, v.waveWidth, (e) => {
        if (struck.has(e.id)) return;
        struck.add(e.id);
        damageEnemy(world, e, damage, hit);
      });
      world.arcs.push({ x1: x, y1: y, x2, y2, lifeLeft: ARC_SECONDS });
    }
    if (tier >= 2) {
      const trail = spawnEntity(world, 'karateChop.vacuum', x, y, v.tier2.trailSeconds);
      trail.x2 = x + Math.cos(base) * length;
      trail.y2 = y + Math.sin(base) * length;
      trail.damage = slot.stats.damage * v.tier2.trailFraction;
    }
  },
  update: (world, slot, dt) => {
    const v = vacuum(slot);
    const hit = procHit(slot.stats.attackType);
    for (const trail of entitiesOf(world, 'karateChop.vacuum')) {
      trail.lifeLeft -= dt;
      trail.timer -= dt;
      if (trail.timer > 0) continue;
      trail.timer += v.tier2.trailTick;
      forEachEnemyOnSegment(world, trail.x, trail.y, trail.x2, trail.y2, v.waveWidth, (e) => damageEnemy(world, e, trail.damage, hit));
      world.arcs.push({ x1: trail.x, y1: trail.y, x2: trail.x2, y2: trail.y2, lifeLeft: ARC_SECONDS });
    }
  },
});

// ── C. Rage Release (Rage level) ────────────────────────────────────────
const release = ranked('karateChop.rageRelease');

defineMutation('karateChop.rageRelease', {
  damageMult: (world, slot) => 1 + release(slot).perRage * world.player.rage,
  rageDrainMult: (_world, slot) => release(slot).drainMult,
  forceCrit: (world, slot) => release(slot).tier1.fullRageCrit && signatureTier(world, slot) >= 1 && rageLevel(world) >= 1,
  live: (s, world, slot) => {
    if (signatureTier(world, slot) >= 2) s.blastRadiusMult *= 1 + (release(slot).tier2.maxBlastMult - 1) * rageLevel(world);
  },
});
