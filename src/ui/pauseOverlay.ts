import { MAX_SOCKETS, RANK_NUMERALS } from '../data/augments';
import { BOONS } from '../data/boons';
import { ABILITIES, TUNING, type PokemonType } from '../data/content';
import { MOVES } from '../data/moves';
import { TECHNIQUES } from '../data/techniques';
import { BIG_BOOST, BOOST_IDS, BOOSTS, CRIT_MULTIPLIER, ITEMS } from '../data/upgrades';
import { comboCooldown } from '../sim/combo';
import { xpToNext } from '../sim/progression';
import { currentStage } from '../sim/stats';
import type { MoveSlot, World } from '../sim/types';
import { runClock } from '../sim/world';
import { clock, h, percent, shortNumber } from './dom';
import { TYPE_COLORS, augmentLabel, cssColor, mutationLabel, textOn } from './labels';
import './overlay.css';

// Esc pause screen (owner 2026-10-24, inspired by their reference shot): the whole build at a glance.

export interface PauseActions {
  resume(): void;
  restart(): void;
  giveUp(): void;
}

export class PauseOverlay {
  private root: HTMLElement | null = null;

  constructor(private readonly actions: PauseActions) {}

  get open(): boolean {
    return this.root !== null;
  }

  show(world: World): void {
    this.hide();
    this.root = renderPause(world, this.actions);
    document.body.append(this.root);
  }

  hide(): void {
    this.root?.remove();
    this.root = null;
  }
}

export function typeChip(type: PokemonType): HTMLElement {
  const c = TYPE_COLORS[type];
  return h('span', { class: 'ui-type', style: `background:${cssColor(c)};color:${textOn(c)}` }, type);
}

/** A header band coloured by the Pokémon's first type. */
export function typeBand(type: PokemonType): string {
  const c = cssColor(TYPE_COLORS[type]);
  return `background:linear-gradient(110deg, color-mix(in srgb, ${c} 80%, #000) 0%, ${c} 70%)`;
}

function renderPause(world: World, actions: PauseActions): HTMLElement {
  const win = h('div', { class: 'ui-window' }, header(world), columns(world), footer(actions));
  return h('div', { class: 'ui-root' }, win);
}

function header(world: World): HTMLElement {
  const { player, level, xp } = world;
  const stage = currentStage(world);
  const time = Math.max(1, runClock(world));
  const main = stage.types[0]!;
  const bar = (label: string, frac: number, color: string, text: string) =>
    h(
      'div',
      { class: 'ui-bar' },
      label,
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${Math.min(100, frac * 100)}%;background:${color}` })),
      text,
    );
  const tile = (value: string, label: string) => h('div', { class: 'ui-tile' }, h('b', {}, value), h('span', {}, label));
  return h(
    'div',
    { class: 'ui-head', style: typeBand(main) },
    h(
      'div',
      { class: 'ui-portrait', style: `background:${cssColor(TYPE_COLORS[main])}` },
      stage.name[0],
      h('span', { class: 'lv' }, `Lv. ${level}`),
    ),
    h(
      'div',
      { class: 'ui-ident' },
      h('div', { class: 'ui-kicker' }, h('span', { class: 'pill' }, 'PAUSE'), world.arena ? 'Arena fight' : 'Level 1 · Normal'),
      h('div', { class: 'ui-name' }, stage.name, ...stage.types.map(typeChip)),
      bar('HP', player.hp / player.maxHp, '#4cd964', `${Math.ceil(player.hp)}/${Math.round(player.maxHp)}`),
      bar('EXP', xp / xpToNext(level), '#7fd0ff', `${Math.floor(xp)}/${xpToNext(level)}`),
    ),
    h(
      'div',
      { class: 'ui-tiles' },
      tile(clock(runClock(world)), 'Time'),
      tile(shortNumber(world.kills), 'KOs'),
      tile(shortNumber(world.damageDealt), 'Damage'),
      tile(shortNumber(world.damageDealt / time), 'Dmg/s'),
      tile(String(world.pendingLevelUps), 'Banked Lv'),
      tile(String(world.rerollsLeft), 'Rerolls'),
    ),
  );
}

function column(title: string, note: string, band: string, ...body: (Node | false)[]): HTMLElement {
  return h(
    'section',
    { class: 'ui-col' },
    h('div', { class: 'ui-col-head', style: `background:var(${band})` }, title, h('small', {}, note)),
    h('div', { class: 'ui-col-body' }, ...body),
  );
}

function columns(world: World): HTMLElement {
  return h('div', { class: 'ui-cols' }, movesColumn(world), buildColumn(world), statsColumn(world));
}

function movesColumn(world: World): HTMLElement {
  const ability = ABILITIES[world.player.ability];
  const abilityCard = h(
    'div',
    { class: 'ui-card' },
    h('div', { class: 'ui-section', style: 'margin:0 0 2px' }, 'Ability'),
    h('h4', {}, ability.name),
    h('p', {}, ability.description),
  );
  return column(
    'Moves',
    `${world.moves.length} learned`,
    '--blue',
    abilityCard,
    ...world.moves.map((slot, i) => moveCard(world, slot, i)),
  );
}

function moveCard(world: World, slot: MoveSlot, index: number): HTMLElement {
  const def = MOVES[slot.moveId];
  const { stats } = slot;
  const type = def.tags.find((tag): tag is PokemonType => tag in TYPE_COLORS);
  const comboAt = world.combo.indexOf(index);
  const role = index === 0 ? 'Signature' : comboAt === 0 ? 'Combo base' : comboAt > 0 ? 'Combo member' : '';
  const cooldown = comboAt >= 0 ? comboCooldown(world) : stats.cooldown;
  const chip = (label: string, value: string) => h('span', { class: 'ui-chip' }, `${label} `, h('b', {}, value));
  const sockets = h(
    'ul',
    { class: 'ui-sockets' },
    ...slot.sockets.map((s) => h('li', {}, `◆ ${augmentLabel(s.augmentId, s.rank)}`)),
    ...Array.from({ length: Math.max(0, MAX_SOCKETS - slot.sockets.length) }, () => h('li', { class: 'empty' }, '◇ empty socket')),
    h('li', { class: slot.mutation ? 'mut' : 'empty' }, slot.mutation ? `✦ ${mutationLabel(slot.mutation, slot.mutationRank)}` : '✧ no Mutation'),
  );
  const share = world.damageDealt > 0 ? slot.damageDealt / world.damageDealt : 0;
  return h(
    'div',
    { class: 'ui-card', style: type ? `border-left-color:${cssColor(TYPE_COLORS[type])}` : '' },
    h('h4', {}, def.name, h('small', {}, role)),
    h('div', { class: 'sub' }, def.tags.join(' · ')),
    h(
      'div',
      { class: 'ui-chips' },
      chip('Damage', stats.damage.toFixed(1)),
      chip('Cooldown', `${cooldown.toFixed(2)} s`),
      stats.area !== 1 && chip('Area', percent(stats.area)),
      stats.critChance > 0 && chip('Crit', percent(stats.critChance)),
    ),
    h('p', {}, def.description),
    sockets,
    h(
      'div',
      { class: 'ui-share' },
      `${shortNumber(slot.damageDealt)} damage · ${percent(share)} of all`,
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${share * 100}%` })),
    ),
  );
}

function buildColumn(world: World): HTMLElement {
  const techniques = world.techniques.map(({ id, rank }) => {
    const def = TECHNIQUES[id];
    const live =
      id === 'moxie' ? ` · now +${percent(world.tech.moxie)}` : id === 'endure' ? ` · ${world.tech.endureLeft > 0 ? `${Math.ceil(world.tech.endureLeft)} s` : 'ready'}` : '';
    return h(
      'div',
      { class: 'ui-card', style: 'border-left-color:#7ee081' },
      h('h4', {}, `${def.name} ${RANK_NUMERALS[rank - 1]}`, h('small', {}, def.requiresAny.join('/') || 'Any')),
      h('p', {}, def.descriptions[rank - 1]! + live),
    );
  });
  const natures = BOOST_IDS.filter((id) => world.boosts[id] > 0).map((id) => {
    const def = BOOSTS[id];
    const count = def.filler ? `×${world.boosts[id]}` : `${world.boosts[id]}/${def.maxPicks}`;
    return h('div', { class: 'ui-card', style: 'border-left-color:#5ad1ff' }, h('h4', {}, def.name, h('small', {}, count)), h('p', {}, def.description));
  });
  if (world.surgeLeft > 0) {
    natures.push(h('div', { class: 'ui-card' }, h('h4', {}, 'Site surge', h('small', {}, `${Math.ceil(world.surgeLeft)} s left`))));
  }
  if (world.bigBoosts > 0) {
    natures.push(h('div', { class: 'ui-card' }, h('h4', {}, BIG_BOOST.name, h('small', {}, `×${world.bigBoosts}`)), h('p', {}, BIG_BOOST.description)));
  }
  const items = world.items.map((id) =>
    h('div', { class: 'ui-card', style: 'border-left-color:#c77dff' }, h('h4', {}, ITEMS[id].name), h('p', {}, ITEMS[id].description)),
  );
  const empty = (text: string) => h('div', { class: 'ui-empty' }, text);
  const boons = world.boons.map((id) =>
    h(
      'div',
      { class: 'ui-card', style: 'border-left-color:#ffc83d' },
      h('h4', {}, BOONS[id].name, h('small', {}, `${BOONS[id].clears ? '★ ' : ''}from ${BOONS[id].bossName}`)),
      h('p', {}, BOONS[id].description),
    ),
  );
  return column(
    'Build',
    `${world.techniques.length}/5 Techniques`,
    '--orange',
    boons.length > 0 && h('div', { class: 'ui-section' }, 'Legendary Boons'),
    ...boons,
    h('div', { class: 'ui-section' }, 'Techniques'),
    ...(techniques.length ? techniques : [empty('None yet: Techniques come from normal level-ups.')]),
    h('div', { class: 'ui-section' }, 'Natures & boosts'),
    ...(natures.length ? natures : [empty('None yet.')]),
    h('div', { class: 'ui-section' }, `Held items · ${world.items.length}/3`),
    ...(items.length ? items : [empty('None yet: held items come from Mutation Sites.')]),
  );
}

type Better = 'higher' | 'lower' | null;

function row(label: string, value: string, delta = 0, better: Better = 'higher'): HTMLElement {
  const good = better && Math.abs(delta) > 1e-6 && (better === 'higher' ? delta > 0 : delta < 0);
  const bad = better && Math.abs(delta) > 1e-6 && !good;
  return h('div', { class: 'ui-row' }, h('span', {}, label), h('span', { class: good ? 'good' : bad ? 'bad' : '' }, value));
}

function statsColumn(world: World): HTMLElement {
  const m = world.mods;
  const p = world.player;
  const stage = currentStage(world);
  const ability = ABILITIES[p.ability];
  const rest = TUNING.restRegen;
  const attack = h(
    'div',
    { class: 'ui-table' },
    row('Damage', percent(m.damageMult), m.damageMult - 1),
    row('Cooldown', percent(m.cooldownMult), m.cooldownMult - 1, 'lower'),
    row('Area', percent(m.areaMult), m.areaMult - 1),
    row('Duration', percent(m.durationMult), m.durationMult - 1),
    row('Crit chance', percent(m.critChance), m.critChance),
    row('Crit damage', percent(CRIT_MULTIPLIER), 0, null),
  );
  const defense = h(
    'div',
    { class: 'ui-table' },
    row('Max HP', String(Math.round(p.maxHp)), p.maxHp - stage.maxHp),
    row('Regen/s', m.regenPerSec.toFixed(1), m.regenPerSec),
    row('Rest regen', `${percent(rest.maxHpPctPerSec)}/s after ${rest.afterSeconds} s`, 0, null),
    row('Damage taken', percent(m.damageTakenMult), m.damageTakenMult - 1, 'lower'),
    ability.blockEvery ? row('Shell block', `every ${ability.blockEvery} s`, 0, null) : false,
  );
  const baseSpeed = stage.speed;
  const utility = h(
    'div',
    { class: 'ui-table' },
    row('Speed', percent(p.speed / baseSpeed), p.speed - baseSpeed),
    row('Pickup range', `${Math.round(p.pickupRadius)} px`, p.pickupRadius - TUNING.player.baseMagnetRadius),
    row('Level growth', `+${percent((world.level - 1) * TUNING.levelGrowth.damagePct)} dmg`, 0, null),
  );
  return column(
    'Stats',
    'Green: better than base',
    '--purple',
    h('div', { class: 'ui-stats' }, h('div', {}, h('div', { class: 'ui-section' }, 'Attack'), attack), h('div', {}, h('div', { class: 'ui-section' }, 'Defense'), defense)),
    h('div', { class: 'ui-section' }, 'Utility'),
    utility,
  );
}

function footer(actions: PauseActions): HTMLElement {
  const key = (k: string, text: string) => h('span', {}, h('kbd', {}, k), text);
  /** Restart and Give up end the run, so they ask for a second click. */
  const confirmed = (label: string, cls: string, act: () => void) => {
    const btn = h('button', { class: `ui-btn ${cls}` }, label);
    btn.addEventListener('click', () => {
      if (btn.classList.contains('confirm')) return act();
      btn.classList.add('confirm');
      btn.textContent = 'Sure? Click again';
      setTimeout(() => {
        btn.classList.remove('confirm');
        btn.textContent = label;
      }, 2500);
    });
    return btn;
  };
  return h(
    'div',
    { class: 'ui-foot' },
    h(
      'div',
      { class: 'ui-keys' },
      key('Esc', 'resume'),
      key('WASD', 'move'),
      key('Space', 'open banked level-ups'),
      key('1–3', 'pick a card'),
      key('R', 'reroll augments'),
    ),
    h(
      'div',
      { class: 'ui-buttons' },
      confirmed('Give up', 'red', actions.giveUp),
      confirmed('Restart', '', actions.restart),
      h('button', { class: 'ui-btn go', onclick: () => actions.resume() }, 'Continue'),
    ),
  );
}
