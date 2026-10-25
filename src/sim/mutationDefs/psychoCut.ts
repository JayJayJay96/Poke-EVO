import { damageEnemy, findNearestEnemy, procHit } from '../combat';
import { ARC_SECONDS } from '../forms/projectile';
import { defineMutation, movingFor } from '../hooks';
import { entitiesOf, forEachEnemyOnSegment, ranked, spawnEntity } from './util';

// Psycho Cut Mutations (docs/moveset/abra §5, D56).

/** Keen Psycho (generic): more crits, a narrower arc. */
const keen = ranked('psychoCut.keen');
defineMutation('psychoCut.keen', {
  stats: (s, _world, slot) => {
    s.critChance = Math.min(1, s.critChance + keen(slot).critBonus);
    s.arcMult *= keen(slot).arcMult;
  },
});

/** Psycho Wave (generic): the slash also sends a wave forward. */
const wave = ranked('psychoCut.wave');
defineMutation('psychoCut.wave', {
  stats: (s, _world, slot) => {
    s.damage *= wave(slot).damageMult;
  },
  onCast: (world, slot) => {
    const v = wave(slot);
    const length = v.waveLength * slot.stats.area;
    const { x, y } = world.player;
    const target = findNearestEnemy(world, length + 60);
    if (!target) return;
    const d = Math.hypot(target.x - x, target.y - y) || 1;
    const x2 = x + ((target.x - x) / d) * length;
    const y2 = y + ((target.y - y) / d) * length;
    const hit = procHit(slot.stats.attackType);
    forEachEnemyOnSegment(world, x, y, x2, y2, v.waveWidth, (e) => damageEnemy(world, e, slot.stats.damage * v.waveFraction, hit));
    world.arcs.push({ x1: x, y1: y, x2, y2, lifeLeft: ARC_SECONDS });
  },
});

/** Flowing Cut (Bond, moving): after moving a moment, the slash leaves a cutting line behind you; standing, weaker. */
const flowing = ranked('psychoCut.flowingCut');
defineMutation('psychoCut.flowingCut', {
  live: (s, world, slot) => {
    if (!movingFor(world, flowing(slot).movingSeconds)) s.damage *= flowing(slot).damageMultStill;
  },
  onCast: (world, slot) => {
    const v = flowing(slot);
    if (!movingFor(world, v.movingSeconds)) return;
    const p = world.player;
    const line = spawnEntity(world, 'psychoCut.flowingCut', p.x, p.y, v.lineSeconds);
    line.x2 = p.x - p.faceX * v.lineLength;
    line.y2 = p.y - p.faceY * v.lineLength;
    line.damage = slot.stats.damage * v.lineFraction;
  },
  update: (world, slot, dt) => {
    const v = flowing(slot);
    const hit = procHit(slot.stats.attackType);
    for (const line of entitiesOf(world, 'psychoCut.flowingCut')) {
      line.lifeLeft -= dt;
      line.timer -= dt;
      if (line.timer > 0) continue;
      line.timer += v.lineTick;
      forEachEnemyOnSegment(world, line.x, line.y, line.x2, line.y2, 20, (e) => damageEnemy(world, e, line.damage, hit));
      world.arcs.push({ x1: line.x, y1: line.y, x2: line.x2, y2: line.y2, lifeLeft: ARC_SECONDS });
    }
  },
});
