import { TUNING } from '../../data/content';
import { MOVES, type ZoneMoveDef } from '../../data/moves';
import { MUTATIONS } from '../../data/mutations';
import { applyNewStun } from '../combat';
import { defineMutation } from '../hooks';
import type { Enemy, MoveSlot, World } from '../types';
import { strikeZone } from '../zones';
import { entitiesOf, forEachEnemyIn, nearestEnemies, spawnEntity } from './util';

// Thunder Mutations (docs/moveset/shared/thunder.md, pikachu/README.md). Raichu only.

const thunder = MOVES.thunder as ZoneMoveDef;

/** One Thunder-style strike: the circle shows, then it lands after the move's delay. */
function strike(world: World, slot: MoveSlot, x: number, y: number, radius: number, damage: number, stun: number): void {
  strikeZone(world, x, y, radius, thunder.tickInterval, damage, slot.stats.critChance, {
    slow: 0,
    stun,
    stunKind: 'paralysis',
    poisonDps: 0,
    attackType: slot.stats.attackType,
  });
}

/** Storm Call (generic): three smaller strikes on three random enemies in range. */
const storm = MUTATIONS['thunder.storm'].values;
defineMutation('thunder.storm', {
  cast: (world, slot) => {
    const { x, y } = world.player;
    const pool = nearestEnemies(world, x, y, thunder.range, world.enemies.length);
    if (pool.length === 0) return false;
    const s = slot.stats;
    for (let i = 0; i < storm.strikes && pool.length > 0; i++) {
      const e = pool.splice(Math.floor(world.rng.next() * pool.length), 1)[0]!;
      strike(world, slot, e.x, e.y, storm.strikeRadius * s.area, s.damage * s.zoneDamageMult * storm.strikeDamageFraction, storm.paralyseSeconds);
    }
    return true;
  },
});

/** Afterglow (generic): the strike point stays electrified for a while; enemies walking in are paralysed briefly. */
const afterglow = MUTATIONS['thunder.afterglow'].values;
defineMutation('thunder.afterglow', {
  stats: (s) => {
    s.damage *= afterglow.damageMult;
  },
  onCast: (world) => {
    const zone = world.zones[world.zones.length - 1];
    if (zone?.source !== 'thunder') return;
    const field = spawnEntity(world, 'thunder.afterglow', zone.x, zone.y, zone.tickLeft + afterglow.fieldSeconds);
    field.radius = zone.radius;
    field.timer = zone.tickLeft; // starts when the strike lands
  },
  update: (world, _slot, dt) => {
    for (const field of entitiesOf(world, 'thunder.afterglow')) {
      field.lifeLeft -= dt;
      field.timer -= dt;
      if (field.timer > 0) continue;
      field.timer += TUNING.status.burnTick;
      forEachEnemyIn(world, field.x, field.y, field.radius, (e) => applyNewStun(e, afterglow.paralysePerTick, 'paralysis'));
    }
  },
});

/** Thunderstorm (Bond, Discharge, Raichu): every Discharge also calls a Thunder strike on the toughest enemy in range. */
const storming = MUTATIONS['thunder.thunderstorm'].values;
defineMutation('thunder.thunderstorm', {
  stats: (s) => {
    s.cooldown *= storming.cooldownMult;
  },
  onEvent: (world, slot, event) => {
    if (event !== 'discharge') return;
    let toughest: Enemy | null = null;
    for (const e of nearestEnemies(world, world.player.x, world.player.y, thunder.range, world.enemies.length)) {
      if (!toughest || e.hp > toughest.hp) toughest = e;
    }
    const t = toughest as Enemy | null;
    if (!t) return;
    const s = slot.stats;
    strike(world, slot, t.x, t.y, thunder.radius * s.area, s.damage * s.zoneDamageMult, s.stun);
  },
});
