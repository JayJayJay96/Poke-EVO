// Tiny DOM builder for the HTML overlays. Text always goes in as textContent, never as HTML.

type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  title?: string;
  style?: string;
  onclick?: (event: Event) => void;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.title) el.title = props.title;
  if (props.style) el.setAttribute('style', props.style);
  if (props.onclick) el.addEventListener('click', props.onclick);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'object' ? child : String(child));
  }
  return el;
}

/** 1234 → "1.2k", 1234567 → "1.2M". */
export function shortNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

export function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
