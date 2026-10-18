import { TUNING } from '../../data/content';
import { MOVES, type ProjectileMoveDef } from '../../data/moves';
import { MUTATIONS, MUTATION_TUNING } from '../../data/mutations';
import { applyNewStun, applySlow, canTrap, damageEnemy, findNearestEnemy, procHit, pushEnemy, soak } from '../combat';
import { BLAST_SECONDS } from '../forms/projectile';
import { defineMutation } from '../hooks';
import { spawnPuddle } from '../terrain';
import type { Enemy, MoveSlot, World } from '../types';
import { capEntities, dirTo, entitiesOf, forEachEnemyIn, signatureTier, spawnEntity } from './util';

// Squirtle signature Mutations: Bubble → Water Pulse → Hydro Cannon (docs/moveset/squirtle §3).
// Each keeps its earlier tiers' behaviour and adds the next (rule 10).

// ── A. Bubble Trap ──────────────────────────────────────────────────────
const trap = MUTATIONS['bubble.trap'].values;

/** Pops a trapped enemy: (T1) pulls the crowd in, then bursts; (T2) a full blast that leaves a puddle. */
function pop(world: World, slot: MoveSlot, enemy: Enemy): void {
  const tier = signatureTier(world, slot);
  const { x, y } = enemy;
  if (tier >= 1) {
    forEachEnemyIn(world, x, y, trap.tier1.pullRadius, (e) => {
      if (e === enemy) return;
      const [dx, dy] = dirTo(e.x, e.y, x, y);
      pushEnemy(e, dx, dy, trap.tier1.pullPx);
    });
  }
  const def = MOVES[slot.moveId] as ProjectileMoveDef;
  const radius = tier >= 2 && def.explosion ? def.explosion.radius * slot.stats.area * slot.stats.blastRadiusMult : trap.popRadius;
  const hit = { ...procHit(slot.stats.attackType), knockback: trap.popStagger, slow: slot.stats.slow };
  forEachEnemyIn(world, x, y, radius, (e) => {
    [hit.dirX, hit.dirY] = dirTo(x, y, e.x, e.y);
    damageEnemy(world, e, enemy.trapDamage * trap.popDamageFraction, hit);
  });
  enemy.trapLeft = 0;
  world.blasts.push({ x, y, radius, lifeLeft: BLAST_SECONDS * 2, type: 'Water' });
  if (tier >= 2 && trap.tier2.leavesPuddle) spawnPuddle(world, x, y);
}

/** Floats an enemy in a bubble (a new-effect stun, so fatigue and bosses apply). */
function engulf(enemy: Enemy, damage: number): boolean {
  if (enemy.trapLeft > 0 || !canTrap(enemy) || !applyNewStun(enemy, trap.floatSeconds)) return false;
  enemy.trapLeft = trap.floatSeconds;
  enemy.trapDamage = damage;
  return true;
}

defineMutation('bubble.trap', {
  stats: (s) => {
    s.cooldown *= trap.cooldownMult;
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
    if (!engulf(enemy, proj.damage)) return;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + first); // the trapped enemy takes no hit damage until the pop
    if (signatureTier(world, slot) >= 2) {
      // Giant bubble: up to maxTrapped enemies in the splash.
      let left = trap.tier2.maxTrapped - 1;
      forEachEnemyIn(world, enemy.x, enemy.y, proj.explodeRadius, (e) => {
        if (left > 0 && e !== enemy && engulf(e, proj.damage)) left--;
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
const froth = MUTATIONS['bubble.froth'].values;

defineMutation('bubble.froth', {
  stats: (s) => {
    s.damage *= froth.damageMult;
  },
  // Each shot leaves mines hovering along its path.
  onCast: (world, slot) => {
    const def = MOVES[slot.moveId] as ProjectileMoveDef;
    const target = findNearestEnemy(world, def.range);
    if (!target) return;
    const { x, y } = world.player;
    const [dx, dy] = dirTo(x, y, target.x, target.y);
    const dist = Math.min(Math.hypot(target.x - x, target.y - y), def.range);
    for (let i = 1; i <= froth.minesPerShot; i++) {
      const d = (dist * i) / (froth.minesPerShot + 1);
      const mine = spawnEntity(world, 'bubble.froth', x + dx * d, y + dy * d, froth.mineSeconds);
      mine.radius = froth.mineRadius;
      mine.damage = slot.stats.damage * froth.mineDamageFraction;
    }
    capEntities(world, 'bubble.froth', froth.maxMines);
  },
  update: (world, slot, dt) => {
    const tier = signatureTier(world, slot);
    for (const mine of entitiesOf(world, 'bubble.froth')) {
      mine.lifeLeft -= dt;
      if (tier >= 2) {
        const target = findNearestEnemy(world, froth.driftRange, mine.x, mine.y);
        if (target) {
          const [dx, dy] = dirTo(mine.x, mine.y, target.x, target.y);
          mine.x += dx * froth.tier2.driftSpeed * dt;
          mine.y += dy * froth.tier2.driftSpeed * dt;
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
        const ring = { ...procHit(null), knockback: froth.tier1.mineStagger };
        forEachEnemyIn(world, mine.x, mine.y, froth.mineRingRadius, (e) => {
          [ring.dirX, ring.dirY] = dirTo(mine.x, mine.y, e.x, e.y);
          damageEnemy(world, e, 0, ring);
        });
      }
      mine.lifeLeft = 0;
    }
  },
});

// ── C. Undertow ─────────────────────────────────────────────────────────
const undertow = MUTATIONS['bubble.undertow'].values;

defineMutation('bubble.undertow', {
  stats: (s) => {
    s.damage *= undertow.damageMult;
    s.duration *= undertow.rangeMult;
    s.returns = true;
  },
  onHit: (world, slot, enemy, _dealt, hit) => {
    // On the way back the projectile flies toward the player.
    const returning = hit.dirX * (world.player.x - enemy.x) + hit.dirY * (world.player.y - enemy.y) > 0;
    if (!returning) return;
    const tier = signatureTier(world, slot);
    if (tier >= 1) pushEnemy(enemy, hit.dirX, hit.dirY, undertow.tier1.dragPx);
    if (tier >= 2 && undertow.tier2.soaks) soak(enemy);
  },
  update: (world, slot, dt) => {
    if (signatureTier(world, slot) < 2) return;
    slot.mutState.trail = (slot.mutState.trail ?? 0) - dt;
    if (slot.mutState.trail > 0) return;
    slot.mutState.trail = undertow.tier2.puddleEvery;
    for (const p of world.projectiles) {
      if (!p.dead && p.returning && p.hit.slot === slot) spawnPuddle(world, p.x, p.y);
    }
  },
});
