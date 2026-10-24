import { ABILITIES, POKEMON, type PokemonDef, type PokemonId, type PokemonType } from '../data/content';
import { MOVES, type MoveId } from '../data/moves';
import { effectiveness } from '../data/typeChart';
import { h } from './dom';
import { TYPE_COLORS, cssColor } from './labels';
import { typeBand, typeChip } from './pauseOverlay';
import './overlay.css';

// Pokémon select (owner 2026-10-24, inspired by their reference shot): a roster grid and a detail panel.

const ALL_TYPES = Object.keys(TYPE_COLORS) as PokemonType[];

/** "3-stage", "2-stage" or "No evolution": the early-vs-late gamble (§5). */
export function tierLabel(def: PokemonDef): string {
  if (def.stages.length === 1) return 'No evolution';
  return `${def.stages.length}-stage`;
}

export class SelectOverlay {
  private root: HTMLElement | null = null;
  private selected: PokemonId;
  private readonly lines = Object.values(POKEMON);
  private readonly onKey = (e: KeyboardEvent) => this.key(e);

  constructor(private readonly choose: (id: PokemonId) => void, initial?: PokemonId) {
    this.selected = initial ?? this.lines[0]!.id;
  }

  show(): void {
    this.render();
    window.addEventListener('keydown', this.onKey);
  }

  hide(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root?.remove();
    this.root = null;
  }

  private key(e: KeyboardEvent): void {
    const i = this.lines.findIndex((d) => d.id === this.selected);
    const n = Number(e.key);
    if (n >= 1 && n <= this.lines.length) this.select(this.lines[n - 1]!.id);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.select(this.lines[(i + 1) % this.lines.length]!.id);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.select(this.lines[(i - 1 + this.lines.length) % this.lines.length]!.id);
    else if (e.key === 'Enter') this.choose(this.selected);
  }

  private select(id: PokemonId): void {
    this.selected = id;
    this.render();
  }

  private render(): void {
    const next = h('div', { class: 'ui-root' }, h('div', { class: 'ui-select' }, detail(POKEMON[this.selected], () => this.choose(this.selected)), this.roster()));
    if (this.root) this.root.replaceWith(next);
    else document.body.append(next);
    this.root = next;
  }

  private roster(): HTMLElement {
    const tiles = this.lines.map((def, i) => {
      const first = def.stages[0]!;
      const tile = h(
        'button',
        {
          class: `ui-mon${def.id === this.selected ? ' on' : ''}`,
          style: `background:linear-gradient(160deg, ${cssColor(TYPE_COLORS[first.types[0]!])}, color-mix(in srgb, ${cssColor(TYPE_COLORS[first.types[0]!])} 65%, #000))`,
          title: `${first.name} (${i + 1})`,
        },
        h('span', { class: 'key' }, String(i + 1)),
        h('span', { class: 'glyph' }, first.name[0]),
        h('span', { class: 'label' }, first.name),
      );
      tile.addEventListener('click', () => this.select(def.id));
      tile.addEventListener('dblclick', () => this.choose(def.id));
      return tile;
    });
    return h(
      'aside',
      { class: 'ui-roster' },
      h('div', { class: 'ui-name', style: 'font-size:26px;color:var(--ink);text-shadow:none' }, 'Choose your Pokémon'),
      h('div', { class: 'ui-keys' }, h('span', {}, h('kbd', {}, `1–${this.lines.length}`), 'or click'), h('span', {}, h('kbd', {}, 'Enter'), 'start'), h('span', {}, h('kbd', {}, 'Double-click'), 'start')),
      h('div', { class: 'ui-grid' }, ...tiles),
    );
  }
}

function detail(def: PokemonDef, start: () => void): HTMLElement {
  const first = def.stages[0]!;
  const last = def.stages[def.stages.length - 1]!;
  const main = first.types[0]!;
  const ability = ABILITIES[def.ability];
  const chain = h(
    'div',
    { class: 'ui-chain' },
    ...def.stages.flatMap((s, i) => [i > 0 && h('span', { class: 'arrow' }, `Lv ${s.level} ›`), h('span', { class: 'stage' }, s.name)]),
  );
  const top = h(
    'div',
    { class: 'ui-detail-top' },
    h('div', { class: 'ui-art', style: typeBand(main) }, first.name[0]),
    h(
      'div',
      {},
      h('div', { class: 'ui-kicker', style: 'color:var(--muted)' }, `${tierLabel(def)} · ${def.role}`),
      h('div', { class: 'ui-name', style: 'color:var(--ink);text-shadow:none' }, first.name, ...first.types.map(typeChip)),
      last.types.join() !== first.types.join() && h('div', { class: 'ui-chips' }, `Final form: `, ...last.types.map(typeChip)),
      h('div', { class: 'ui-section', style: 'margin-top:10px' }, 'Evolves during a run'),
      chain,
    ),
    baseStats(def),
  );
  const kit = h(
    'section',
    { class: 'ui-col' },
    h('div', { class: 'ui-col-head', style: 'background:var(--green)' }, 'Ability & kit'),
    h(
      'div',
      { class: 'ui-col-body' },
      h('div', { class: 'ui-card' }, h('div', { class: 'ui-section', style: 'margin:0 0 2px' }, 'Ability'), h('h4', {}, ability.name), h('p', {}, ability.description)),
      h('div', { class: 'ui-section' }, 'Signature (evolves with the line)'),
      h('div', { class: 'ui-movegrid' }, ...signatures(def).map(([id, note]) => moveCard(id, note))),
      h('div', { class: 'ui-section' }, `Learnset (${def.learnset.length} moves)`),
      h('div', { class: 'ui-movegrid' }, ...def.learnset.map((e) => moveCard(e.move, e.fromStage > 0 ? `From ${def.stages[e.fromStage]!.name}` : ''))),
    ),
  );
  const types = h(
    'section',
    { class: 'ui-col' },
    h('div', { class: 'ui-col-head', style: 'background:var(--purple)' }, 'Types', h('small', {}, first.types.join(' / '))),
    h('div', { class: 'ui-col-body' }, matchups(first.types), h('p', { class: 'ui-empty' }, 'Damage the type chart deals to you, and the types your STAB moves hit for ×2. Immunities count as ×0.5 (D14).')),
  );
  return h(
    'div',
    { class: 'ui-window' },
    top,
    h('div', { class: 'ui-panels' }, kit, types),
    h('div', { class: 'ui-buttons' }, h('button', { class: 'ui-btn go', onclick: start }, 'I choose you!  ⏎')),
  );
}

/** The signature move of every stage (or level tier for non-evolvers), first one marked Starter. */
function signatures(def: PokemonDef): [MoveId, string][] {
  const out: [MoveId, string][] = [];
  def.stages.forEach((s, i) => {
    if (!out.some(([id]) => id === s.signatureMove)) out.push([s.signatureMove, i === 0 ? 'Starter' : `${s.name} · Lv ${s.level}`]);
  });
  for (const tier of def.signatureTiers ?? []) out.push([tier.move, `Lv ${tier.level}`]);
  return out;
}

function moveCard(id: MoveId, note: string): HTMLElement {
  const def = MOVES[id];
  const type = def.tags.find((tag): tag is PokemonType => tag in TYPE_COLORS);
  const chip = (label: string, value: string) => h('span', { class: 'ui-chip' }, `${label} `, h('b', {}, value));
  return h(
    'div',
    { class: 'ui-card', style: type ? `border-left-color:${cssColor(TYPE_COLORS[type])}` : '' },
    h('h4', {}, def.name, h('small', {}, note)),
    h('div', { class: 'sub' }, def.tags.join(' · ')),
    h('p', {}, def.description),
    h('div', { class: 'ui-chips' }, def.damage > 0 && chip('Damage', String(def.damage)), chip('Cooldown', `${def.cooldown} s`)),
  );
}

/** HP, damage and speed bars against the best first stage, with the final form's numbers. */
function baseStats(def: PokemonDef): HTMLElement {
  const firsts = Object.values(POKEMON).map((d) => d.stages[0]!);
  const lasts = Object.values(POKEMON).map((d) => d.stages[d.stages.length - 1]!);
  const first = def.stages[0]!;
  const last = def.stages[def.stages.length - 1]!;
  const bar = (label: string, value: number, max: number, color: string, text: string) =>
    h(
      'div',
      { class: 'ui-statbar' },
      h('span', {}, label),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${Math.min(100, (value / max) * 100)}%;background:${color}` })),
      h('span', {}, text),
    );
  const max = (pick: (s: PokemonDef['stages'][number]) => number) => Math.max(...firsts.map(pick), ...lasts.map(pick));
  return h(
    'div',
    {},
    h('div', { class: 'ui-section' }, 'Base stats (start → final)'),
    bar('HP', first.maxHp, max((s) => s.maxHp), '#4cd964', String(first.maxHp)),
    bar('', last.maxHp, max((s) => s.maxHp), '#2a9d4a', String(last.maxHp)),
    bar('Damage', first.damageMult, max((s) => s.damageMult), '#ff7a2f', `×${first.damageMult}`),
    bar('', last.damageMult, max((s) => s.damageMult), '#c4551a', `×${last.damageMult}`),
    bar('Speed', first.speed, max((s) => s.speed), '#3d8bff', String(first.speed)),
    bar('', last.speed, max((s) => s.speed), '#2563c4', String(last.speed)),
  );
}

function matchups(types: readonly PokemonType[]): HTMLElement {
  const weak = ALL_TYPES.filter((t) => effectiveness(t, types) > 1);
  const resist = ALL_TYPES.filter((t) => effectiveness(t, types) < 1);
  const strong = ALL_TYPES.filter((t) => types.some((own) => effectiveness(own, [t]) > 1));
  const list = (ts: PokemonType[], mult?: (t: PokemonType) => number) =>
    h(
      'div',
      { class: 'types' },
      ...(ts.length ? ts.map((t) => h('span', {}, typeChip(t), mult ? ` ×${mult(t)}` : '')) : ['—']),
    );
  return h(
    'div',
    { class: 'ui-card ui-matchups' },
    h('span', { style: 'color:var(--bad)' }, 'Weak to'),
    list(weak, (t) => effectiveness(t, types)),
    h('span', { style: 'color:#2f6fd6' }, 'Resists'),
    list(resist, (t) => effectiveness(t, types)),
    h('span', { style: 'color:var(--good)' }, 'Strong against'),
    list(strong),
  );
}
