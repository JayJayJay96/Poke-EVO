import { PLAYER_STATUS, type PlayerStatusId } from '../data/playerStatus';
import { currentStage } from './stats';
import { powderMult, statusMult } from './statusResist';
import type { World } from './types';
import { drainPlayer } from './world';

// Statuses on the player (D36, README §10). Enemies and bosses call `applyPlayerStatus`; `step` ticks them and
// movement reads `playerStatusSlow`. Never a stun: the worst is paralysis's 0.2 s stutter.

export interface ApplyOptions {
  /** Poison: the hit that applied it (its DoT is a fraction of this per second). */
  readonly hit?: number;
  /** Overrides the default duration. */
  readonly seconds?: number;
  /** A powder (Poison Powder…): Grass starters shrug it off. */
  readonly powder?: boolean;
}

/** Lands a status on the player, resisted by their stage's types; nothing while that status is fatigued. */
export function applyPlayerStatus(world: World, id: PlayerStatusId, opts: ApplyOptions = {}): boolean {
  const s = world.playerStatus;
  if (s.fatigue[id] > 0) return false;
  const types = currentStage(world).types;
  const mult = statusMult(types, id) * (opts.powder ? powderMult(types) : 1);
  const seconds = opts.seconds ?? PLAYER_STATUS[id].seconds;
  if (id === 'poison') {
    // A DoT: resistance scales its damage, not its length (README §2).
    s.poisonDps = Math.max(s.poisonLeft > 0 ? s.poisonDps : 0, (opts.hit ?? 0) * PLAYER_STATUS.poison.dpsFraction * mult);
    if (s.poisonLeft <= 0) s.poisonTick = PLAYER_STATUS.poison.tick;
    s.poisonLeft = Math.max(s.poisonLeft, seconds);
  } else if (id === 'burn') {
    s.burnDps = Math.max(s.burnLeft > 0 ? s.burnDps : 0, (opts.hit ?? 0) * PLAYER_STATUS.burn.dpsFraction * mult);
    if (s.burnLeft <= 0) s.burnTick = PLAYER_STATUS.burn.tick;
    s.burnLeft = Math.max(s.burnLeft, seconds);
  } else if (id === 'paralysis') {
    const d = seconds * mult;
    if (d <= s.paraLeft) return false;
    s.paraLeft = d;
    s.paraTotal = d;
  } else if (id === 'slow') s.slowLeft = Math.max(s.slowLeft, seconds * mult);
  else if (id === 'confusion') s.confuseLeft = Math.max(s.confuseLeft, seconds * mult);
  else s.soakLeft = Math.max(s.soakLeft, seconds * mult);
  return true;
}

/** Counts statuses down, ticks poison, and starts each status's fatigue as it ends. */
export function updatePlayerStatus(world: World, dt: number): void {
  const s = world.playerStatus;
  for (const id of Object.keys(s.fatigue) as PlayerStatusId[]) s.fatigue[id] = Math.max(0, s.fatigue[id] - dt);
  const tick = (left: number, id: PlayerStatusId): number => {
    if (left <= 0) return 0;
    const next = left - dt;
    if (next <= 0) s.fatigue[id] = PLAYER_STATUS.fatigue;
    return Math.max(0, next);
  };
  if (s.poisonLeft > 0) {
    s.poisonTick -= dt;
    if (s.poisonTick <= 0) {
      s.poisonTick += PLAYER_STATUS.poison.tick;
      drainPlayer(world, s.poisonDps * PLAYER_STATUS.poison.tick);
    }
  }
  if (s.burnLeft > 0) {
    s.burnTick -= dt;
    if (s.burnTick <= 0) {
      s.burnTick += PLAYER_STATUS.burn.tick;
      drainPlayer(world, s.burnDps * PLAYER_STATUS.burn.tick);
    }
  }
  s.poisonLeft = tick(s.poisonLeft, 'poison');
  s.burnLeft = tick(s.burnLeft, 'burn');
  s.slowLeft = tick(s.slowLeft, 'slow');
  s.paraLeft = tick(s.paraLeft, 'paralysis');
  s.confuseLeft = tick(s.confuseLeft, 'confusion');
  s.soakLeft = tick(s.soakLeft, 'soaked');
}

/** The movement slow from statuses: the strongest wins (they don't stack), capped, except paralysis's stutter. */
export function playerStatusSlow(world: World): number {
  const s = world.playerStatus;
  const { paralysis, slowCap } = PLAYER_STATUS;
  if (s.paraLeft > 0 && s.paraTotal - s.paraLeft < paralysis.stutter) return paralysis.stutterSlow;
  const slow = Math.max(
    s.slowLeft > 0 ? PLAYER_STATUS.slow.slow : 0,
    s.paraLeft > 0 ? paralysis.slow : 0,
    s.soakLeft > 0 ? PLAYER_STATUS.soaked.slow : 0,
  );
  return Math.min(slowCap, slow);
}

/** A fresh, status-free player state. */
export function emptyPlayerStatus(): World['playerStatus'] {
  return {
    poisonLeft: 0,
    poisonDps: 0,
    poisonTick: 0,
    burnLeft: 0,
    burnDps: 0,
    burnTick: 0,
    slowLeft: 0,
    paraLeft: 0,
    paraTotal: 0,
    confuseLeft: 0,
    soakLeft: 0,
    fatigue: { poison: 0, burn: 0, slow: 0, paralysis: 0, confusion: 0, soaked: 0 },
  };
}
