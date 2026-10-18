import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { applyNewStun, canTrap, findNearestEnemy } from '../combat';
import { BLAST_SECONDS, castProjectile } from '../forms/projectile';
import { defineMutation } from '../hooks';
import type { MoveSlot, World } from '../types';
import { spawnZone, strikeZone } from '../zones';
import { dirTo, forEachEnemyIn, nearestEnemies, signatureTier } from './util';

// Lapras signature Mutations: Ice Shard → (Lv 25) Sheer Cold (docs/moveset/lapras §5).
// A strong first tier and a modest Sheer Cold step (the opposite of the 3-stage lines).

const SHEER_COLD = (MOVES.sheerCold as ProjectileMoveDef).crater!;

/** A Sheer Cold-style freezing field, `sizeMult` of the real one, starting after `delay`. */
function freezingField(world: World, slot: MoveSlot, x: number, y: number, sizeMult: number, seconds: number, delay = 0): void {
  const s = slot.stats;
  const zone = spawnZone(
    world,
    x,
    y,
    SHEER_COLD.radius * s.area * s.blastRadiusMult * sizeMult,
    seconds * s.duration * s.zoneDurationMult + delay,
    SHEER_COLD.tickInterval,
    s.damage * SHEER_COLD.damageFraction * s.zoneDamageMult,
    s.critChance,
    { slow: SHEER_COLD.slow ?? 0, stun: 0, poisonDps: 0, attackType: s.attackType },
  );
  if (zone) zone.tickLeft += delay;
}

// ── A. Hail ─────────────────────────────────────────────────────────────
const hail = MUTATIONS['iceShard.hail'].values;

defineMutation('iceShard.hail', {
  // No travel: shards fall on the nearest enemies after a short shadow.
  cast: (world, slot) => {
    const { x, y } = world.player;
    const targets = nearestEnemies(world, x, y, hail.range, hail.targets);
    if (targets.length === 0) return false;
    const s = slot.stats;
    const tier = signatureTier(world, slot);
    for (const t of targets) {
      strikeZone(world, t.x, t.y, hail.impactRadius * s.area, hail.shadowSeconds, s.damage * hail.damageFraction, s.critChance, {
        slow: s.slow,
        stun: 0,
        poisonDps: 0,
        attackType: s.attackType,
      });
      if (tier >= 1) freezingField(world, slot, t.x, t.y, hail.tier1.fieldSizeMult, SHEER_COLD.duration, hail.shadowSeconds);
    }
    return true;
  },
});

// ── B. Frost Lance ──────────────────────────────────────────────────────
const lance = MUTATIONS['iceShard.frostLance'].values;

defineMutation('iceShard.frostLance', {
  stats: (s) => {
    s.pierce = Number.MAX_SAFE_INTEGER; // pierces every enemy in its line
    s.slow = Math.max(s.slow, lance.slow);
    s.cooldown *= lance.cooldownMult;
  },
  // Sheer Cold tier: the lance's line freezes into a strip.
  onCast: (world, slot) => {
    if (signatureTier(world, slot) < 1) return;
    const def = MOVES[slot.moveId] as ProjectileMoveDef;
    const target = findNearestEnemy(world, def.range);
    if (!target) return;
    const { x, y } = world.player;
    const [dx, dy] = dirTo(x, y, target.x, target.y);
    const n = lance.tier1.stripPatches;
    const r = lance.tier1.stripRadius;
    for (let i = 0; i < n; i++) {
      const d = r + (i * (def.range - r)) / Math.max(1, n - 1);
      freezingField(world, slot, x + dx * d, y + dy * d, r / SHEER_COLD.radius, lance.tier1.stripSeconds);
    }
  },
});

// ── C. Song of the Sea ──────────────────────────────────────────────────
const song = MUTATIONS['iceShard.song'].values;

defineMutation('iceShard.song', {
  // Every 4th cast is a song: light enemies around you fall asleep. No damage.
  cast: (world, slot) => {
    const def = MOVES[slot.moveId] as ProjectileMoveDef;
    if (!findNearestEnemy(world, def.range)) return false;
    const cast = (slot.mutState.casts ?? 0) + 1;
    slot.mutState.casts = cast;
    if (cast % song.everyN !== 0) return castProjectile(world, slot, def);
    const { x, y } = world.player;
    forEachEnemyIn(world, x, y, song.ringRadius, (e) => {
      if (canTrap(e)) applyNewStun(e, song.sleepSeconds);
    });
    world.blasts.push({ x, y, radius: song.ringRadius, lifeLeft: BLAST_SECONDS * 2, type: 'Water' });
    // Sheer Cold tier: the song leaves a calm-sea field that slows.
    if (signatureTier(world, slot) >= 1) {
      spawnZone(world, x, y, song.tier1.fieldRadius, song.tier1.fieldSeconds, SHEER_COLD.tickInterval, 0, 0, {
        slow: song.tier1.slow,
        stun: 0,
        poisonDps: 0,
        attackType: null,
      });
    }
    return true;
  },
});
