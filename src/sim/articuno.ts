import { ARTICUNO_KIT } from '../data/arena';
import { insideArena, leadAim, strike } from './bosses';
import { BLAST_SECONDS } from './forms/projectile';
import { applyPlayerStatus } from './playerStatus';
import { currentStage } from './stats';
import type { ArenaFight, ArenaRock, ArticunoMove, ArticunoState, Enemy, World } from './types';

// Articuno (D45, BOSSES.md §4): "cover that your own fire melts". It hovers at range; ice pillars are the cover
// (only Fire wears them down, so a Fire player's own shots melt it). Every aimed attack locks when its telegraph
// appears (BOSSES.md §2). Every number lives in ARTICUNO_KIT.

const DEG = Math.PI / 180;
type Cooldown = keyof ArticunoState['cooldowns'];

function newPillar(boss: Enemy, x: number, y: number): ArenaRock {
  const { radius, hpPct } = ARTICUNO_KIT.pillars;
  return { x, y, radius, left: Infinity, hp: boss.maxHp * hpPct, onlyType: 'Fire' };
}

/** Articuno's opening state: phase 1 and its ring of ice pillars (rubble that only Fire wears down). */
export function startArticuno(fight: ArenaFight, boss: Enemy): ArticunoState {
  const kit = ARTICUNO_KIT;
  const art: ArticunoState = {
    phase: 1,
    transitionLeft: 0,
    moveGap: 0,
    lastMove: null,
    cooldowns: {
      iceShard: kit.iceShard.firstAfter,
      blizzard: kit.blizzard.firstAfter,
      icyWind: kit.icyWind.firstAfter,
      iceBeam: kit.iceBeam.firstAfter,
      freezeDry: kit.freezeDry.firstAfter,
      reflect: kit.reflect.firstAfter,
      whirlwind: kit.whirlwind.firstAfter,
      hurricane: kit.hurricane.firstAfter,
    },
    roostPhase: 0,
    phaseStartHp: boss.maxHp,
    roost: null,
    pillars: [],
    cast: null,
    shards: [],
    crescents: [],
    blizzard: null,
    beam: null,
    strips: [],
    freezeDry: null,
    mistLeft: 0,
    mistTimer: 0,
    reflectLeft: 0,
    armour: null,
    armourReform: 0,
    armourReformed: false,
    whirl: null,
    hurricane: null,
  };
  const { count, ringFraction } = kit.pillars;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / count;
    const x = fight.x + Math.cos(a) * fight.radius * ringFraction;
    const y = fight.y + Math.sin(a) * fight.radius * ringFraction;
    const rock = newPillar(boss, x, y);
    fight.rubble.push(rock);
    art.pillars.push({ x, y, rock, regrow: 0 });
  }
  return art;
}

/**
 * Whether (x, y) is in a standing pillar's shadow from a Blizzard sweeping along (dx, dy): downwind of it, within
 * its width, up to `shadow` px behind it. Shared by the hit test and the drawing, so what looks safe is safe.
 */
export function blizzardShelter(art: ArticunoState, dx: number, dy: number, x: number, y: number): boolean {
  for (const p of art.pillars) {
    const r = p.rock;
    if (!r) continue;
    const ox = x - r.x;
    const oy = y - r.y;
    const along = ox * dx + oy * dy;
    if (along > 0 && along <= ARTICUNO_KIT.blizzard.shadow && Math.abs(ox * dy - oy * dx) <= r.radius) return true;
  }
  return false;
}

function playerIn(world: World, x: number, y: number, radius: number): boolean {
  return Math.hypot(world.player.x - x, world.player.y - y) <= radius + world.player.radius;
}

function onSegment(world: World, x1: number, y1: number, x2: number, y2: number, width: number): boolean {
  const { player } = world;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((player.x - x1) * dx + (player.y - y1) * dy) / len2));
  return Math.hypot(player.x - (x1 + dx * t), player.y - (y1 + dy * t)) <= width / 2 + player.radius;
}

/** Moves the player by (mx, my), kept inside the arena (Whirlwind's push, Hurricane's pull: never a stun). */
function shove(world: World, fight: ArenaFight, mx: number, my: number): void {
  const { player } = world;
  const to = insideArena(fight, player.x + mx, player.y + my, player.radius);
  player.x = to.x;
  player.y = to.y;
}

/** Pillars: a melted one is gone (and stops sheltering) until it regrows. */
function updatePillars(fight: ArenaFight, art: ArticunoState, boss: Enemy, dt: number): void {
  for (const p of art.pillars) {
    if (p.rock && p.rock.hp !== undefined && p.rock.hp <= 0) {
      fight.rubble.splice(fight.rubble.indexOf(p.rock), 1);
      p.rock = null;
      p.regrow = ARTICUNO_KIT.pillars.regrow;
    } else if (!p.rock) {
      p.regrow -= dt;
      if (p.regrow <= 0) {
        p.rock = newPillar(boss, p.x, p.y);
        fight.rubble.push(p.rock);
      }
    }
  }
}

/** Ice Shard fans and their splinters: a shard hitting a pillar splits into 3 past it; splinters ignore pillars. */
function updateShards(world: World, fight: ArenaFight, art: ArticunoState, boss: Enemy, dt: number): void {
  const { split } = ARTICUNO_KIT.iceShard;
  const born: ArticunoState['shards'] = [];
  for (const s of art.shards) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.left -= dt;
    if (playerIn(world, s.x, s.y, s.radius)) {
      strike(world, boss, s.factor);
      s.left = 0;
      continue;
    }
    if (Math.hypot(s.x - fight.x, s.y - fight.y) >= fight.radius - s.radius) s.left = 0;
    if (s.split || s.left <= 0) continue;
    const pillar = art.pillars.find((p) => p.rock && Math.hypot(s.x - p.x, s.y - p.y) <= p.rock.radius + s.radius);
    if (!pillar) continue;
    const heading = Math.atan2(s.vy, s.vx);
    const far = pillar.rock!.radius + split.radius + 2;
    for (let i = 0; i < split.count; i++) {
      const a = heading + (i - (split.count - 1) / 2) * split.spreadDeg * DEG;
      born.push({
        x: pillar.x + Math.cos(heading) * far,
        y: pillar.y + Math.sin(heading) * far,
        vx: Math.cos(a) * split.speed,
        vy: Math.sin(a) * split.speed,
        radius: split.radius,
        left: split.life,
        factor: split.damageFactor,
        split: true,
      });
    }
    s.left = 0;
  }
  art.shards = art.shards.filter((s) => s.left > 0).concat(born);
}

/** Icy Wind crescents: out, then back to Articuno; each pass hits once and slows. */
function updateCrescents(world: World, art: ArticunoState, boss: Enemy, dt: number): void {
  const s = ARTICUNO_KIT.icyWind;
  for (const c of art.crescents) {
    c.left -= dt;
    if (!c.returning && c.left <= 0) {
      c.returning = true;
      c.hit = false;
    }
    if (c.returning) {
      const a = Math.atan2(boss.y - c.y, boss.x - c.x);
      c.vx = Math.cos(a) * s.speed;
      c.vy = Math.sin(a) * s.speed;
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (!c.hit && playerIn(world, c.x, c.y, s.radius)) {
      c.hit = true;
      if (strike(world, boss, s.damageFactor)) applyPlayerStatus(world, 'slow', { seconds: s.slowSeconds });
    }
  }
  art.crescents = art.crescents.filter((c) => !(c.returning && Math.hypot(c.x - boss.x, c.y - boss.y) <= boss.radius));
}

/** Blizzard: the warning, then the front sweeps across; it checks you as it passes (sheltered or not). */
function updateBlizzard(world: World, fight: ArenaFight, art: ArticunoState, boss: Enemy, dt: number): void {
  const s = ARTICUNO_KIT.blizzard;
  const { player } = world;
  const bz = art.blizzard!;
  bz.left -= dt;
  if (bz.phase === 'warning') {
    if (bz.left <= 0) {
      bz.phase = 'sweep';
      bz.left = s.sweep;
      bz.front = -fight.radius;
    }
    return;
  }
  bz.front = -fight.radius + 2 * fight.radius * Math.min(1, 1 - bz.left / s.sweep);
  const mine = (player.x - fight.x) * bz.dx + (player.y - fight.y) * bz.dy;
  if (!bz.checked && bz.front >= mine) {
    bz.checked = true;
    if (!blizzardShelter(art, bz.dx, bz.dy, player.x, player.y) && strike(world, boss, s.damageFactor)) {
      applyPlayerStatus(world, 'slow', { seconds: s.slowSeconds });
    }
  }
  if (bz.left <= 0) art.blizzard = null;
}

function updateBeam(world: World, art: ArticunoState, boss: Enemy, dt: number): void {
  const s = ARTICUNO_KIT.iceBeam;
  const beam = art.beam!;
  beam.left -= dt;
  if (beam.left > 0) return;
  if (beam.phase === 'windup') {
    const x2 = beam.x + Math.cos(beam.angle) * s.length;
    const y2 = beam.y + Math.sin(beam.angle) * s.length;
    if (onSegment(world, beam.x, beam.y, x2, y2, s.width)) strike(world, boss, s.damageFactor);
    art.strips.push({ x1: beam.x, y1: beam.y, x2, y2, left: s.strip.seconds });
    beam.phase = 'recover';
    beam.left = s.recover;
  } else {
    art.beam = null;
  }
}

/** Freeze-Dry: a ring on your spot per beat, the gaps shrinking; Water starters take more (lore). */
function updateFreezeDry(world: World, art: ArticunoState, boss: Enemy, dt: number): void {
  const s = ARTICUNO_KIT.freezeDry;
  const fd = art.freezeDry!;
  fd.left -= dt;
  if (fd.left > 0) return;
  world.blasts.push({ x: fd.x, y: fd.y, radius: s.radius, lifeLeft: BLAST_SECONDS, type: 'Ice' });
  if (playerIn(world, fd.x, fd.y, s.radius)) {
    const water = currentStage(world).types.includes('Water');
    strike(world, boss, s.damageFactor * (water ? s.waterMult : 1));
  }
  fd.index++;
  if (fd.index >= s.gaps.length) {
    art.freezeDry = null;
    return;
  }
  fd.x = world.player.x;
  fd.y = world.player.y;
  fd.left = s.gaps[fd.index]!;
}

/** Whirlwind: a gust line toward you; caught, you're pushed away over a moment (a push, never a stun). */
function updateWhirl(world: World, fight: ArenaFight, art: ArticunoState, boss: Enemy, dt: number): void {
  const s = ARTICUNO_KIT.whirlwind;
  const w = art.whirl!;
  w.left -= dt;
  if (w.phase === 'push') {
    shove(world, fight, w.vx * dt, w.vy * dt);
    if (w.left <= 0) art.whirl = null;
    return;
  }
  if (w.left > 0) return;
  const x2 = boss.x + Math.cos(w.angle) * s.length;
  const y2 = boss.y + Math.sin(w.angle) * s.length;
  if (onSegment(world, boss.x, boss.y, x2, y2, s.width)) {
    strike(world, boss, s.damageFactor);
    art.whirl = { angle: w.angle, left: s.pushSeconds, phase: 'push', vx: (Math.cos(w.angle) * s.push) / s.pushSeconds, vy: (Math.sin(w.angle) * s.push) / s.pushSeconds };
  } else {
    art.whirl = null;
  }
}

/** Hurricane: the tornado drifts across, pulling you gently toward it; touching it hurts every so often. */
function updateHurricane(world: World, fight: ArenaFight, art: ArticunoState, boss: Enemy, dt: number): void {
  const s = ARTICUNO_KIT.hurricane;
  const { player } = world;
  const h = art.hurricane!;
  h.left -= dt;
  h.hitTimer -= dt;
  const at = insideArena(fight, h.x + h.vx * dt, h.y + h.vy * dt, s.radius);
  h.x = at.x;
  h.y = at.y;
  const d = Math.hypot(h.x - player.x, h.y - player.y);
  if (d > 0 && d <= s.pullRange) shove(world, fight, ((h.x - player.x) / d) * Math.min(d, s.pull * dt), ((h.y - player.y) / d) * Math.min(d, s.pull * dt));
  if (h.hitTimer <= 0 && playerIn(world, h.x, h.y, s.radius)) {
    strike(world, boss, s.damageFactor);
    h.hitTimer = s.hitEvery;
  }
  if (h.left <= 0) art.hurricane = null;
}

/** Picks the next move by weight among those ready and unlocked for the phase, never the same twice in a row. */
function pickArticunoMove(world: World, fight: ArenaFight, art: ArticunoState, boss: Enemy): void {
  const kit = ARTICUNO_KIT;
  const { player } = world;
  const cd = art.cooldowns;
  const toPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
  const distance = Math.hypot(player.x - boss.x, player.y - boss.y);
  const ready: { id: ArticunoMove; begin: () => void }[] = [];
  const add = (id: ArticunoMove, ok: boolean, begin: () => void): void => {
    if (ok && (id === 'roost' || cd[id as Cooldown] <= 0)) ready.push({ id, begin });
  };
  add('iceShard', true, () => (art.cast = { move: 'iceShard', left: kit.iceShard.cast }));
  add('blizzard', !art.blizzard, () => {
    const a = world.rng.next() * Math.PI * 2;
    art.blizzard = { dx: Math.cos(a), dy: Math.sin(a), left: kit.blizzard.warning, phase: 'warning', front: -fight.radius, checked: false };
  });
  add('icyWind', art.crescents.length === 0, () => (art.cast = { move: 'icyWind', left: kit.icyWind.cast }));
  add('iceBeam', true, () => (art.beam = { x: boss.x, y: boss.y, angle: toPlayer, left: kit.iceBeam.telegraph, phase: 'windup' }));
  add('roost', art.roostPhase !== art.phase && boss.hp <= art.phaseStartHp - boss.maxHp * kit.roost.afterPct, () => {
    art.roost = { left: kit.roost.seconds };
  });
  add('freezeDry', art.phase >= 2 && !art.freezeDry, () => {
    art.freezeDry = { x: player.x, y: player.y, index: 0, left: kit.freezeDry.gaps[0] };
  });
  add('reflect', art.phase >= 2 && art.reflectLeft <= 0, () => {
    const s = kit.reflect;
    const cx = boss.x + Math.cos(toPlayer) * s.distance;
    const cy = boss.y + Math.sin(toPlayer) * s.distance;
    const px = -Math.sin(toPlayer) * s.halfLength;
    const py = Math.cos(toPlayer) * s.halfLength;
    fight.wall = { x1: cx - px, y1: cy - py, x2: cx + px, y2: cy + py, mult: s.mult };
    art.reflectLeft = s.seconds;
  });
  add('whirlwind', art.phase >= 3 && distance <= kit.whirlwind.length, () => {
    art.whirl = { angle: toPlayer, left: kit.whirlwind.telegraph, phase: 'windup', vx: 0, vy: 0 };
  });
  add('hurricane', art.phase >= 3 && !art.hurricane, () => {
    // From the far side of the arena, drifting across toward where you are.
    const from = Math.atan2(player.y - fight.y, player.x - fight.x) + Math.PI;
    const x = fight.x + Math.cos(from) * fight.radius * 0.8;
    const y = fight.y + Math.sin(from) * fight.radius * 0.8;
    const a = Math.atan2(player.y - y, player.x - x);
    art.hurricane = { x, y, vx: Math.cos(a) * kit.hurricane.speed, vy: Math.sin(a) * kit.hurricane.speed, left: kit.hurricane.seconds, hitTimer: 0 };
  });
  const pool = ready.length > 1 ? ready.filter((m) => m.id !== art.lastMove) : ready;
  if (pool.length === 0) return;
  let roll = pool.length === 1 ? 0 : world.rng.next() * pool.reduce((sum, m) => sum + kit.weights[m.id], 0);
  const pick = pool.find((m) => (roll -= kit.weights[m.id]) < 0) ?? pool[pool.length - 1]!;
  pick.begin();
  if (pick.id !== 'roost') cd[pick.id] = kit[pick.id].cooldown;
  art.lastMove = pick.id;
  art.moveGap = kit.moveGap;
}

function fireCast(world: World, fight: ArenaFight, art: ArticunoState, boss: Enemy, move: 'iceShard' | 'icyWind'): void {
  const { player } = world;
  if (move === 'iceShard') {
    const s = ARTICUNO_KIT.iceShard;
    const spot = leadAim(world, fight, 0.6, 1, 0);
    const aim = Math.atan2(spot.y - boss.y, spot.x - boss.x);
    for (let i = 0; i < s.shards; i++) {
      const a = aim + (i - (s.shards - 1) / 2) * (s.spreadDeg / (s.shards - 1)) * DEG;
      const speed = s.speeds[i % s.speeds.length]!;
      art.shards.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, radius: s.radius, left: s.life, factor: s.damageFactor, split: false });
    }
  } else {
    const s = ARTICUNO_KIT.icyWind;
    const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
    for (let i = 0; i < s.crescents; i++) {
      const a = aim + (i - (s.crescents - 1) / 2) * s.spreadDeg * DEG;
      art.crescents.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, left: s.out, returning: false, hit: false });
    }
  }
}

/**
 * Articuno (BOSSES.md §4, D45): hovers at range; phases at 66% and 33% start with an immune Mist and Freeze-over.
 * Immune only during those animations; Roost is the damage window (it loses Flying). Pressure is in world.ts.
 */
export function articuno(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const kit = ARTICUNO_KIT;
  const art = fight.artic!;
  const { player } = world;
  art.moveGap -= dt;
  for (const id of Object.keys(art.cooldowns) as Cooldown[]) art.cooldowns[id] -= dt;
  updatePillars(fight, art, boss, dt);
  updateShards(world, fight, art, boss, dt);
  updateCrescents(world, art, boss, dt);
  if (art.freezeDry) updateFreezeDry(world, art, boss, dt);
  if (art.hurricane) updateHurricane(world, fight, art, boss, dt);
  // Frozen strips slow you while you stand on one (applied to the next step's movement, like Yawn).
  for (const s of art.strips) s.left -= dt;
  art.strips = art.strips.filter((s) => s.left > 0);
  const { strip } = kit.iceBeam;
  fight.playerSlow = art.strips.some((s) => onSegment(world, s.x1, s.y1, s.x2, s.y2, strip.width)) ? strip.slow : 0;
  // Reflect's wall stands for a while; Articuno holds its place meanwhile.
  if (art.reflectLeft > 0) {
    art.reflectLeft -= dt;
    if (art.reflectLeft <= 0) fight.wall = null;
  }
  // Mist (phase 2+): a few seconds in every `every` with no status landing (combat.ts).
  art.mistLeft -= dt;
  if (art.phase >= 2) {
    art.mistTimer -= dt;
    if (art.mistTimer <= 0) {
      art.mistTimer = kit.mist.every;
      art.mistLeft = kit.mist.seconds;
    }
  }
  // Sheer Cold armour (phase 3): broken by super-effective damage (combat.ts counts it); it reforms once.
  if (art.armour && art.armour.taken >= boss.maxHp * kit.sheerCold.breakPct) {
    art.armour = null;
    if (!art.armourReformed) art.armourReform = kit.sheerCold.reformAfter;
  } else if (!art.armour && art.armourReform > 0) {
    art.armourReform -= dt;
    if (art.armourReform <= 0) {
      art.armour = { taken: 0 };
      art.armourReformed = true;
    }
  }

  fight.goal = null;
  if (art.transitionLeft > 0) {
    art.transitionLeft -= dt;
  } else if (art.blizzard) {
    updateBlizzard(world, fight, art, boss, dt);
  } else if (art.cast) {
    art.cast.left -= dt;
    if (art.cast.left <= 0) {
      fireCast(world, fight, art, boss, art.cast.move);
      art.cast = null;
    }
  } else if (art.beam) {
    updateBeam(world, art, boss, dt);
  } else if (art.whirl) {
    updateWhirl(world, fight, art, boss, dt);
  } else if (art.roost) {
    art.roost.left -= dt;
    boss.hp = Math.min(boss.maxHp, boss.hp + ((boss.maxHp * kit.roost.healPct) / kit.roost.seconds) * dt);
    if (art.roost.left <= 0) {
      art.roost = null;
      art.roostPhase = art.phase;
    }
  } else if (art.phase <= kit.phaseAt.length && boss.hp <= boss.maxHp * kit.phaseAt[art.phase - 1]!) {
    // Next phase: an immune animation (the phase gate held HP here until now).
    art.phase++;
    art.transitionLeft = kit.transitionSeconds;
    art.phaseStartHp = boss.hp;
    if (art.phase === 2) art.mistTimer = kit.transitionSeconds;
    if (art.phase === 3) art.armour = { taken: 0 };
    world.arenaNotice = { kind: art.phase === 2 ? 'mist' : 'freezeOver', bossId: fight.bossId };
  } else {
    // Free: hover at range, drifting sideways, and pick a move.
    const away = Math.atan2(boss.y - player.y, boss.x - player.x) + kit.hover.strafeDeg * DEG;
    fight.goal = insideArena(fight, player.x + Math.cos(away) * kit.hover.distance, player.y + Math.sin(away) * kit.hover.distance, boss.radius);
    if (art.moveGap <= 0) pickArticunoMove(world, fight, art, boss);
  }

  const busy = art.transitionLeft > 0 || art.blizzard || art.cast || art.beam || art.whirl?.phase === 'windup' || art.roost;
  if (busy) {
    fight.goal = null;
    art.moveGap = Math.max(art.moveGap, kit.moveGap);
  }
  boss.speed = busy || art.reflectLeft > 0 ? 0 : fight.bossSpeed;
}
