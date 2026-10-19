import { ABILITIES } from '../../data/content';
import { MOVES, type MeleeMoveDef } from '../../data/moves';
import { discharge } from '../abilities';
import { damageEnemy, findNearestEnemy, makeHitInfo } from '../combat';
import { castMelee } from '../forms/melee';
import { ARC_SECONDS } from '../forms/projectile';
import { defineMutation } from '../hooks';
import type { MoveSlot, World } from '../types';
import { dirTo, forEachEnemyOnSegment, ranked } from './util';

// Quick Attack Mutations (docs/moveset/shared/quick-attack.md, pikachu/README.md).

const quickAttack = MOVES.quickAttack as MeleeMoveDef;

/** Runs the normal swipe with its damage scaled for this one cast. */
function scaledSwipe(world: World, slot: MoveSlot, damageMult: number): boolean {
  slot.stats.damage *= damageMult;
  const cast = castMelee(world, slot, quickAttack);
  slot.stats.damage /= damageMult;
  return cast;
}

/** Blink Strike (generic): strikes the nearest enemy in a longer range instantly; you stay put. */
const blink = ranked('quickAttack.blink');
defineMutation('quickAttack.blink', {
  stats: (s, _world, slot) => {
    s.damage *= blink(slot).damageMult;
  },
  cast: (world, slot) => {
    const { player } = world;
    const target = findNearestEnemy(world, blink(slot).range * slot.stats.reachMult);
    if (!target) return false;
    const hit = makeHitInfo(slot.stats, slot);
    [hit.dirX, hit.dirY] = dirTo(player.x, player.y, target.x, target.y);
    damageEnemy(world, target, slot.stats.damage, hit);
    world.arcs.push({ x1: player.x, y1: player.y, x2: target.x, y2: target.y, lifeLeft: ARC_SECONDS }); // the afterimage
    return true;
  },
});

/** Double Hit (generic): strikes twice; the second hit comes a moment later, weaker. */
const double = ranked('quickAttack.doubleHit');
defineMutation('quickAttack.doubleHit', {
  stats: (s, _world, slot) => {
    s.cooldown *= double(slot).cooldownMult;
  },
  onCast: (_world, slot) => {
    slot.mutState.second = double(slot).secondHitDelay;
  },
  update: (world, slot, dt) => {
    if (!slot.mutState.second) return;
    slot.mutState.second = Math.max(0, slot.mutState.second - dt);
    if (slot.mutState.second === 0) scaledSwipe(world, slot, double(slot).secondHitFraction);
  },
});

/**
 * Volt Tackle (Bond, Charge full): at full Charge the next Quick Attack is a dash-strike for ×3 that
 * spends the Charge, with recoil like the real move. It replaces the Charged shot; on Raichu the
 * Discharge fires at the end of the dash.
 */
const volt = ranked('quickAttack.voltTackle');
defineMutation('quickAttack.voltTackle', {
  holdsCharge: true,
  cast: (world, slot) => {
    const p = world.player;
    const charge = ABILITIES[p.ability].charge;
    if (!charge || p.charge < charge.max) return castMelee(world, slot, quickAttack);
    const v = volt(slot);
    const target = findNearestEnemy(world, v.dashPx + quickAttack.reach * slot.stats.area);
    if (!target) return false;
    const [dx, dy] = dirTo(p.x, p.y, target.x, target.y);
    const x0 = p.x;
    const y0 = p.y;
    p.x += dx * v.dashPx;
    p.y += dy * v.dashPx;
    const hit = makeHitInfo(slot.stats, slot);
    hit.dirX = dx;
    hit.dirY = dy;
    forEachEnemyOnSegment(world, x0, y0, p.x, p.y, p.radius * 2, (e) =>
      damageEnemy(world, e, slot.stats.damage * v.damageMult, hit),
    );
    world.arcs.push({ x1: x0, y1: y0, x2: p.x, y2: p.y, lifeLeft: ARC_SECONDS });
    p.hp = Math.max(1, p.hp - p.maxHp * v.recoilMaxHpFraction);
    if (charge.discharge) discharge(world); // spends the Charge too
    else p.charge = 0;
    return true;
  },
});
