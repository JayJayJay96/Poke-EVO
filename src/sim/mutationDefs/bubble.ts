import { TUNING } from '../../data/content';
import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { MUTATION_TUNING } from '../../data/mutations';
import { applyNewStun, applySlow, canTrap, damageEnemy, findNearestEnemy, procHit, pushEnemy, soak } from '../combat';
import { BLAST_SECONDS } from '../forms/projectile';
import { defineMutation } from '../hooks';
import { spawnPuddle } from '../terrain';
import type { Enemy, MoveSlot, World } from '../types';
import { capEntities, dirTo, entitiesOf, forEachEnemyIn, ranked, signatureTier, spawnEntity } from './util';

// Squirtle signature Mutations: Bubble → Water Pulse → Hydro Cannon (docs/moveset/squirtle §3).
// Each keeps its earlier tiers' behaviour and adds the next (rule 10).

// ── A. Bubble Trap ──────────────────────────────────────────────────────
const trap = ranked('bubble.trap');

/** Pops a trapped enemy: (T1) pulls the crowd in, then bursts; (T2) a full blast that leaves a puddle. Rank III Soaks. */
function pop(world: World, slot: MoveSlot, enemy: Enemy): void {
  const tier = signatureTier(world, slot);
  const v = trap(slot);
  const { x, y } = enemy;
  if (tier >= 1) {
    forEachEnemyIn(world, x, y, v.tier1.pullRadius, (e) => {
      if (e === enemy) return;
      const [dx, dy] = dirTo(e.x, e.y, x, y);
      pushEnemy(e, dx, dy, v.tier1.pullPx);
    });
  }
  const def = MOVES[slot.moveId] as ProjectileMoveDef;
  const radius = tier >= 2 && def.explosion ? def.explosion.radius * slot.stats.area * slot.stats.blastRadiusMult : v.popRadius;
  const hit = { ...procHit(slot.stats.attackType), knockback: v.popStagger, slow: slot.stats.slow };
  forEachEnemyIn(world, x, y, radius, (e) => {
    [hit.dirX, hit.dirY] = dirTo(x, y, e.x, e.y);
    damageEnemy(world, e, enemy.trapDamage * v.popDamageFraction, hit);
    if (v.popSoaks) soak(e);
  });
  enemy.trapLeft = 0;
  world.blasts.push({ x, y, radius, lifeLeft: BLAST_SECONDS * 2, type: 'Water' });
  if (tier >= 2 && v.tier2.leavesPuddle) spawnPuddle(world, x, y);
}

/** Floats an enemy in a bubble (a new-effect stun, so fatigue and bosses apply). */
function engulf(enemy: Enemy, damage: number, floatSeconds: number): boolean {
  if (enemy.trapLeft > 0 || !canTrap(enemy) || !applyNewStun(enemy, floatSeconds)) return false;
  enemy.trapLeft = floatSeconds;
  enemy.trapDamage = damage;
  return true;
}

defineMutation('bubble.trap', {
  stats: (s, _world, slot) => {
    s.cooldown *= trap(slot).cooldownMult;
  },
  // Remember the projectile's first hit, so the trapped enemy can get its damage back.
  onHit: (_world, slot, enemy, dealt) => {
    if (slot.mutState.pending) return;
    slot.mutState.pending = 1;
    slot.mutState.firstId = enemy.id;
    slot.mutState.firstDealt = dealt;
  },
  onProjectileHit: (world, slot, proj, enemy) => {
    const first = slot.mutState.firstId === enemy.id ? (slot.mutState.firstDealt ?? 0) : 0;
    slot.mutState.pending = 0;
    if (enemy.hp <= 0) return;
    if (!canTrap(enemy)) {
      applySlow(enemy, MUTATION_TUNING.trapFallbackSlow, TUNING.status.slowSeconds);
      return;
    }
    const v = trap(slot);
    if (!engulf(enemy, proj.damage, v.floatSeconds)) return;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + first); // the trapped enemy takes no hit damage until the pop
    if (signatureTier(world, slot) >= 2) {
      // Giant bubble: up to maxTrapped enemies in the splash.
      let left = v.tier2.maxTrapped - 1;
      forEachEnemyIn(world, enemy.x, enemy.y, proj.explodeRadius, (e) => {
        if (left > 0 && e !== enemy && engulf(e, proj.damage, v.floatSeconds)) left--;
      });
    }
  },
  update: (world, slot, dt) => {
    for (const enemy of world.enemies) {
      if (enemy.trapLeft <= 0 || enemy.hp <= 0) continue;
      enemy.trapLeft -= dt;
      if (enemy.trapLeft <= 0) pop(world, slot, enemy);
    }
  },
});

// ── B. Froth Mines ──────────────────────────────────────────────────────
const froth = ranked('bubble.froth');

defineMutation('bubble.froth', {
  stats: (s, _world, slot) => {
    s.damage *= froth(slot).damageMult;
  },
  // Each shot leaves mines hovering along its path.
  onCast: (world, slot) => {
    const def = MOVES[slot.moveId] as ProjectileMoveDef;
    const target = findNearestEnemy(world, def.range);
    if (!target) return;
    const { x, y } = world.player;
    const v = froth(slot);
    const [dx, dy] = dirTo(x, y, target.x, target.y);
    const dist = Math.min(Math.hypot(target.x - x, target.y - y), def.range);
    for (let i = 1; i <= v.minesPerShot; i++) {
      const d = (dist * i) / (v.minesPerShot + 1);
      const mine = spawnEntity(world, 'bubble.froth', x + dx * d, y + dy * d, v.mineSeconds);
      mine.radius = v.mineRadius;
      mine.damage = slot.stats.damage * v.mineDamageFraction;
    }
    capEntities(world, 'bubble.froth', v.maxMines);
  },
  update: (world, slot, dt) => {
    const tier = signatureTier(world, slot);
    const v = froth(slot);
    for (const mine of entitiesOf(world, 'bubble.froth')) {
      mine.lifeLeft -= dt;
      if (tier >= 2) {
        const target = findNearestEnemy(world, v.driftRange, mine.x, mine.y);
        if (target) {
          const [dx, dy] = dirTo(mine.x, mine.y, target.x, target.y);
          mine.x += dx * v.tier2.driftSpeed * dt;
          mine.y += dy * v.tier2.driftSpeed * dt;
        }
      }
      let touched: Enemy | null = null;
      forEachEnemyIn(world, mine.x, mine.y, mine.radius, (e) => {
        touched ??= e;
      });
      if (!touched || mine.lifeLeft <= 0) continue;
      const hit = { ...procHit(slot.stats.attackType), slow: slot.stats.slow };
      damageEnemy(world, touched, mine.damage, hit);
      if (tier >= 1) {
        const ring = { ...procHit(null), knockback: v.tier1.mineStagger };
        forEachEnemyIn(world, mine.x, mine.y, v.mineRingRadius, (e) => {
          [ring.dirX, ring.dirY] = dirTo(mine.x, mine.y, e.x, e.y);
          damageEnemy(world, e, 0, ring);
        });
      }
      mine.lifeLeft = 0;
    }
  },
});

// ── C. Undertow ─────────────────────────────────────────────────────────
const undertow = ranked('bubble.undertow');

defineMutation('bubble.undertow', {
  stats: (s, _world, slot) => {
    s.damage *= undertow(slot).damageMult;
    s.duration *= undertow(slot).rangeMult;
    s.returns = true;
  },
  onHit: (world, slot, enemy, _dealt, hit) => {
    // On the way back the projectile flies toward the player.
    const returning = hit.dirX * (world.player.x - enemy.x) + hit.dirY * (world.player.y - enemy.y) > 0;
    if (!returning) return;
    const tier = signatureTier(world, slot);
    if (tier >= 1) pushEnemy(enemy, hit.dirX, hit.dirY, undertow(slot).tier1.dragPx);
    if (tier >= 2 && undertow(slot).tier2.soaks) soak(enemy);
  },
  update: (world, slot, dt) => {
    if (signatureTier(world, slot) < 2) return;
    slot.mutState.trail = (slot.mutState.trail ?? 0) - dt;
    if (slot.mutState.trail > 0) return;
    slot.mutState.trail = undertow(slot).tier2.puddleEvery;
    for (const p of world.projectiles) {
      if (!p.dead && p.returning && p.hit.slot === slot) spawnPuddle(world, p.x, p.y);
    }
  },
});
