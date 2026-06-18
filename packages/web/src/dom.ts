/** Tiny DOM helpers — keeps the renderer terse and dependency-free. */

export type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  className?: string;
  text?: string;
  html?: string;
  title?: string;
  style?: Partial<CSSStyleDeclaration> | string;
  dataset?: Record<string, string>;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (ev: HTMLElementEventMap[K]) => void }>;
  [key: string]: unknown;
}

/** Create an element with props + children in one call. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const cls = props.class ?? props.className;
  if (cls) el.className = cls;
  if (props.text != null) el.textContent = String(props.text);
  if (props.html != null) el.innerHTML = props.html;
  if (props.title != null) el.title = props.title;
  if (props.style) {
    if (typeof props.style === 'string') el.setAttribute('style', props.style);
    else Object.assign(el.style, props.style);
  }
  if (props.dataset) {
    for (const [k, v] of Object.entries(props.dataset)) el.dataset[k] = v;
  }
  if (props.attrs) {
    for (const [k, v] of Object.entries(props.attrs)) {
      if (v === false || v == null) continue;
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (props.on) {
    for (const [event, handler] of Object.entries(props.on)) {
      el.addEventListener(event, handler as EventListener);
    }
  }
  appendChildren(el, children);
  return el;
}

export function appendChildren(el: HTMLElement, children: Child[]): void {
  for (const child of children.flat(Infinity as 1)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function on<K extends keyof HTMLElementEventMap>(
  el: HTMLElement | Document | Window,
  event: K,
  handler: (ev: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  el.addEventListener(event, handler as EventListener, options);
  return () => el.removeEventListener(event, handler as EventListener, options);
}

/** Resolve a string selector or element into an element (throws if missing). */
export function resolveTarget(target: string | HTMLElement): HTMLElement {
  if (typeof target === 'string') {
    const el = document.querySelector(target);
    if (!el) throw new Error(`pvotly: target "${target}" not found`);
    return el as HTMLElement;
  }
  return target;
}
