import {
  defineComponent,
  h as createElement,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type PropType,
} from 'vue';
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
  DataSourceConfig,
  Slice,
  PivotOptions,
  NumberFormat,
  ConditionalFormat,
  Localization,
  PivotConfiguration,
  PivotEngine,
  PivotEventMap,
  PivotEventName,
} from '@pvotly/core';

/**
 * Map of the widget event names to the Vue `emit` event names. Vue components
 * surface events through `emits`/`$emit`; we forward each engine event with its
 * payload untouched.
 */
const EVENTS: PivotEventName[] = [
  'ready',
  'reportChange',
  'dataChange',
  'cellClick',
  'cellDoubleClick',
  'filterChange',
  'sortChange',
  'drillThrough',
  'error',
];

/**
 * Imperative handle exposed via the component instance (template `ref`),
 * mirroring the React wrapper's `PivotTableHandle` surface so every framework
 * binding offers the same capabilities.
 *
 * @example
 * ```ts
 * const pivot = ref<PivotTableHandle>();
 * pivot.value?.exportTo('csv');
 * ```
 */
export interface PivotTableHandle {
  /** The underlying engine for imperative control (undefined before mount). */
  readonly engine: PivotEngine | undefined;
  /** The underlying web widget instance (null before mount). */
  readonly instance: WebPivotTable | null;
  getConfiguration(): PivotConfiguration | undefined;
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
}

/**
 * Declarative Vue 3 wrapper around the `@pvotly/web` widget.
 *
 * Authored with `defineComponent` + a render function (no `.vue` SFC) so it can
 * be bundled with tsup/esbuild without a Vue compiler step.
 *
 * @example
 * ```ts
 * import { PivotTable } from '@pvotly/vue';
 * import '@pvotly/web/styles.css';
 *
 * // In a template:
 * // <PivotTable :data-source="{ data }" :slice="slice" @cell-click="onCellClick" />
 * ```
 */
export const PivotTable = defineComponent({
  name: 'PivotTable',
  props: {
    /** Input data: in-memory `data`, `matrix`, or `csv` text. */
    dataSource: { type: Object as PropType<DataSourceConfig>, default: undefined },
    /** Report definition: rows, columns, measures, filters, etc. */
    slice: { type: Object as PropType<Slice>, default: undefined },
    /** Grid behavior options (grid type, totals, headers, etc.). */
    options: { type: Object as PropType<PivotOptions>, default: undefined },
    /** Named number formats referenced by measures. */
    formats: { type: Array as PropType<NumberFormat[]>, default: undefined },
    /** Conditional cell-styling rules. */
    conditions: { type: Array as PropType<ConditionalFormat[]>, default: undefined },
    /** Caption / label overrides. */
    localization: { type: Object as PropType<Localization>, default: undefined },
    /** Theme name (default 'light'). */
    theme: { type: String as PropType<ThemeName>, default: undefined },
    /** Typed style tokens applied as CSS variables. */
    tokens: { type: Object as PropType<ThemeTokens>, default: undefined },
    /** Configure / style the action bar. */
    actionBar: { type: Object as PropType<ActionBarConfig>, default: undefined },
    /** Show the toolbar (default true). */
    toolbar: { type: Boolean as PropType<boolean>, default: undefined },
    /** Show the drag-and-drop field-list panel (default true). */
    fieldList: { type: Boolean as PropType<boolean>, default: undefined },
    /** CSS height for the widget (e.g. 500 or '60vh'). */
    height: { type: [String, Number] as PropType<string | number>, default: undefined },
    /** CSS width. */
    width: { type: [String, Number] as PropType<string | number>, default: undefined },
  },
  emits: {
    ready: () => true,
    reportChange: (_payload: PivotEventMap['reportChange']) => true,
    dataChange: (_payload: PivotEventMap['dataChange']) => true,
    cellClick: (_payload: PivotEventMap['cellClick']) => true,
    cellDoubleClick: (_payload: PivotEventMap['cellDoubleClick']) => true,
    filterChange: (_payload: PivotEventMap['filterChange']) => true,
    sortChange: (_payload: PivotEventMap['sortChange']) => true,
    drillThrough: (_payload: PivotEventMap['drillThrough']) => true,
    error: (_payload: PivotEventMap['error']) => true,
  },
  setup(props, { emit, expose }) {
    const host = ref<HTMLDivElement | null>(null);
    let instance: WebPivotTable | null = null;
    const unsubs: Array<() => void> = [];

    /** Build a `PivotTableOptions` object from the currently-set props. */
    const buildOptions = (): PivotTableOptions => {
      const opts: PivotTableOptions = {
        dataSource: props.dataSource as DataSourceConfig,
      };
      if (props.slice !== undefined) opts.slice = props.slice;
      if (props.options !== undefined) opts.options = props.options;
      if (props.formats !== undefined) opts.formats = props.formats;
      if (props.conditions !== undefined) opts.conditions = props.conditions;
      if (props.localization !== undefined) opts.localization = props.localization;
      if (props.theme !== undefined) opts.theme = props.theme;
      if (props.tokens !== undefined) opts.tokens = props.tokens;
      if (props.actionBar !== undefined) opts.actionBar = props.actionBar;
      if (props.toolbar !== undefined) opts.toolbar = props.toolbar;
      if (props.fieldList !== undefined) opts.fieldList = props.fieldList;
      if (props.height !== undefined) opts.height = props.height;
      if (props.width !== undefined) opts.width = props.width;
      return opts;
    };

    onMounted(() => {
      const el = host.value;
      if (!el) return;
      instance = new WebPivotTable(el, buildOptions());

      // Bridge engine events to Vue emits, payloads forwarded untouched.
      //
      // `emit` is generated by `defineComponent` as an *overloaded* function
      // (one signature per declared event name), so passing the runtime union
      // `name: PivotEventName` fails overload resolution and breaks `.d.ts`
      // generation (TS2769). Widen it once to a single generic signature.
      const emitEvent = emit as (event: PivotEventName, payload: unknown) => void;
      for (const name of EVENTS) {
        const unsub = instance.on(name, ((payload: PivotEventMap[typeof name]) => {
          emitEvent(name, payload);
        }) as never);
        unsubs.push(unsub);
      }
    });

    // Push config-affecting prop changes into the widget.
    watch(
      () => [
        props.dataSource,
        props.slice,
        props.options,
        props.formats,
        props.conditions,
        props.localization,
      ],
      () => {
        instance?.setConfiguration({
          dataSource: props.dataSource as DataSourceConfig,
          slice: props.slice,
          options: props.options,
          formats: props.formats,
          conditions: props.conditions,
          localization: props.localization,
        });
      },
      { deep: true },
    );

    // Theme updates without a full reset.
    watch(
      () => props.theme,
      (theme) => {
        if (theme) instance?.setTheme(theme);
      },
    );

    // Style tokens applied reactively.
    watch(
      () => props.tokens,
      (tokens) => {
        if (tokens) instance?.setTokens(tokens);
      },
      { deep: true },
    );

    // Action-bar config applied reactively.
    watch(
      () => props.actionBar,
      (actionBar) => {
        if (actionBar) instance?.setActionBar(actionBar);
      },
      { deep: true },
    );

    onUnmounted(() => {
      for (const unsub of unsubs.splice(0)) unsub();
      instance?.destroy();
      instance = null;
    });

    // Imperative access to the widget + engine, at parity with the React handle.
    const handle: PivotTableHandle = {
      get instance() {
        return instance;
      },
      get engine() {
        return instance?.engine;
      },
      getConfiguration: () => instance?.getConfiguration(),
      setConfiguration: (config) => instance?.setConfiguration(config),
      setTheme: (theme) => instance?.setTheme(theme),
      setTokens: (tokens) => instance?.setTokens(tokens),
      setActionBar: (config) => instance?.setActionBar(config),
      openFieldsDialog: () => instance?.openFieldsDialog(),
      openFormatDialog: () => instance?.openFormatDialog(),
      openConditionalDialog: () => instance?.openConditionalDialog(),
      openFilterDialog: (uniqueName) => instance?.openFilterDialog(uniqueName),
      exportTo: (format, options) => instance?.exportTo(format, options),
      print: (title) => instance?.print(title),
      refresh: () => instance?.refresh(),
    };
    expose(handle);

    return () => createElement('div', { ref: host });
  },
});

export default PivotTable;
