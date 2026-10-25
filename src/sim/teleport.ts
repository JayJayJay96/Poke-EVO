import { ABILITIES, type TeleportDef } from '../data/content';
import { damageEnemy, procHit, queryEnemies } from './combat';
import { BLAST_SECONDS } from './forms/projectile';
import { emit } from './hooks';
import { hitsObstacle } from './map';
import type { World } from './types';

// Teleport (Abra line, D56, docs/moveset/abra): surrounded, Abra glows for a moment, then blinks to the most open
// spot nearby; from Kadabra the spot it left bursts (Psychic Echo). Also runs Reflect's barrier timer.
// Numbers live in ABILITIES (src/data/content.ts).

const neighbours: number[] = [];
/** Directions tried for the landing spot. */
const DIRECTIONS = 8;
/** If every spot is blocked, look again this soon. */
const RETRY_SECONDS = 0.5;

function enemiesNear(world: World, x: number, y: number, radius: number): number {
  queryEnemies(world, x, y, radius, neighbours);
  let n = 0;
  for (const j of neighbours) {
    const e = world.enemies[j]!;
    if (e.hp > 0 && (e.x - x) ** 2 + (e.y - y) ** 2 <= (radius + e.radius) ** 2) n++;
  }
  return n;
}

/** The landing spot with the fewest enemies around it, clear of boulders and trees; null if all are blocked. */
function openSpot(world: World, def: TeleportDef): { x: number; y: number } | null {
  const p = world.player;
  let best: { x: number; y: number } | null = null;
  let bestCount = Infinity;
  for (let i = 0; i < DIRECTIONS; i++) {
    const a = (i / DIRECTIONS) * Math.PI * 2;
    const x = p.x + Math.cos(a) * def.blinkPx;
    const y = p.y + Math.sin(a) * def.blinkPx;
    if (hitsObstacle(world, x, y, p.radius)) continue;
    const count = enemiesNear(world, x, y, def.surroundRadius * 1.5);
    if (count < bestCount) {
      bestCount = count;
      best = { x, y };
    }
  }
  return best;
}

function blink(world: World, def: TeleportDef): void {
  const p = world.player;
  p.blinkFromX = p.x;
  p.blinkFromY = p.y;
  p.x = p.blinkToX;
  p.y = p.blinkToY;
  p.teleportLeft = def.recharge;
  emit(world, 'teleport', 1);
  if (!def.echo) return;
  // Psychic Echo: a proc burst where you were (it triggers nothing but the `echo` hook).
  const radius = def.echo.radius;
  const damage = (world.moves[0]?.stats.damage ?? 0) * def.echo.signatureHitMult;
  const hit = procHit('Psychic');
  queryEnemies(world, p.blinkFromX, p.blinkFromY, radius, neighbours);
  for (const j of [...neighbours]) {
    const e = world.enemies[j]!;
    if (e.hp > 0 && (e.x - p.blinkFromX) ** 2 + (e.y - p.blinkFromY) ** 2 <= (radius + e.radius) ** 2) damageEnemy(world, e, damage, hit);
  }
  world.blasts.push({ x: p.blinkFromX, y: p.blinkFromY, radius, lifeLeft: BLAST_SECONDS * 2, type: 'Psychic' });
  p.echoX = p.blinkFromX;
  p.echoY = p.blinkFromY;
  emit(world, 'echo', 1);
}

/** Per step, while the spatial hash is current. */
export function updateTeleport(world: World, dt: number): void {
  const p = world.player;
  p.barrierLeft = Math.max(0, p.barrierLeft - dt);
  const def = ABILITIES[p.ability].teleport;
  if (!def) return;
  p.teleportLeft = Math.max(0, p.teleportLeft - dt);
  if (p.blinkLeft > 0) {
    p.blinkLeft -= dt;
    if (p.blinkLeft <= 0) blink(world, def);
    return;
  }
  if (p.teleportLeft > 0 || enemiesNear(world, p.x, p.y, def.surroundRadius) < def.surroundCount) return;
  const spot = openSpot(world, def);
  if (!spot) {
    p.teleportLeft = RETRY_SECONDS;
    return;
  }
  p.blinkToX = spot.x;
  p.blinkToY = spot.y;
  p.blinkLeft = def.telegraph;
}
