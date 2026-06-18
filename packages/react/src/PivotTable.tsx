import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { CSSProperties } from 'react';
import { PivotTable as WebPivotTable, type PivotTableOptions } from '@pvotly/web';
import type {
  ExportFormat,
  ExportOptions,
  ThemeName,
  ThemeTokens,
  ActionBarConfig,
} from '@pvotly/web';
import type {
  PivotConfiguration,
  PivotEngine,
  PivotEventMap,
} from '@pvotly/core';

type EventHandlers = {
  onReady?: () => void;
  onReportChange?: (config: PivotEventMap['reportChange']) => void;
  onDataChange?: (payload: PivotEventMap['dataChange']) => void;
  onCellClick?: (payload: PivotEventMap['cellClick']) => void;
  onCellDoubleClick?: (payload: PivotEventMap['cellDoubleClick']) => void;
  onFilterChange?: (payload: PivotEventMap['filterChange']) => void;
  onSortChange?: (payload: PivotEventMap['sortChange']) => void;
  onDrillThrough?: (payload: PivotEventMap['drillThrough']) => void;
  onError?: (payload: PivotEventMap['error']) => void;
};

export interface PivotTableProps extends PivotTableOptions, EventHandlers {
  className?: string;
  style?: CSSProperties;
}

export interface PivotTableHandle {
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
}

const EVENT_MAP: Array<[keyof EventHandlers, keyof PivotEventMap]> = [
  ['onReady', 'ready'],
  ['onReportChange', 'reportChange'],
  ['onDataChange', 'dataChange'],
  ['onCellClick', 'cellClick'],
  ['onCellDoubleClick', 'cellDoubleClick'],
  ['onFilterChange', 'filterChange'],
  ['onSortChange', 'sortChange'],
  ['onDrillThrough', 'drillThrough'],
  ['onError', 'error'],
];

function pivotConfigurationFromProps(props: PivotTableProps): PivotConfiguration {
  return {
    dataSource: props.dataSource,
    slice: props.slice,
    options: props.options,
    formats: props.formats,
    conditions: props.conditions,
    localization: props.localization,
    valuesAxis: props.valuesAxis,
    customAggregators: props.customAggregators,
    locale: props.locale,
    serverSide: props.serverSide,
  };
}

function configKey(props: PivotTableProps): string {
  return JSON.stringify(pivotConfigurationFromProps(props), (_k, v) =>
    typeof v === 'function' ? '[fn]' : v,
  );
}

/**
 * Declarative React wrapper around the `@pvotly/web` widget.
 *
 * @example
 * ```tsx
 * <PivotTable
 *   dataSource={{ data }}
 *   slice={{ rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Sales' }] }}
 *   onCellClick={({ cell }) => console.log(cell)}
 * />
 * ```
 */
export const PivotTable = forwardRef<PivotTableHandle, PivotTableProps>(function PivotTable(
  props,
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<WebPivotTable | null>(null);
  const handlersRef = useRef<EventHandlers>(props);
  handlersRef.current = props;

  // Create the widget once on mount.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Strip React-only props (className/style) and the event-handler props so
    // only the serializable PivotConfiguration + UI options reach the widget
    // (the engine deep-clones its config and would choke on function values).
    const {
      className: _c,
      style: _s,
      onReady: _onReady,
      onReportChange: _onReportChange,
      onDataChange: _onDataChange,
      onCellClick: _onCellClick,
      onCellDoubleClick: _onCellDoubleClick,
      onFilterChange: _onFilterChange,
      onSortChange: _onSortChange,
      onDrillThrough: _onDrillThrough,
      onError: _onError,
      ...options
    } = props;
    const instance = new WebPivotTable(host, options as PivotTableOptions);
    instanceRef.current = instance;

    // Bridge events to the latest prop handlers (kept in a ref).
    const unsubs = EVENT_MAP.map(([propName, eventName]) =>
      instance.on(eventName as 'cellClick', ((payload: unknown) => {
        const handler = handlersRef.current[propName] as ((p: unknown) => void) | undefined;
        handler?.(payload);
      }) as never),
    );

    return () => {
      unsubs.forEach((u) => u());
      instance.destroy();
      instanceRef.current = null;
    };
  }, []);

  // Push config changes into the widget.
  const key = configKey(props);
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    instance.setConfiguration(pivotConfigurationFromProps(props));
  }, [key]);

  // Theme updates without a full reset.
  useEffect(() => {
    if (props.theme) instanceRef.current?.setTheme(props.theme);
  }, [props.theme]);

  // Style tokens (the `tokens` prop) applied reactively.
  const tokensKey = JSON.stringify(props.tokens ?? null);
  useEffect(() => {
    if (props.tokens) instanceRef.current?.setTokens(props.tokens);
  }, [tokensKey]);

  // Action-bar config applied reactively (functions compared by presence only).
  const actionBarKey = JSON.stringify(props.actionBar ?? null, (_k, v) =>
    typeof v === 'function' ? '[fn]' : v,
  );
  useEffect(() => {
    if (props.actionBar) instanceRef.current?.setActionBar(props.actionBar);
  }, [actionBarKey]);

  useImperativeHandle(
    ref,
    (): PivotTableHandle => {
      return {
        get engine() {
          return instanceRef.current!.engine;
        },
        get instance() {
          return instanceRef.current!;
        },
        getConfiguration: () => instanceRef.current!.getConfiguration(),
        setConfiguration: (config) => instanceRef.current!.setConfiguration(config),
        setTheme: (theme) => instanceRef.current!.setTheme(theme),
        setTokens: (tokens) => instanceRef.current!.setTokens(tokens),
        setActionBar: (config) => instanceRef.current!.setActionBar(config),
        openFieldsDialog: () => instanceRef.current!.openFieldsDialog(),
        openFormatDialog: () => instanceRef.current!.openFormatDialog(),
        openConditionalDialog: () => instanceRef.current!.openConditionalDialog(),
        openFilterDialog: (uniqueName) => instanceRef.current!.openFilterDialog(uniqueName),
        exportTo: (format, options) => instanceRef.current!.exportTo(format, options),
        print: (title) => instanceRef.current!.print(title),
        refresh: () => instanceRef.current!.refresh(),
      };
    },
    [],
  );

  return <div ref={hostRef} className={props.className} style={props.style} />;
});
