import { ARTICUNO_KIT, MACHAMP_KIT, SNORLAX_KIT, ZAPDOS_KIT } from '../data/arena';
import { ABILITIES, ENEMIES, TUNING, type PokemonType } from '../data/content';
import { ABILITY_TUNING, ELITE, ELITE_ABILITY } from '../data/hordes';
import { MUTATION_TUNING } from '../data/mutations';
import { TECHNIQUE_TUNING } from '../data/techniques';
import { effectiveness } from '../data/typeChart';
import { CRIT_MULTIPLIER } from '../data/upgrades';
import { blazeFaked, emit, healPlayer, hooksOf, mutationLeechBonus } from './hooks';
import { applyPlayerStatus } from './playerStatus';
import { statusMult, type StatusId } from './statusResist';
import { boonDamageMult, gluttonyMult, onBoonKill, sheerColdExecutes } from './boons';
import { onTechniqueHit, onTechniqueKill, techniqueDamageMult } from './techniques';
import type { Berry, Enemy, Gem, HitInfo, MoveSlot, MoveStats, World } from './types';

/** Largest horde radius. Bosses are left out so their size doesn't widen every query (D28). */
// Elites are bigger than their species (D34).
export const MAX_ENEMY_RADIUS = Math.max(...Object.values(ENEMIES).filter((e) => !e.boss).map((e) => e.radius)) * ELITE.radiusMult;

/** The ability an Elite has on (D34); none for normal enemies. */
function eliteAbilityOf(enemy: Enemy) {
  return enemy.elite ? ELITE_ABILITY[enemy.kind] : undefined;
}
/**
 * Extra query reach while an arena boss is out. shortcut: melee targeting (reach + MAX_ENEMY_RADIUS) still
 * ignores it, so melee reaches a boss up to this much later; widen those calls if bosses feel out of reach.
 */
const BOSS_QUERY_PAD = Math.max(...Object.values(ENEMIES).map((e) => e.radius)) - MAX_ENEMY_RADIUS;
/** Enemies move after the hash is built, so queries look a little wider than needed. */
const HASH_MARGIN = 8;

/** A plain hit: no crit, no on-hit effects. Used by zone and burn ticks (no proc-from-proc). */
export const NO_HIT: Readonly<HitInfo> = {
  critChance: 0,
  missingHpBonus: 0,
  lifesteal: 0,
  burnDps: 0,
  knockback: 0,
  dirX: 0,
  dirY: 0,
  slow: 0,
  stun: 0,
  stunKind: null,
  poisonDps: 0,
  seedDps: 0,
  attackType: null,
  slot: null,
  fromProc: false,
};

/** A hit spawned by a Mutation or ability effect: plain damage plus the caller's own statuses, nothing else. */
export function procHit(attackType: HitInfo['attackType']): HitInfo {
  return { ...NO_HIT, attackType, fromProc: true };
}

/** On-hit effects for a move with these stats. Callers set dirX/dirY per hit for knockback. */
export function makeHitInfo(stats: MoveStats, slot: MoveSlot | null = null): HitInfo {
  return {
    critChance: stats.critChance,
    missingHpBonus: stats.missingHpBonus,
    lifesteal: stats.lifesteal,
    burnDps: stats.damage * stats.burnPct,
    knockback: stats.knockback,
    dirX: 0,
    dirY: 0,
    slow: stats.slow,
    stun: stats.stun,
    stunKind: stats.stunKind,
    poisonDps: stats.damage * stats.poisonPct,
    attackType: stats.attackType,
    seedDps: stats.damage * stats.seedPct,
    slot,
    fromProc: false,
  };
}

/** Knockback resistance from real weight (D14): weight ÷ (weight + K). */
export function knockbackResistance(weightKg: number): number {
  return weightKg / (weightKg + TUNING.knockbackWeightK);
}

/** Candidate enemy indices whose bodies may touch a circle at (x, y) of `radius`. */
export function queryEnemies(world: World, x: number, y: number, radius: number, out: number[]): number[] {
  const pad = world.arena ? BOSS_QUERY_PAD : 0;
  return world.hash.query(x, y, radius + MAX_ENEMY_RADIUS + pad + HASH_MARGIN, out);
}

/** Nearest living enemy within `range` of a point (default: the player), or undefined. */
export function findNearestEnemy(
  world: World,
  range: number,
  x = world.player.x,
  y = world.player.y,
): Enemy | undefined {
  let best: Enemy | undefined;
  let bestDist2 = range * range;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= bestDist2) {
      best = enemy;
      bestDist2 = dist2;
    }
  }
  return best;
}

/** A random living enemy within `range` of the player (confusion's aim). */
function randomEnemyInRange(world: World, range: number): Enemy | undefined {
  const { x, y } = world.player;
  const inRange = world.enemies.filter((e) => e.hp > 0 && (e.x - x) ** 2 + (e.y - y) ** 2 <= range * range);
  return inRange.length > 0 ? inRange[Math.floor(world.rng.next() * inRange.length)] : undefined;
}

/** The enemy a move aims at: the nearest in range, or with Predatory the one with the lowest HP % (2026-10-22). */
export function findTarget(world: World, slot: MoveSlot, range: number): Enemy | undefined {
  // Confused (D36, README §10): your aim drifts to a random enemy in range; movement is never touched.
  if (world.playerStatus.confuseLeft > 0) return randomEnemyInRange(world, range);
  if (!slot.stats.predatory) return findNearestEnemy(world, range);
  const { x, y } = world.player;
  let best: Enemy | undefined;
  let bestFrac = Infinity;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    if (dx * dx + dy * dy > range * range) continue;
    const frac = enemy.hp / enemy.maxHp;
    if (frac < bestFrac) {
      best = enemy;
      bestFrac = frac;
    }
  }
  return best;
}

/** True while the player's trait is in its low-HP state (Blaze, Blaze+). */
export function isAbilityActive(world: World): boolean {
  const { lowHpThreshold } = ABILITIES[world.player.ability];
  if (lowHpThreshold === undefined) return false;
  // Hidden Flame: standing in your own smoke counts as the low-HP state.
  return world.player.hp > 0 && (world.player.hp < world.player.maxHp * lowHpThreshold || blazeFaked(world));
}

/** Live damage multiplier from the low-HP trait; applied when a hit lands, so it tracks current HP. */
export function abilityDamageMult(world: World): number {
  if (!isAbilityActive(world)) return 1;
  return 1 + (ABILITIES[world.player.ability].lowHpDamageBonus ?? 0);
}

/**
 * The arena boss in a special animation (berry shake, Belly Drum, airborne Heavy Slam) takes no damage, so it can't
 * be burst through them (owner 2026-10-22). Rest is not one: it's the interrupt window (BOSSES.md §4).
 */
export function bossImmune(world: World, enemy: Enemy): boolean {
  const f = world.arena;
  if (!f || f.bossEnemyId !== enemy.id) return false;
  // Zapdos and Machamp: their phase-change animations (Charge-up, Rain Dance; Focus Energy, No Guard).
  if (f.zap) return f.zap.transitionLeft > 0;
  if (f.champ) return f.champ.transitionLeft > 0;
  if (f.artic) return f.artic.transitionLeft > 0;
  const airborne = f.heavySlam?.phase === 'air' || f.heavySlam?.phase === 'lock';
  return f.shakeLeft > 0 || f.drumLeft > 0 || airborne;
}

/** The lowest HP damage can take the arena boss to: its next phase threshold, until that phase has started. */
export function bossHpFloor(world: World, enemy: Enemy): number {
  const f = world.arena;
  if (!f || f.bossEnemyId !== enemy.id) return 0;
  // Snorlax: while resting in phase p the gate is the next threshold; otherwise the current phase's own.
  const gate = f.zap
    ? ZAPDOS_KIT.phaseAt[f.zap.phase - 1]
    : f.champ
      ? MACHAMP_KIT.phaseAt[f.champ.phase - 1]
      : f.artic
        ? ARTICUNO_KIT.phaseAt[f.artic.phase - 1]
        : SNORLAX_KIT.restAt[f.rest ? f.phase : f.phase - 1];
  return gate === undefined ? 0 : enemy.maxHp * gate;
}

/** A hit's statuses scaled down by Shield Dust (its damage is unchanged). */
function shieldDusted(hit: Readonly<HitInfo>): Readonly<HitInfo> {
  const m = ABILITY_TUNING.shieldDust.statusMult;
  return { ...hit, burnDps: hit.burnDps * m, poisonDps: hit.poisonDps * m, seedDps: hit.seedDps * m, slow: hit.slow * m, stun: hit.stun * m };
}

/** Roosting Zapdos is grounded: it loses its Flying type until it takes off (BOSSES.md §4). */
const ROOSTING_ZAPDOS: readonly PokemonType[] = ['Electric'];
const ROOSTING_ARTICUNO: readonly PokemonType[] = ['Ice'];

/** Articuno's Mist (D45): no status rides in on a hit while it's up (the damage still lands). */
function misted(hit: Readonly<HitInfo>): Readonly<HitInfo> {
  return { ...hit, burnDps: 0, poisonDps: 0, seedDps: 0, slow: 0, stun: 0 };
}

/**
 * Applies a hit and its on-hit effects (§8.8 onHit): crit roll, live multipliers
 * (ability, Blaze Core's missing-HP bonus), lifesteal, burn, knockback.
 * A killing hit counts the KO and drops the gem. Returns the damage actually dealt.
 */
export function damageEnemy(world: World, enemy: Enemy, damage: number, hit: Readonly<HitInfo> = NO_HIT): number {
  if (enemy.hp <= 0) return 0;
  if (bossImmune(world, enemy)) {
    // A grey flash ("not effective") shows the hit did nothing.
    enemy.lastEffectiveness = 0;
    enemy.hitFlashLeft = TUNING.enemy.hitFlashSeconds;
    return 0;
  }
  // Mutation hooks see only the move's own hits, never proc hits (no proc-from-proc).
  const slot = hit.fromProc ? null : hit.slot;
  const hooks = slot ? hooksOf(slot) : undefined;
  // Focus Energy (D40): this move's next own hit is a forced ×2 crit.
  const focus = slot !== null && slot.focusReady;
  if (focus) slot.focusReady = false;
  // Only consume RNG when a crit is possible, so crit-free runs stay reproducible.
  const crit =
    focus || hooks?.forceCrit?.(world, slot!, enemy) === true || (hit.critChance > 0 && world.rng.next() < hit.critChance);
  const critMult = focus ? TECHNIQUE_TUNING.focusEnergy.critMult : CRIT_MULTIPLIER;
  const player = world.player;
  const missing = hit.missingHpBonus > 0 ? hit.missingHpBonus * Math.max(0, 1 - player.hp / player.maxHp) : 0;
  const def = ENEMIES[enemy.kind];
  const zap = world.arena?.bossEnemyId === enemy.id ? world.arena.zap : null;
  const champ = world.arena?.bossEnemyId === enemy.id ? world.arena.champ : null;
  const artic = world.arena?.bossEnemyId === enemy.id ? world.arena.artic : null;
  // Type chart (D14): multiplied for dual-type enemies; typeless hits stay ×1.
  const typeMult = effectiveness(hit.attackType, zap?.roost ? ROOSTING_ZAPDOS : artic?.roost ? ROOSTING_ARTICUNO : def.types);
  enemy.lastEffectiveness = typeMult;
  const mutationMult = hooks?.damageMult ? hooks.damageMult(world, slot!, enemy) : 1;
  // Vulnerability debuffs (Wash Down, Acid, Nightmare...): extra damage taken, for one type or all.
  const vuln =
    (enemy.vulnLeft > 0 && (enemy.vulnType === null || enemy.vulnType === hit.attackType) ? 1 + enemy.vulnPct : 1) *
    (enemy.vulnAllLeft > 0 ? 1 + enemy.vulnAllPct : 1);
  // Rest (D28, B2): a sleeping arena boss takes extra damage, and that damage fills its wake meter.
  const sleeping = world.arena?.rest && world.arena.bossEnemyId === enemy.id ? world.arena.rest : null;
  const amount =
    (crit ? damage * critMult : damage) *
    abilityDamageMult(world) *
    techniqueDamageMult(world, enemy, slot) *
    boonDamageMult(world) *
    (1 + missing) *
    typeMult *
    mutationMult *
    vuln *
    // Tangled Feet (Elite Pidgey): evasive while its footing is disrupted.
    (eliteAbilityOf(enemy) === 'tangledFeet' && (enemy.slowLeft > 0 || enemy.trapLeft > 0) ? ABILITY_TUNING.tangledFeet.damageTakenMult : 1) *
    (sleeping ? SNORLAX_KIT.rest.damageTakenMult : 1) *
    // Zapdos's generators: shielded while any pylon stands.
    (zap?.pylons.some((p) => p.enemyId !== null) ? ZAPDOS_KIT.pylons.shieldMult : 1) *
    (zap && zap.overloadLeft > 0 ? ZAPDOS_KIT.overload.damageTakenMult : 1) *
    // Machamp after Close Combat: its defences are down for a moment.
    (champ && champ.openLeft > 0 ? MACHAMP_KIT.closeCombat.weakMult : 1) *
    // Articuno's Sheer Cold armour (phase 3).
    (artic?.armour ? ARTICUNO_KIT.sheerCold.damageTakenMult : 1) *
    // The move's own hits only (procs carry no slot): Volatility's roll and Predatory's bonus below half HP.
    (slot ? slot.volatileMult : 1) *
    (slot && slot.stats.executePct > 0 && enemy.hp < enemy.maxHp * 0.5 ? 1 + slot.stats.executePct : 1);
  // Phase gate (owner 2026-10-22): a boss can't be burst past its next Rest, so every phase plays.
  const floor = bossHpFloor(world, enemy);
  const dealt = Math.max(0, Math.min(enemy.hp - floor, amount));
  if (sleeping) sleeping.wake += dealt;
  world.damageDealt += dealt;
  if (hit.slot) hit.slot.damageDealt += dealt;
  // Zapdos's Discharge channel: enough damage interrupts it.
  if (zap?.discharge?.phase === 'channel') zap.discharge.taken += dealt;
  // Machamp: damage during Bulk Up or the Focus Punch channel fills its interrupt meter.
  if (champ?.bulking) champ.bulking.taken += dealt;
  if (champ?.focus?.phase === 'channel') champ.focus.taken += dealt;
  // Articuno: super-effective hits wear its Sheer Cold armour down (counted as if unarmoured).
  if (artic?.armour && typeMult > 1) artic.armour.taken += dealt / ARTICUNO_KIT.sheerCold.damageTakenMult;
  enemy.hp = floor > 0 ? enemy.hp - dealt : enemy.hp - amount;
  // Sheer Cold (D49): a move's own hit finishes a slowed, low, non-boss enemy.
  if (sheerColdExecutes(world, enemy, slot)) enemy.hp = 0;
  const ability = eliteAbilityOf(enemy);
  // Anger Point (Elite Tauros): a crit enrages it. Run Away (Elite Rattata): once, at low HP, it sprints off.
  if (crit && ability === 'angerPoint') enemy.rageLeft = ABILITY_TUNING.angerPoint.seconds;
  if (ability === 'runAway' && !enemy.abilityUsed && enemy.hp > 0 && enemy.hp < enemy.maxHp * ABILITY_TUNING.runAway.belowPct) {
    enemy.abilityUsed = true;
    enemy.fleeLeft = ABILITY_TUNING.runAway.seconds;
  }
  // Sturdy (Elite Geodude): once per life, a hit that would KO it leaves it at 1 HP.
  if (ability === 'sturdy' && !enemy.abilityUsed && enemy.hp <= 0) {
    enemy.abilityUsed = true;
    enemy.hp = 1;
  }
  enemy.hitFlashLeft = TUNING.enemy.hitFlashSeconds;

  const lifesteal = hit.fromProc ? hit.lifesteal : hit.lifesteal + mutationLeechBonus(world, enemy);
  if (lifesteal > 0) healPlayer(world, dealt * lifesteal);
  hooks?.onHit?.(world, slot!, enemy, dealt, hit);
  if (slot) onTechniqueHit(world, slot, enemy);

  if (enemy.hp <= 0) {
    world.kills++;
    if (def.xp > 0) dropGem(world, enemy.x, enemy.y, def.xp * (enemy.elite ? ELITE.xpMult : 1));
    maybeDropBerry(world, enemy.x, enemy.y, enemy.elite ? Math.max(def.berryChance, ELITE.berryChance) : def.berryChance);
    maybeDropMagnet(world, enemy.x, enemy.y);
    // Aftermath (Elite Voltorb): it explodes anyway, after a short ring.
    if (ability === 'aftermath') {
      const { delay, radius, damageFactor } = ABILITY_TUNING.aftermath;
      world.delayedBlasts.push({ x: enemy.x, y: enemy.y, radius, left: delay, total: delay, damage: enemy.contactDamage * damageFactor, owner: enemy });
    }
    if (!hit.fromProc) {
      hooks?.onKill?.(world, slot!, enemy);
      emit(world, 'kill', 1, enemy);
    }
    onTechniqueKill(world, enemy, dealt);
    onBoonKill(world);
    return dealt;
  }
  // Shield Dust (Elite Caterpie): statuses riding on a damaging hit barely land.
  if (ability === 'shieldDust') hit = shieldDusted(hit);
  if (artic && artic.mistLeft > 0) hit = misted(hit);
  // Synchronize (Elite Abra): burn, poison and paralysis bounce back onto you (only these three, lore).
  if (ability === 'synchronize') {
    if (hit.burnDps > 0) applyPlayerStatus(world, 'burn', { hit: enemy.contactDamage });
    if (hit.poisonDps > 0) applyPlayerStatus(world, 'poison', { hit: enemy.contactDamage });
    if (hit.stun > 0 && hit.stunKind === 'paralysis') applyPlayerStatus(world, 'paralysis');
  }
  if (hit.burnDps > 0) applyBurn(enemy, hit.burnDps);
  applyStatuses(enemy, hit);
  if (hit.seedDps > 0) {
    // Leech Seed: refreshes; a stronger seed replaces a weaker one. Grass shrugs it off (D27).
    const seeded = enemy.seedLeft > 0;
    const seedDps = hit.seedDps * enemyStatusMult(enemy, 'seed');
    enemy.seedDps = seeded ? Math.max(enemy.seedDps, seedDps) : seedDps;
    if (!seeded) enemy.seedTickLeft = TUNING.status.burnTick;
    enemy.seedLeft = TUNING.status.seedSeconds;
  }
  if (hit.knockback > 0) pushEnemy(enemy, hit.dirX, hit.dirY, hit.knockback);
  return dealt;
}

/**
 * Pushes an enemy about `px` along (dirX, dirY); a negative `px` pulls. Exponential decay makes the
 * total push about the distance; heavy enemies resist, Soaked enemies stagger further, bosses half as far.
 */
export function pushEnemy(enemy: Enemy, dirX: number, dirY: number, px: number): void {
  const def = ENEMIES[enemy.kind];
  const soaked = enemy.soakLeft > 0 ? MUTATION_TUNING.soaked.staggerTakenMult : 1;
  const boss = def.boss ? MUTATION_TUNING.bossStaggerMult : enemy.elite ? ELITE.staggerMult : 1;
  const v = px * TUNING.status.knockbackDecay * (1 - knockbackResistance(def.weightKg)) * soaked * boss;
  enemy.kbX += dirX * v;
  enemy.kbY += dirY * v;
}

const RESIST_CACHE = new Map<string, number>();

/**
 * Status resistance by type (D27, README §2–§3): ×1.5 / ×1 / ×0.5 / ×0.25 from the enemy's types. It scales a
 * DoT's damage or another status's duration. Bosses also take stuns at half length (boss rule, README §5).
 */
export function enemyStatusMult(enemy: Enemy, status: StatusId): number {
  const key = `${enemy.kind}:${status}`;
  let mult = RESIST_CACHE.get(key);
  if (mult === undefined) {
    const def = ENEMIES[enemy.kind];
    const stun = status === 'sleep' || status === 'paralysis' || status === 'flinch' || status === 'freeze';
    mult = statusMult(def.types, status) * (def.boss && stun ? 0.5 : 1);
    RESIST_CACHE.set(key, mult);
  }
  return mult;
}

/** Which resistance a stun uses. */
function stunStatus(kind: Enemy['stunKind']): StatusId {
  return kind === 'sleep' ? 'sleep' : kind === 'paralysis' ? 'paralysis' : 'flinch';
}

/** Starts or refreshes a burn; a stronger burn replaces a weaker one. */
export function applyBurn(enemy: Enemy, dps: number): void {
  dps *= enemyStatusMult(enemy, 'burn');
  const burning = enemy.burnLeft > 0;
  enemy.burnDps = burning ? Math.max(enemy.burnDps, dps) : dps;
  if (!burning) enemy.burnTickLeft = TUNING.status.burnTick;
  enemy.burnLeft = TUNING.status.burnSeconds;
}

/**
 * A stun from a new effect (Mutations, evolved abilities): bosses are immune, and stun fatigue
 * (D21) blocks it for a while after the last one ended. Base moves keep using applyStatuses.
 * Returns whether it stunned.
 */
export function applyNewStun(enemy: Enemy, seconds: number, kind: Enemy['stunKind'] = null): boolean {
  if (seconds <= 0 || enemy.stunFatigueLeft > 0 || ENEMIES[enemy.kind].boss) return false;
  seconds *= enemyStatusMult(enemy, stunStatus(kind));
  if (seconds >= enemy.stunLeft) enemy.stunKind = kind;
  enemy.stunLeft = Math.max(enemy.stunLeft, seconds);
  enemy.fatigueOnEnd = true;
  return true;
}

/** Blinded (D20): the enemy loses you for `seconds` and wanders off; bosses are immune. */
export function applyBlind(world: World, enemy: Enemy, seconds: number): void {
  if (seconds <= 0 || ENEMIES[enemy.kind].boss) return;
  // Keen Eye (Elite Fearow): its accuracy can't really be lowered.
  if (eliteAbilityOf(enemy) === 'keenEye') seconds *= ABILITY_TUNING.keenEye.blindMult;
  seconds *= enemyStatusMult(enemy, 'blind');
  if (enemy.blindLeft <= 0) pickWanderPoint(world, enemy);
  enemy.blindLeft = Math.max(enemy.blindLeft, seconds);
}

/** A random point `blindWanderPx` away for a blinded enemy to walk to. */
export function pickWanderPoint(world: World, enemy: Enemy): void {
  const a = world.rng.next() * Math.PI * 2;
  enemy.wanderX = enemy.x + Math.cos(a) * TUNING.status.blindWanderPx;
  enemy.wanderY = enemy.y + Math.sin(a) * TUNING.status.blindWanderPx;
}

/** Traps, slips and drags only work on light, non-boss enemies. */
export function canTrap(enemy: Enemy): boolean {
  const def = ENEMIES[enemy.kind];
  return !def.boss && def.weightKg < MUTATION_TUNING.trapMaxWeightKg;
}

/** A slow with its own duration (ability bursts); a stronger slow wins. */
export function applySlow(enemy: Enemy, slow: number, seconds: number): void {
  enemy.slow = enemy.slowLeft > 0 ? Math.max(enemy.slow, slow) : slow;
  enemy.slowLeft = Math.max(enemy.slowLeft, seconds * enemyStatusMult(enemy, 'slow'));
}

/** A vulnerability debuff; a stronger one replaces a weaker one, the time refreshes. */
export function applyVuln(enemy: Enemy, pct: number, seconds: number, type: Enemy['vulnType']): void {
  if (enemy.vulnLeft > 0 && enemy.vulnPct > pct) return;
  enemy.vulnPct = pct;
  enemy.vulnType = type;
  enemy.vulnLeft = Math.max(enemy.vulnLeft, seconds);
}

/** The stacking all-types vulnerability (Wash Down III); a stronger one replaces a weaker one. */
export function applyVulnAll(enemy: Enemy, pct: number, seconds: number): void {
  if (enemy.vulnAllLeft > 0 && enemy.vulnAllPct > pct) return;
  enemy.vulnAllPct = pct;
  enemy.vulnAllLeft = Math.max(enemy.vulnAllLeft, seconds);
}

/** Leech Seed from a Mutation (Sap Lash): a stronger seed replaces a weaker one; the time refreshes. */
export function applySeed(enemy: Enemy, dps: number, seconds: number): void {
  dps *= enemyStatusMult(enemy, 'seed');
  const seeded = enemy.seedLeft > 0;
  enemy.seedDps = seeded ? Math.max(enemy.seedDps, dps) : dps;
  if (!seeded) enemy.seedTickLeft = TUNING.status.burnTick;
  enemy.seedLeft = Math.max(enemy.seedLeft, seconds);
}

/** Soaked (shared Water terrain): refreshes. */
export function soak(enemy: Enemy, seconds: number = MUTATION_TUNING.soaked.seconds): void {
  enemy.soakLeft = Math.max(enemy.soakLeft, seconds * enemyStatusMult(enemy, 'soaked'));
}

/** Movement factor from slows and Soaked; the total slowdown is capped (guard rail). */
export function enemySpeedFactor(enemy: Enemy): number {
  const slow = enemy.slowLeft > 0 ? enemy.slow : 0;
  const soaked = enemy.soakLeft > 0 ? MUTATION_TUNING.soaked.speedMult : 1;
  return Math.max(1 - MUTATION_TUNING.slowCap, (1 - slow) * soaked);
}

/** Slow, stun and poison from a hit or a zone tick. Stronger effects win; durations refresh. */
export function applyStatuses(
  enemy: Enemy,
  effects: Pick<HitInfo, 'slow' | 'stun' | 'poisonDps'> & { readonly stunKind?: Enemy['stunKind'] },
): void {
  // Status resistance by type (D27) scales durations and the poison's damage.
  if (effects.slow > 0) {
    enemy.slow = enemy.slowLeft > 0 ? Math.max(enemy.slow, effects.slow) : effects.slow;
    enemy.slowLeft = TUNING.status.slowSeconds * enemyStatusMult(enemy, 'slow');
  }
  if (effects.stun > 0) {
    const stun = effects.stun * enemyStatusMult(enemy, stunStatus(effects.stunKind ?? null));
    if (stun >= enemy.stunLeft) enemy.stunKind = effects.stunKind ?? null;
    enemy.stunLeft = Math.max(enemy.stunLeft, stun);
  }
  if (effects.poisonDps > 0) {
    const dps = effects.poisonDps * enemyStatusMult(enemy, 'poison');
    const poisoned = enemy.poisonLeft > 0;
    enemy.poisonDps = poisoned ? Math.max(enemy.poisonDps, dps) : dps;
    if (!poisoned) enemy.poisonTickLeft = TUNING.status.burnTick;
    enemy.poisonLeft = TUNING.status.poisonSeconds;
  }
}

/** Absorbs float drift so a burn's last tick lands on the same step it expires. */
const TICK_EPSILON = 1e-6;

/** Knockback movement and burn ticks. Burn ticks are plain hits (no proc-from-proc). */
export function updateStatuses(world: World, dt: number): void {
  const decay = Math.exp(-TUNING.status.knockbackDecay * dt);
  const tick = TUNING.status.burnTick;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.kbX !== 0 || enemy.kbY !== 0) {
      enemy.x += enemy.kbX * dt;
      enemy.y += enemy.kbY * dt;
      enemy.kbX *= decay;
      enemy.kbY *= decay;
      if (Math.abs(enemy.kbX) + Math.abs(enemy.kbY) < 1) {
        enemy.kbX = 0;
        enemy.kbY = 0;
      }
    }
    if (enemy.burnLeft > 0) {
      enemy.burnLeft -= dt;
      enemy.burnTickLeft -= dt;
      while (enemy.burnTickLeft <= TICK_EPSILON && enemy.hp > 0) {
        damageEnemy(world, enemy, enemy.burnDps * tick);
        enemy.burnTickLeft += tick;
      }
      if (enemy.burnLeft <= 0) enemy.burnDps = 0;
    }
    if (enemy.poisonLeft > 0 && enemy.hp > 0) {
      enemy.poisonLeft -= dt;
      enemy.poisonTickLeft -= dt;
      while (enemy.poisonTickLeft <= TICK_EPSILON && enemy.hp > 0) {
        damageEnemy(world, enemy, enemy.poisonDps * tick);
        enemy.poisonTickLeft += tick;
      }
      if (enemy.poisonLeft <= 0) {
        enemy.poisonDps = 0;
        enemy.poisonStacks = 0;
      }
    }
    if (enemy.seedLeft > 0 && enemy.hp > 0) {
      enemy.seedLeft -= dt;
      enemy.seedTickLeft -= dt;
      while (enemy.seedTickLeft <= TICK_EPSILON && enemy.hp > 0) {
        // A plain hit (no proc-from-proc); part of the damage dealt heals the player.
        const dealt = damageEnemy(world, enemy, enemy.seedDps * tick);
        healPlayer(world, dealt * TUNING.status.seedHealFraction);
        enemy.seedTickLeft += tick;
      }
      if (enemy.seedLeft <= 0) enemy.seedDps = 0;
    }
    if (enemy.slowLeft > 0) {
      enemy.slowLeft -= dt;
      if (enemy.slowLeft <= 0) enemy.slow = 0;
    }
    if (enemy.soakLeft > 0) enemy.soakLeft = Math.max(0, enemy.soakLeft - dt);
    if (enemy.vulnLeft > 0) enemy.vulnLeft = Math.max(0, enemy.vulnLeft - dt);
    if (enemy.vulnAllLeft > 0) enemy.vulnAllLeft = Math.max(0, enemy.vulnAllLeft - dt);
    if (enemy.weakenLeft > 0) enemy.weakenLeft = Math.max(0, enemy.weakenLeft - dt);
    if (enemy.blindLeft > 0) enemy.blindLeft = Math.max(0, enemy.blindLeft - dt);
    if (enemy.stunFatigueLeft > 0) enemy.stunFatigueLeft = Math.max(0, enemy.stunFatigueLeft - dt);
    if (enemy.stunLeft > 0) {
      enemy.stunLeft = Math.max(0, enemy.stunLeft - dt);
      if (enemy.stunLeft === 0) {
        enemy.stunKind = null;
        if (enemy.fatigueOnEnd) {
          enemy.fatigueOnEnd = false;
          enemy.stunFatigueLeft = MUTATION_TUNING.stunFatigueSeconds;
        }
      }
    }
  }
}

function dropsOnGround(world: World, kind: Berry['kind']): number {
  let n = 0;
  for (const b of world.berries) if (b.kind === kind && !b.collected) n++;
  return n;
}

/** Rolls for an Oran Berry drop (D12); skipped when the berry budget is full. */
export function maybeDropBerry(world: World, x: number, y: number, chance: number): void {
  if (chance <= 0 || dropsOnGround(world, 'oran') >= TUNING.heal.maxBerries) return;
  if (world.rng.next() >= chance * gluttonyMult(world, 'drop')) return;
  const expiresAt = world.time + TUNING.heal.dropLifetimeSeconds;
  world.berries.push({ id: world.nextId++, kind: 'oran', x, y, collected: false, expiresAt });
}

/** Rare Magnet drop, with its own cap (2026-10-24: berries filling a shared budget stopped magnets late game). */
export function maybeDropMagnet(world: World, x: number, y: number): void {
  if (dropsOnGround(world, 'magnet') >= TUNING.magnet.maxMagnets || world.rng.next() >= TUNING.magnet.dropChance) return;
  const expiresAt = world.time + TUNING.heal.dropLifetimeSeconds;
  world.berries.push({ id: world.nextId++, kind: 'magnet', x, y, collected: false, expiresAt });
}

export function dropGem(world: World, x: number, y: number, value: number): void {
  if (world.gems.length >= TUNING.xp.maxGems) {
    // Budget reached: fold the XP into the oldest gem instead of adding an entity.
    world.gems[0]!.value += value;
    return;
  }
  const expiresAt = world.time + TUNING.xp.gemLifetimeSeconds;
  const gem: Gem = { id: world.nextId++, x, y, value, magnetized: false, collected: false, expiresAt };
  world.gems.push(gem);
}
