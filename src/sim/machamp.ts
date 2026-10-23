import { MACHAMP_KIT } from '../data/arena';
import { addRubble, inCone, insideArena, leadAim, strike } from './bosses';
import { BLAST_SECONDS } from './forms/projectile';
import { applyPlayerStatus } from './playerStatus';
import type { ArenaFight, Enemy, MachampMove, MachampState, World } from './types';
import { hitPlayer, spawnEnemy } from './world';

// Machamp (D42, BOSSES.md §4): attack, attack, pose. Every aimed attack locks when its telegraph appears; cones
// start only when a standing player is fully inside them (BOSSES.md §2). Every number lives in MACHAMP_KIT.

type Follow = NonNullable<MachampState['rock']>['follow'];
type Rock = NonNullable<MachampState['rock']>;

function rollPoseAfter(world: World): number {
  const [min, max] = MACHAMP_KIT.pose.every;
  return min + Math.floor(world.rng.next() * (max - min + 1));
}

/** Machamp's opening state: phase 1, nothing in progress. */
export function startMachamp(world: World): MachampState {
  const kit = MACHAMP_KIT;
  return {
    phase: 1,
    transitionLeft: 0,
    moveGap: 0,
    lastMove: null,
    cooldowns: {
      karateChop: kit.karateChop.firstAfter,
      crossChop: kit.crossChop.firstAfter,
      lowSweep: kit.lowSweep.firstAfter,
      rockTomb: kit.rockTomb.firstAfter,
      seismicToss: kit.seismicToss.firstAfter,
      rock: kit.rock.firstAfter,
      bulletPunch: kit.bulletPunch.firstAfter,
      dynamicPunch: kit.dynamicPunch.firstAfter,
      focusBlast: kit.focusBlast.firstAfter,
      focusPunch: kit.focusPunch.firstAfter,
      closeCombat: kit.closeCombat.firstAfter,
    },
    attacks: 0,
    poseAfter: rollPoseAfter(world),
    bulk: 0,
    pose: null,
    staggerLeft: 0,
    openLeft: 0,
    chops: null,
    crossChop: null,
    sweep: null,
    toss: null,
    tombs: [],
    rock: null,
    lastFollow: null,
    lob: null,
    boulders: [],
    bullet: null,
    dynamic: null,
    blastCast: 0,
    orbs: [],
    focus: null,
  };
}

/** Machamp's hit: each Bulk Up stack adds damage, and Guts while it carries a status you put on it. */
function punch(world: World, champ: MachampState, boss: Enemy, factor: number): boolean {
  const { pose, guts } = MACHAMP_KIT;
  const statused = boss.burnLeft > 0 || boss.poisonLeft > 0 || boss.seedLeft > 0 || boss.slowLeft > 0 || boss.stunLeft > 0;
  return strike(world, boss, factor * (1 + champ.bulk * pose.stackDamage) * (statused ? guts : 1));
}

function playerIn(world: World, x: number, y: number, radius: number): boolean {
  return Math.hypot(world.player.x - x, world.player.y - y) <= radius + world.player.radius;
}

/** Whether the player touches the segment (x1, y1)–(x2, y2) of the given width. */
function onSegment(world: World, x1: number, y1: number, x2: number, y2: number, width: number): boolean {
  const { player } = world;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((player.x - x1) * dx + (player.y - y1) * dy) / len2));
  return Math.hypot(player.x - (x1 + dx * t), player.y - (y1 + dy * t)) <= width / 2 + player.radius;
}

/** The two arms of Cross Chop's X: segments through (x, y) at ±45° to its leap direction. */
export function crossArms(x: number, y: number, angle: number): [number, number, number, number][] {
  const half = MACHAMP_KIT.crossChop.arm / 2;
  return [angle + Math.PI / 4, angle - Math.PI / 4].map((a) => [x - Math.cos(a) * half, y - Math.sin(a) * half, x + Math.cos(a) * half, y + Math.sin(a) * half]);
}

/** A move finished: its cooldown starts and it counts toward the next pose. */
function endMove(champ: MachampState, id: MachampMove): void {
  champ.cooldowns[id] = id === 'rock' ? MACHAMP_KIT.rock.cooldown : MACHAMP_KIT[id].cooldown;
  champ.attacks++;
}

// ── The rock in hand ────────────────────────────────────────────────────

/** Takes the nearest loose rock in reach (a quick grab), else rips one from the ground (slower). */
function startRock(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy): void {
  const { rock } = MACHAMP_KIT;
  let best = -1;
  let bestD: number = rock.grabRange;
  fight.rubble.forEach((r, i) => {
    const d = Math.hypot(r.x - boss.x, r.y - boss.y);
    if (r.hp === undefined && d <= bestD) {
      best = i;
      bestD = d;
    }
  });
  const grabbed = best >= 0;
  if (grabbed) fight.rubble.splice(best, 1);
  champ.rock = { stone: null, left: grabbed ? rock.grab : rock.rip, phase: grabbed ? 'grab' : 'rip', follow: 'throw', heading: 0, charged: 0, angle: 0, tx: 0, ty: 0 };
  if (!grabbed) world.blasts.push({ x: boss.x, y: boss.y, radius: boss.radius + 10, lifeLeft: BLAST_SECONDS, type: 'Rock' });
}

/** The follow-up by weight (Iron Pose is rarer), never the same one twice in a row. */
function rollFollow(world: World, champ: MachampState): Follow {
  const { weights, ironWeightPhase3 } = MACHAMP_KIT.rock;
  const w: Record<Follow, number> = { throw: weights.throw, strength: weights.strength, iron: champ.phase >= 3 ? ironWeightPhase3 : weights.iron };
  const pool = (Object.keys(w) as Follow[]).filter((f) => f !== champ.lastFollow);
  let roll = world.rng.next() * pool.reduce((sum, f) => sum + w[f], 0);
  return pool.find((f) => (roll -= w[f]) < 0) ?? pool[pool.length - 1]!;
}

/** Drops the held rock where it is as ordinary rubble (Iron Pose over), or removes it (thrown, shoved, broken). */
function releaseStone(fight: ArenaFight, rock: Rock, keep: boolean): void {
  const stone = rock.stone;
  if (!stone) return;
  if (keep) {
    delete stone.hp;
    stone.left = MACHAMP_KIT.rockThrow.stay;
  } else {
    fight.rubble.splice(fight.rubble.indexOf(stone), 1);
  }
  rock.stone = null;
}

function updateRock(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const kit = MACHAMP_KIT;
  const { player } = world;
  const rock = champ.rock!;
  const toPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
  rock.left -= dt;

  if (rock.phase === 'charge') {
    // Strength: momentum builds while it turns slowly toward you; a sharp sidestep shakes it, running straight doesn't.
    const s = kit.strength;
    rock.charged += dt;
    let turn = toPlayer - rock.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    rock.heading += Math.max(-s.turnRate * dt, Math.min(s.turnRate * dt, turn));
    const ramp = Math.min(1, rock.charged / s.rampSeconds);
    const speed = fight.bossSpeed * (s.startMult + (s.endMult - s.startMult) * ramp);
    const next = insideArena(fight, boss.x + Math.cos(rock.heading) * speed * dt, boss.y + Math.sin(rock.heading) * speed * dt, boss.radius);
    boss.x = next.x;
    boss.y = next.y;
    if (Math.hypot(player.x - boss.x, player.y - boss.y) <= s.plantWithin || rock.charged >= s.maxCharge) {
      rock.phase = 'plant';
      rock.left = s.telegraph;
      rock.angle = toPlayer; // locked (lead 0)
    }
  }
  // The held rock sits in front of it: along the charge, the locked line, or toward you.
  const stone = rock.stone;
  if (stone && rock.follow !== 'iron') {
    const face = rock.phase === 'charge' ? rock.heading : rock.phase === 'plant' ? rock.angle : toPlayer;
    stone.x = boss.x + Math.cos(face) * (boss.radius + stone.radius * 0.6);
    stone.y = boss.y + Math.sin(face) * (boss.radius + stone.radius * 0.6);
  }
  if (rock.left > 0 || rock.phase === 'charge') return;

  if (rock.phase === 'grab' || rock.phase === 'rip') {
    const s = { x: boss.x, y: boss.y, radius: kit.rock.radius, left: Infinity, hp: boss.maxHp * kit.rock.shieldHpPct };
    fight.rubble.push(s);
    rock.stone = s;
    rock.phase = 'tell';
    rock.left = kit.rock.tell;
    rock.follow = rollFollow(world, champ);
    champ.lastFollow = rock.follow;
  } else if (rock.phase === 'tell') {
    if (rock.follow === 'throw') {
      const spot = leadAim(world, fight, kit.rockThrow.telegraph, kit.rockThrow.lead, kit.rockThrow.radius);
      champ.lob = { fx: rock.stone!.x, fy: rock.stone!.y, tx: spot.x, ty: spot.y, left: kit.rockThrow.telegraph };
      releaseStone(fight, rock, false);
      rock.phase = 'recover';
      rock.left = 0.4;
    } else if (rock.follow === 'strength') {
      rock.phase = 'charge';
      rock.heading = toPlayer;
      rock.charged = 0;
    } else {
      // Iron Pose: the rock stays planted in front; the pose runs it (before this in the chain).
      rock.phase = 'recover';
      rock.left = 0;
      champ.pose = { left: champ.phase >= 3 ? kit.pose.secondsPhase3 : kit.pose.seconds, taken: 0, iron: true };
      champ.attacks = 0;
      champ.poseAfter = rollPoseAfter(world);
    }
  } else if (rock.phase === 'plant') {
    // Shove: the rock breaks into boulders rolling along the locked line, one after another.
    const s = kit.strength;
    const n = champ.phase >= 3 ? s.bouldersPhase3 : s.boulders;
    const ux = Math.cos(rock.angle);
    const uy = Math.sin(rock.angle);
    for (let i = 0; i < n; i++) {
      champ.boulders.push({ x: boss.x + ux * (boss.radius + s.radius), y: boss.y + uy * (boss.radius + s.radius), vx: ux * s.speed, vy: uy * s.speed, wait: i * s.gap, hit: false });
    }
    releaseStone(fight, rock, false);
    rock.phase = 'recover';
    rock.left = s.recover;
  } else if (rock.phase === 'recover' && !champ.pose) {
    releaseStone(fight, rock, true);
    champ.rock = null;
    endMove(champ, 'rock');
  }
}

/** A thrown rock lands on its ring and cracks into rocks around the spot. */
function updateLob(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const lob = champ.lob;
  if (!lob) return;
  lob.left -= dt;
  if (lob.left > 0) return;
  const t = MACHAMP_KIT.rockThrow;
  world.blasts.push({ x: lob.tx, y: lob.ty, radius: t.radius, lifeLeft: BLAST_SECONDS, type: 'Rock' });
  if (playerIn(world, lob.tx, lob.ty, t.radius)) punch(world, champ, boss, t.damageFactor);
  const turn = world.rng.next() * Math.PI * 2;
  for (let i = 0; i < t.cracks; i++) {
    const a = turn + (i * Math.PI * 2) / t.cracks;
    const at = insideArena(fight, lob.tx + Math.cos(a) * t.crackSpread, lob.ty + Math.sin(a) * t.crackSpread, MACHAMP_KIT.rock.radius);
    addRubble(fight, at.x, at.y, t.stay, MACHAMP_KIT.rock.maxRocks);
  }
  champ.lob = null;
}

/** Strength boulders roll along their line; each hits once; at the wall they stay as rocks. */
function updateBoulders(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const s = MACHAMP_KIT.strength;
  for (const b of champ.boulders) {
    if (b.wait > 0) {
      b.wait -= dt;
      continue;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (!b.hit && playerIn(world, b.x, b.y, s.radius)) b.hit = punch(world, champ, boss, s.damageFactor) || true;
    if (Math.hypot(b.x - fight.x, b.y - fight.y) >= fight.radius - s.radius) {
      const at = insideArena(fight, b.x, b.y, s.radius);
      addRubble(fight, at.x, at.y, s.stay, MACHAMP_KIT.rock.maxRocks);
      b.wait = -Infinity; // done
    }
  }
  champ.boulders = champ.boulders.filter((b) => b.wait !== -Infinity);
}

// ── Other moves ───────────────────────────────────────────────────────────

/** Karate Chop / Close Combat: each chop lands at the end of its gap; the next re-aims (and steps in, for chops). */
function updateChops(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const kit = MACHAMP_KIT;
  const c = champ.chops!;
  const spec = c.close ? kit.closeCombat : kit.karateChop;
  c.left -= dt;
  if (c.left > 0) return;
  if (c.phase === 'recover') {
    champ.chops = null;
    endMove(champ, c.close ? 'closeCombat' : 'karateChop');
    return;
  }
  if (inCone(world, boss.x, boss.y, c.angle, spec.reach, spec.arcDeg)) punch(world, champ, boss, spec.damageFactor);
  c.index++;
  if (c.index >= c.count) {
    c.phase = 'recover';
    c.left = spec.recover;
    if (c.close) champ.openLeft = kit.closeCombat.weakSeconds; // lore: Close Combat drops its defences
    return;
  }
  const { player } = world;
  c.angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  if (!c.close) {
    const step = kit.karateChop.step;
    const next = insideArena(fight, boss.x + Math.cos(c.angle) * step, boss.y + Math.sin(c.angle) * step, boss.radius);
    boss.x = next.x;
    boss.y = next.y;
  }
  c.left = c.close ? kit.closeCombat.gap : kit.karateChop.gaps[Math.min(c.index, kit.karateChop.gaps.length - 1)]!;
}

function updateCrossChop(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const s = MACHAMP_KIT.crossChop;
  const cc = champ.crossChop!;
  cc.left -= dt;
  if (cc.left > 0) return;
  if (cc.phase === 'crouch') {
    cc.phase = 'windup';
    cc.left = s.telegraph;
  } else if (cc.phase === 'windup') {
    const land = insideArena(fight, cc.x, cc.y, boss.radius);
    boss.x = land.x;
    boss.y = land.y;
    world.blasts.push({ x: cc.x, y: cc.y, radius: s.arm / 2, lifeLeft: BLAST_SECONDS, type: 'Normal' });
    if (crossArms(cc.x, cc.y, cc.angle).some(([x1, y1, x2, y2]) => onSegment(world, x1, y1, x2, y2, s.width))) punch(world, champ, boss, s.damageFactor);
    cc.phase = 'recover';
    cc.left = s.recover;
  } else {
    champ.crossChop = null;
    endMove(champ, 'crossChop');
  }
}

function updateSweep(world: World, champ: MachampState, boss: Enemy, dt: number): void {
  const s = MACHAMP_KIT.lowSweep;
  const sweep = champ.sweep!;
  sweep.left -= dt;
  if (sweep.left > 0) return;
  if (sweep.phase === 'windup') {
    world.blasts.push({ x: boss.x, y: boss.y, radius: s.radius, lifeLeft: BLAST_SECONDS, type: 'Normal' });
    if (playerIn(world, boss.x, boss.y, s.radius) && punch(world, champ, boss, s.damageFactor)) {
      applyPlayerStatus(world, 'slow', { seconds: s.slowSeconds });
    }
    sweep.phase = 'recover';
    sweep.left = s.recover;
  } else {
    champ.sweep = null;
    endMove(champ, 'lowSweep');
  }
}

/** Seismic Toss: caught in the grab ring, you're thrown away from it (a push, never a stun) for fixed damage. */
function updateToss(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const s = MACHAMP_KIT.seismicToss;
  const { player } = world;
  const toss = champ.toss!;
  toss.left -= dt;
  if (toss.left > 0) return;
  if (toss.phase === 'windup') {
    if (playerIn(world, boss.x, boss.y, s.radius) && player.invulnLeft <= 0) {
      const d = Math.hypot(player.x - boss.x, player.y - boss.y);
      const a = d > 0 ? Math.atan2(player.y - boss.y, player.x - boss.x) : world.rng.next() * Math.PI * 2;
      const to = insideArena(fight, player.x + Math.cos(a) * s.throwDistance, player.y + Math.sin(a) * s.throwDistance, player.radius);
      player.x = to.x;
      player.y = to.y;
      world.blasts.push({ x: to.x, y: to.y, radius: player.radius + 20, lifeLeft: BLAST_SECONDS, type: 'Normal' });
      hitPlayer(world, player.maxHp * s.hpPct, boss);
    }
    toss.phase = 'recover';
    toss.left = s.recover;
  } else {
    champ.toss = null;
    endMove(champ, 'seismicToss');
  }
}

/** Rock Tomb boulders land on their rings, slow you, and stay as rocks. */
function updateTombs(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const s = MACHAMP_KIT.rockTomb;
  for (const t of champ.tombs) {
    t.left -= dt;
    if (t.left > 0) continue;
    world.blasts.push({ x: t.x, y: t.y, radius: s.radius, lifeLeft: BLAST_SECONDS, type: 'Rock' });
    if (playerIn(world, t.x, t.y, s.radius) && punch(world, champ, boss, s.damageFactor)) {
      applyPlayerStatus(world, 'slow', { seconds: s.slowSeconds });
    }
    addRubble(fight, t.x, t.y, s.stay, MACHAMP_KIT.rock.maxRocks);
  }
  champ.tombs = champ.tombs.filter((t) => t.left > 0);
}

function updateBullet(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const s = MACHAMP_KIT.bulletPunch;
  const { player } = world;
  const b = champ.bullet!;
  b.left -= dt;
  if (b.phase === 'windup' && b.left <= 0) {
    b.phase = 'dash';
  } else if (b.phase === 'dash') {
    const stepLen = s.speed * dt;
    const next = insideArena(fight, boss.x + Math.cos(b.angle) * stepLen, boss.y + Math.sin(b.angle) * stepLen, boss.radius);
    const blocked = Math.hypot(next.x - boss.x, next.y - boss.y) < stepLen * 0.5;
    boss.x = next.x;
    boss.y = next.y;
    b.travelled += stepLen;
    if (!b.hit && Math.hypot(player.x - boss.x, player.y - boss.y) <= boss.radius + s.width / 2 + player.radius) {
      b.hit = true;
      punch(world, champ, boss, s.damageFactor);
    }
    if (b.travelled >= s.length || blocked) {
      b.phase = 'recover';
      b.left = s.recover;
    }
  } else if (b.phase === 'recover' && b.left <= 0) {
    champ.bullet = null;
    endMove(champ, 'bulletPunch');
  }
}

/** Dynamic Punch: it leaps onto the big locked ring; a hit confuses you (lore: it always confuses). */
function updateDynamic(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const s = MACHAMP_KIT.dynamicPunch;
  const dp = champ.dynamic!;
  dp.left -= dt;
  if (dp.left > 0) return;
  if (dp.phase === 'windup') {
    const land = insideArena(fight, dp.x, dp.y, boss.radius);
    boss.x = land.x;
    boss.y = land.y;
    world.blasts.push({ x: dp.x, y: dp.y, radius: s.radius, lifeLeft: BLAST_SECONDS, type: 'Normal' });
    if (playerIn(world, dp.x, dp.y, s.radius) && punch(world, champ, boss, s.damageFactor)) {
      applyPlayerStatus(world, 'confusion', { seconds: s.confusion });
    }
    dp.phase = 'recover';
    dp.left = s.recover;
  } else {
    champ.dynamic = null;
    endMove(champ, 'dynamicPunch');
  }
}

/** Focus Blast orbs: real enemies (your shots can kill them), homing for a while, then straight; they burst on you. */
function updateOrbs(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const s = MACHAMP_KIT.focusBlast;
  const { player } = world;
  for (const orb of champ.orbs) {
    const e = world.enemies.find((en) => en.id === orb.enemyId);
    if (!e || e.hp <= 0) {
      orb.left = 0; // shot down
      continue;
    }
    if (orb.homingLeft > 0) {
      orb.homingLeft -= dt;
      const cur = Math.atan2(orb.vy, orb.vx);
      let turn = Math.atan2(player.y - e.y, player.x - e.x) - cur;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const a = cur + Math.max(-s.turnRate * dt, Math.min(s.turnRate * dt, turn));
      orb.vx = Math.cos(a) * s.speed;
      orb.vy = Math.sin(a) * s.speed;
    }
    e.x += orb.vx * dt;
    e.y += orb.vy * dt;
    orb.left -= dt;
    const out = Math.hypot(e.x - fight.x, e.y - fight.y) >= fight.radius - e.radius;
    if (playerIn(world, e.x, e.y, e.radius)) {
      world.blasts.push({ x: e.x, y: e.y, radius: s.blastRadius, lifeLeft: BLAST_SECONDS, type: 'Normal' });
      if (playerIn(world, e.x, e.y, s.blastRadius)) punch(world, champ, boss, s.damageFactor);
      orb.left = 0;
    }
    if (orb.left <= 0 || out) {
      e.hp = 0; // it fizzles (no XP: an orb pays none)
      orb.left = 0;
    }
  }
  champ.orbs = champ.orbs.filter((orb) => orb.left > 0);
}

function fireFocusBlast(world: World, champ: MachampState, boss: Enemy): void {
  const s = MACHAMP_KIT.focusBlast;
  const { player } = world;
  const a = Math.atan2(player.y - boss.y, player.x - boss.x);
  const e = spawnEnemy(world, 'focusOrb', boss.x + Math.cos(a) * (boss.radius + s.radius), boss.y + Math.sin(a) * (boss.radius + s.radius));
  e.maxHp = e.hp = boss.maxHp * s.hpPct;
  champ.orbs.push({ enemyId: e.id, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, homingLeft: s.homing, left: s.life });
}

/** Focus Punch: a channel you can break with damage (it staggers), then a locked line across the arena. */
function updateFocus(world: World, champ: MachampState, boss: Enemy, dt: number): void {
  const s = MACHAMP_KIT.focusPunch;
  const { player } = world;
  const f = champ.focus!;
  f.left -= dt;
  if (f.phase === 'channel' && f.taken >= boss.maxHp * s.interruptPct) {
    champ.focus = null;
    champ.staggerLeft = s.stagger;
    endMove(champ, 'focusPunch');
    return;
  }
  if (f.left > 0) return;
  if (f.phase === 'channel') {
    f.phase = 'line';
    f.left = s.telegraph;
    f.angle = Math.atan2(player.y - boss.y, player.x - boss.x); // locked (lead 0)
  } else if (f.phase === 'line') {
    const ex = boss.x + Math.cos(f.angle) * s.length;
    const ey = boss.y + Math.sin(f.angle) * s.length;
    if (onSegment(world, boss.x, boss.y, ex, ey, s.width)) punch(world, champ, boss, s.damageFactor);
    f.phase = 'recover';
    f.left = s.recover;
  } else {
    champ.focus = null;
    endMove(champ, 'focusPunch');
  }
}

/** Bulk Up pose (open) or Iron Pose (behind its rock): enough damage throws it off; completed, it gains stacks. */
function updatePose(fight: ArenaFight, champ: MachampState, boss: Enemy, dt: number): void {
  const kit = MACHAMP_KIT;
  const pose = champ.pose!;
  pose.left -= dt;
  const thrownOff = pose.taken >= boss.maxHp * kit.pose.interruptPct;
  if (!thrownOff && pose.left > 0) return;
  if (!thrownOff) champ.bulk = Math.min(kit.pose.maxStacks, champ.bulk + (pose.iron ? kit.ironPose.stacks : 1));
  champ.pose = null;
  if (pose.iron && champ.rock) {
    releaseStone(fight, champ.rock, true);
    champ.rock = null;
    champ.cooldowns.rock = kit.rock.cooldown;
  }
}

/**
 * Picks the next move by weight among those ready, in range and unlocked for the phase, never the same twice in a
 * row; after 2–3 attacks it poses instead (Bulk Up: the opening).
 */
function pickMachampMove(world: World, fight: ArenaFight, champ: MachampState, boss: Enemy): void {
  const kit = MACHAMP_KIT;
  const { player } = world;
  if (champ.attacks >= champ.poseAfter) {
    champ.pose = { left: champ.phase >= 3 ? kit.pose.secondsPhase3 : kit.pose.seconds, taken: 0, iron: false };
    champ.attacks = 0;
    champ.poseAfter = rollPoseAfter(world);
    return;
  }
  const d = Math.hypot(player.x - boss.x, player.y - boss.y);
  const edge = d - boss.radius - player.radius;
  const toPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
  const cd = champ.cooldowns;
  const ready: { id: MachampMove; begin: () => void }[] = [];
  const add = (id: MachampMove, ok: boolean, begin: () => void): void => {
    if (ok && cd[id] <= 0) ready.push({ id, begin });
  };
  add('karateChop', d <= kit.karateChop.trigger, () => {
    const count = champ.phase >= 2 ? kit.karateChop.chopsPhase2 : kit.karateChop.chops;
    champ.chops = { angle: toPlayer, left: kit.karateChop.gaps[0], index: 0, count, close: false, phase: 'windup' };
  });
  add('crossChop', d <= kit.crossChop.range, () => {
    const s = kit.crossChop;
    const spot = leadAim(world, fight, s.crouch + s.telegraph, s.lead, boss.radius);
    champ.crossChop = { x: spot.x, y: spot.y, angle: Math.atan2(spot.y - boss.y, spot.x - boss.x), left: s.crouch, phase: 'crouch' };
  });
  add('lowSweep', edge <= kit.lowSweep.trigger, () => (champ.sweep = { left: kit.lowSweep.telegraph, phase: 'windup' }));
  add('seismicToss', edge <= kit.seismicToss.trigger, () => (champ.toss = { left: kit.seismicToss.telegraph, phase: 'windup' }));
  add('rockTomb', true, () => {
    const s = kit.rockTomb;
    const lead = leadAim(world, fight, s.telegraph, 1, s.radius);
    champ.tombs.push({ ...lead, left: s.telegraph });
    for (let i = 1; i < s.boulders; i++) {
      const a = world.rng.next() * Math.PI * 2;
      const r = s.scatter * (0.5 + 0.5 * world.rng.next());
      champ.tombs.push({ ...insideArena(fight, lead.x + Math.cos(a) * r, lead.y + Math.sin(a) * r, s.radius), left: s.telegraph });
    }
    endMove(champ, 'rockTomb'); // a quick throw: the boulders fall on their own
  });
  add('rock', !champ.lob, () => startRock(world, fight, champ, boss));
  add('bulletPunch', champ.phase >= 2 && d >= kit.bulletPunch.minDistance && d <= kit.bulletPunch.maxDistance, () => {
    champ.bullet = { angle: toPlayer, left: kit.bulletPunch.telegraph, travelled: 0, hit: false, phase: 'windup' };
  });
  add('dynamicPunch', champ.phase >= 2 && d <= kit.dynamicPunch.range, () => {
    const s = kit.dynamicPunch;
    const spot = leadAim(world, fight, s.telegraph, s.lead, boss.radius);
    champ.dynamic = { x: spot.x, y: spot.y, left: s.telegraph, phase: 'windup' };
  });
  add('focusBlast', champ.phase >= 2 && champ.orbs.length === 0, () => (champ.blastCast = kit.focusBlast.cast));
  add('focusPunch', champ.phase >= 3, () => (champ.focus = { left: kit.focusPunch.channel, taken: 0, angle: 0, phase: 'channel' }));
  add('closeCombat', champ.phase >= 3 && d <= kit.closeCombat.trigger, () => {
    champ.chops = { angle: toPlayer, left: kit.closeCombat.gap, index: 0, count: kit.closeCombat.hits, close: true, phase: 'windup' };
  });
  const pool = ready.length > 1 ? ready.filter((m) => m.id !== champ.lastMove) : ready;
  if (pool.length === 0) return;
  let roll = pool.length === 1 ? 0 : world.rng.next() * pool.reduce((sum, m) => sum + kit.weights[m.id], 0);
  const pick = pool.find((m) => (roll -= kit.weights[m.id]) < 0) ?? pool[pool.length - 1]!;
  pick.begin();
  champ.lastMove = pick.id;
  champ.moveGap = kit.moveGap;
}

/**
 * Machamp (BOSSES.md §4, D42): walks at you (×1.4 Snorlax's speed); 2–3 attacks then a pose; the rock in hand;
 * phases at 66% and 33% start with an immune Focus Energy and No Guard. Immune only during those animations.
 */
export function machamp(world: World, fight: ArenaFight, boss: Enemy, dt: number): void {
  const kit = MACHAMP_KIT;
  const champ = fight.champ!;
  champ.moveGap -= dt;
  champ.openLeft -= dt;
  for (const id of Object.keys(champ.cooldowns) as MachampMove[]) champ.cooldowns[id] -= dt;
  for (const rock of fight.rubble) if (rock.hp === undefined) rock.left -= dt;
  fight.rubble = fight.rubble.filter((rock) => rock.left > 0);
  fight.playerSlow = 0;
  updateTombs(world, fight, champ, boss, dt);
  updateLob(world, fight, champ, boss, dt);
  updateBoulders(world, fight, champ, boss, dt);
  updateOrbs(world, fight, champ, boss, dt);

  // The held rock broke: it staggers, open (the reward for breaking its shield).
  const stone = champ.rock?.stone;
  if (stone && stone.hp !== undefined && stone.hp <= 0) {
    releaseStone(fight, champ.rock!, false);
    champ.rock = null;
    champ.pose = null;
    champ.staggerLeft = kit.rock.stagger;
    endMove(champ, 'rock');
  }

  fight.goal = null;
  if (champ.transitionLeft > 0) champ.transitionLeft -= dt;
  else if (champ.staggerLeft > 0) champ.staggerLeft -= dt;
  else if (champ.pose) updatePose(fight, champ, boss, dt);
  else if (champ.chops) updateChops(world, fight, champ, boss, dt);
  else if (champ.crossChop) updateCrossChop(world, fight, champ, boss, dt);
  else if (champ.sweep) updateSweep(world, champ, boss, dt);
  else if (champ.toss) updateToss(world, fight, champ, boss, dt);
  else if (champ.rock) updateRock(world, fight, champ, boss, dt);
  else if (champ.bullet) updateBullet(world, fight, champ, boss, dt);
  else if (champ.dynamic) updateDynamic(world, fight, champ, boss, dt);
  else if (champ.blastCast > 0) {
    champ.blastCast -= dt;
    if (champ.blastCast <= 0) {
      fireFocusBlast(world, champ, boss);
      endMove(champ, 'focusBlast');
    }
  } else if (champ.focus) updateFocus(world, champ, boss, dt);
  else if (champ.phase <= kit.phaseAt.length && boss.hp <= boss.maxHp * kit.phaseAt[champ.phase - 1]!) {
    // Next phase: an immune animation (the phase gate held HP here until now).
    champ.phase++;
    champ.transitionLeft = kit.transitionSeconds;
    world.arenaNotice = { kind: champ.phase === 2 ? 'focusEnergy' : 'noGuard', bossId: fight.bossId };
  } else if (champ.moveGap <= 0) {
    pickMachampMove(world, fight, champ, boss);
  }

  const busy =
    champ.transitionLeft > 0 ||
    champ.staggerLeft > 0 ||
    champ.pose ||
    champ.chops ||
    champ.crossChop ||
    champ.sweep ||
    champ.toss ||
    champ.rock ||
    champ.bullet ||
    champ.dynamic ||
    champ.blastCast > 0 ||
    champ.focus;
  if (busy) champ.moveGap = Math.max(champ.moveGap, kit.moveGap);
  // It walks at you when free; every dash, leap and charge moves it by hand.
  boss.speed = busy ? 0 : fight.bossSpeed;
}
