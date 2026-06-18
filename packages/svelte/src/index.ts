/**
 * @pvotly/svelte — Svelte bindings for pvotly.
 *
 * Ships a Svelte **action** (`use:pvotly`) that mounts the `@pvotly/web`
 * widget onto the host element. The action is pure TypeScript — it needs no
 * Svelte compiler and works with any Svelte 4+ project.
 *
 * Remember to import the stylesheet once in your app:
 * ```ts
 * import '@pvotly/web/styles.css';
 * ```
 *
 * @example
 * ```svelte
 * <script>
 *   import { pvotly } from '@pvotly/svelte';
 *   import '@pvotly/web/styles.css';
 *
 *   const options = {
 *     dataSource: { data },
 *     slice: { rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Sales' }] },
 *   };
 * </script>
 *
 * <div use:pvotly={options} />
 * ```
 */
import {
  PivotTable as WebPivotTable,
  type PivotTableOptions,
  type ThemeName,
  type ThemeTokens,
  type ActionBarConfig,
  type ExportFormat,
  type ExportOptions,
} from '@pvotly/web';
import type {
  PivotConfiguration,
  PivotEngine,
  PivotEventMap,
  PivotEventName,
} from '@pvotly/core';

/**
 * Imperative handle returned by the {@link pvotly} action. It is a superset of
 * `svelte/action`'s `ActionReturn` (`update` / `destroy`) so the action stays
 * assignable to `Action<HTMLElement, PivotTableOptions>`, while also exposing
 * the same imperative surface as the React/Vue/Angular wrappers (engine,
 * instance, config, export, print, dialogs and event subscription).
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { pvotly, type PvotlyHandle } from '@pvotly/svelte';
 *   let handle: PvotlyHandle | undefined;
 *   function attach(node: HTMLElement) {
 *     handle = pvotly(node, options);
 *     handle.on('cellClick', ({ cell }) => console.log(cell));
 *     return handle; // update/destroy are forwarded by Svelte
 *   }
 * </script>
 * <div use:attach />
 * <button on:click={() => handle?.exportTo('csv')}>Export</button>
 * ```
 */
export interface PvotlyHandle {
  /* svelte/action contract -------------------------------------------- */
  update(next: PivotTableOptions): void;
  destroy(): void;

  /* imperative parity surface ----------------------------------------- */
  /** The underlying engine for imperative control. */
  readonly engine: PivotEngine;
  /** The underlying web widget instance. */
  readonly instance: WebPivotTable;
  getConfiguration(): PivotConfiguration;
  setConfiguration(config: PivotConfiguration): void;
  setTheme(theme: ThemeName): void;
  setTokens(tokens: ThemeTokens): void;
  setActionBar(config: ActionBarConfig): void;
  openFieldsDialog(): void;
  openFormatDialog(): void;
  openConditionalDialog(): void;
  openFilterDialog(uniqueName: string): void;
  exportTo(format: ExportFormat, options?: ExportOptions): void;
  print(title?: string): void;
  refresh(): void;
  /** Subscribe to an engine event; returns an unsubscribe function. */
  on<K extends PivotEventName>(event: K, handler: (payload: PivotEventMap[K]) => void): () => void;
  /** Remove a previously-registered event handler. */
  off<K extends PivotEventName>(event: K, handler: (payload: PivotEventMap[K]) => void): void;
}

/**
 * Backwards-compatible alias for the action's return type.
 * @deprecated Prefer {@link PvotlyHandle}.
 */
export type PvotlyActionReturn = PvotlyHandle;

/**
 * Svelte action that mounts a pvotly widget on the host element and returns a
 * full imperative {@link PvotlyHandle}.
 *
 * @param node    The element the action is attached to (`use:pvotly`).
 * @param options The {@link PivotTableOptions} for the widget.
 */
export function pvotly(node: HTMLElement, options: PivotTableOptions): PvotlyHandle {
  const p = new WebPivotTable(node, options);
  return {
    update(next: PivotTableOptions) {
      p.setConfiguration(next);
      if (next.tokens) p.setTokens(next.tokens);
      if (next.actionBar) p.setActionBar(next.actionBar);
      if (next.theme) p.setTheme(next.theme);
    },
    destroy() {
      p.destroy();
    },
    get engine() {
      return p.engine;
    },
    get instance() {
      return p;
    },
    getConfiguration: () => p.getConfiguration(),
    setConfiguration: (config) => p.setConfiguration(config),
    setTheme: (theme) => p.setTheme(theme),
    setTokens: (tokens) => p.setTokens(tokens),
    setActionBar: (config) => p.setActionBar(config),
    openFieldsDialog: () => p.openFieldsDialog(),
    openFormatDialog: () => p.openFormatDialog(),
    openConditionalDialog: () => p.openConditionalDialog(),
    openFilterDialog: (uniqueName) => p.openFilterDialog(uniqueName),
    exportTo: (format, options) => p.exportTo(format, options),
    print: (title) => p.print(title),
    refresh: () => p.refresh(),
    on: (event, handler) => p.on(event, handler),
    off: (event, handler) => p.off(event, handler),
  };
}

// Re-export the web widget + engine types for convenience.
export * from '@pvotly/web';
