import { ABILITIES, type AbilityDef } from '../data/content';
import { applyBurn, applyNewStun, applySlow, damageEnemy, procHit, queryEnemies, soak } from './combat';
import { BLAST_SECONDS } from './forms/projectile';
import { bulbCapacity, chargeHeld, emit, healPlayer } from './hooks';
import { updateRage } from './rage';
import { updateTeleport } from './teleport';
import { spawnScorch } from './terrain';
import type { HitInfo, World } from './types';

// Line mechanics and evolved ability tiers (docs/moveset/<line>/README.md, D21): the Shell rework
// and Shell Burst, Flare Up, Bloom (the Bulb fills in healPlayer), Charge and Discharge. Everything
// they deal is a proc hit: plain damage plus its own statuses, never augments, Lifesteal, Mutations
// or ability counters. Numbers live in ABILITIES (src/data/content.ts).

const neighbours: number[] = [];

function ability(world: World): AbilityDef {
  return ABILITIES[world.player.ability];
}

/** The signature's current hit damage (Flare Up and Discharge scale with it). */
function signatureHit(world: World): number {
  return world.moves[0]?.stats.damage ?? 0;
}

/** Hits everything within `radius` of the player, knocked outward; `onEach` adds per-enemy statuses. */
function burst(world: World, radius: number, damage: number, hit: HitInfo, onEach?: (index: number) => void): void {
  const { player, enemies } = world;
  queryEnemies(world, player.x, player.y, radius, neighbours);
  for (const j of neighbours) {
    const enemy = enemies[j]!;
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist - enemy.radius > radius) continue;
    hit.dirX = dist > 0 ? dx / dist : 1;
    hit.dirY = dist > 0 ? dy / dist : 0;
    onEach?.(j);
    damageEnemy(world, enemy, damage, hit);
  }
  world.blasts.push({ x: player.x, y: player.y, radius, lifeLeft: BLAST_SECONDS * 2, type: hit.attackType });
}

// ── Shell (Squirtle line) ───────────────────────────────────────────────

/** A Shell block: the pop ring, Shell Burst every Nth block (Wartortle+), Rain Dish's heal. */
export function onShellBlock(world: World): void {
  const shell = ability(world).shell;
  if (!shell) return;
  const p = world.player;
  p.shellBlocks++;
  burst(world, shell.popRadius, 0, { ...procHit(null), knockback: shell.popStagger });
  if (shell.burst && p.shellBlocks % shell.burst.every === 0) {
    const hit = { ...procHit('Water'), knockback: shell.burst.stagger };
    burst(world, shell.burst.radius, p.maxHp * shell.burst.maxHpFraction, hit, (j) => soak(world.enemies[j]!));
    emit(world, 'shellBurst', 1);
  }
  if (shell.blockHealMaxHpFraction) healPlayer(world, p.maxHp * shell.blockHealMaxHpFraction);
}

/** A hit taken while Shell is down speeds up its recharge. */
export function onShellHitTaken(world: World): void {
  const shell = ability(world).shell;
  if (shell && world.player.blockReadyLeft > 0) {
    world.player.blockReadyLeft = Math.max(0, world.player.blockReadyLeft - shell.rechargeCutPerHit);
  }
}

// ── Flare Up (Charmeleon+) and Overgrow+'s emergency heal ───────────────

/** After a hit: erupts Flare Up, or empties the Bulb into HP (Overgrow+), when HP crossed their threshold. */
export function onLowHpHit(world: World, hpBefore: number): void {
  const p = world.player;
  if (p.hp <= 0) return;
  const def = ability(world);
  const crossed = (fraction: number) => hpBefore >= p.maxHp * fraction && p.hp < p.maxHp * fraction;

  const flare = def.flareUp;
  if (flare && p.flareCooldownLeft <= 0 && crossed(flare.threshold)) {
    p.flareCooldownLeft = flare.cooldown;
    const damage = signatureHit(world) * flare.signatureHitMult;
    burst(world, flare.radius, damage, procHit('Fire'), (j) => applyBurn(world.enemies[j]!, damage * flare.burnFraction));
    p.invulnLeft = Math.max(p.invulnLeft, flare.invulnSeconds);
    for (let i = 0; i < (flare.scorchRing ?? 0); i++) {
      const a = (i / flare.scorchRing!) * Math.PI * 2;
      const r = flare.radius * 0.6;
      spawnScorch(world, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, damage);
    }
    emit(world, 'flareUp', 1);
  }

  const emergency = def.bulb?.emergency;
  if (emergency && p.emergencyCooldownLeft <= 0 && crossed(emergency.hpBelow)) {
    if (p.bulb > 0 && p.bulb >= bulbCapacity(world) * emergency.minFill) {
      p.emergencyCooldownLeft = emergency.cooldown;
      const stored = p.bulb;
      p.bulb = 0;
      healPlayer(world, stored);
    }
  }
}

// ── Bloom (Ivysaur+) ────────────────────────────────────────────────────

function bloom(world: World): void {
  const bulb = ability(world).bulb!;
  const p = world.player;
  const damage = p.bulb * bulb.bloomMult;
  p.bulb = 0;
  p.bloomCooldownLeft = bulb.minInterval;
  burst(world, bulb.bloomRadius, damage, procHit('Grass'), (j) =>
    applySlow(world.enemies[j]!, bulb.bloomSlow, bulb.bloomSlowSeconds),
  );
  emit(world, 'bloom', 1);
}

// ── Charge (Pikachu line) ───────────────────────────────────────────────

/** Adds Charge (running, Static paralysis); tells the hooks when it fills. */
export function addCharge(world: World, amount: number): void {
  const charge = ability(world).charge;
  if (!charge || amount <= 0) return;
  const p = world.player;
  const wasFull = p.charge >= charge.max;
  p.charge = Math.min(charge.max, p.charge + amount);
  if (!wasFull && p.charge >= charge.max) emit(world, 'chargeFull', 1);
}

/** Charge gained per px run. */
export function chargePerPx(world: World): number {
  const charge = ability(world).charge;
  return charge ? 1 / charge.pxPerCharge : 0;
}

/** Charge gained per new Static paralysis. */
export function chargePerParalysis(world: World): number {
  return ability(world).charge?.perParalysis ?? 0;
}

/** Pikachu: the damage factor for the next signature shot (×2 at full Charge, else 1). */
export function chargedShotMult(world: World): number {
  const charge = ability(world).charge;
  if (chargeHeld(world)) return 1;
  return charge?.chargedShotMult && world.player.charge >= charge.max ? charge.chargedShotMult : 1;
}

/** Raichu: releases a Discharge now (also called at the end of a Volt Tackle). */
export function discharge(world: World): void {
  const d = ability(world).charge!.discharge!;
  world.player.charge = 0;
  burst(world, d.radius, signatureHit(world) * d.signatureHitMult, procHit('Electric'), (j) =>
    applyNewStun(world.enemies[j]!, d.paralyseSeconds, 'paralysis'),
  );
  emit(world, 'discharge', 1);
}

/** Per step, while the spatial hash is current: timers, Bloom, Discharge. */
export function updateAbilities(world: World, dt: number): void {
  const p = world.player;
  p.flareCooldownLeft = Math.max(0, p.flareCooldownLeft - dt);
  p.bloomCooldownLeft = Math.max(0, p.bloomCooldownLeft - dt);
  p.emergencyCooldownLeft = Math.max(0, p.emergencyCooldownLeft - dt);
  const def = ability(world);
  if (def.bulb && p.bloomCooldownLeft <= 0 && p.bulb > 0 && p.bulb >= bulbCapacity(world)) bloom(world);
  if (def.charge?.discharge && p.charge >= def.charge.max && !chargeHeld(world)) discharge(world);
  updateRage(world, dt);
  updateTeleport(world, dt);
}
