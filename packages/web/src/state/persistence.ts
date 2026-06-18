import type { PivotConfiguration } from '@pvotly/core';
import type { UIStateData } from './uiState';

/** A complete, serializable snapshot of a pivot widget (report + UI state). */
export interface PivotSnapshot {
  /** Schema version, for forward-compatible restores. */
  version: 1;
  /** The full report. Bulk data is stripped unless `includeData` is set. */
  report: PivotConfiguration;
  /** Renderer UI state (sizes / freeze). */
  ui?: UIStateData;
}

export interface SerializeOptions {
  /**
   * Include the raw `dataSource` rows (`data` / `matrix` / `csv`). Off by
   * default — snapshots store the report *shape*, not the (potentially huge)
   * dataset, so URLs / localStorage stay small. The `mapping` is always kept.
   */
  includeData?: boolean;
}

const DEFAULT_HASH_KEY = 'pivot';
const DEFAULT_STORAGE_KEY = 'pvotly:state';

/** Strip the bulk dataset from a report, preserving field mappings. */
function stripData(report: PivotConfiguration): PivotConfiguration {
  const { dataSource, ...rest } = report;
  return {
    ...rest,
    dataSource: dataSource?.mapping ? { mapping: dataSource.mapping } : {},
  };
}

/** Build a {@link PivotSnapshot} from a report + UI state. */
export function createSnapshot(
  report: PivotConfiguration,
  ui?: UIStateData,
  options: SerializeOptions = {},
): PivotSnapshot {
  return {
    version: 1,
    report: options.includeData ? report : stripData(report),
    ui,
  };
}

/** JSON-encode a snapshot. */
export function serializeSnapshot(
  report: PivotConfiguration,
  ui?: UIStateData,
  options: SerializeOptions = {},
): string {
  return JSON.stringify(createSnapshot(report, ui, options));
}

/** Parse a JSON snapshot string. Returns `null` on malformed input. */
export function parseSnapshot(json: string | null | undefined): PivotSnapshot | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as PivotSnapshot;
    if (!parsed || typeof parsed !== 'object' || !parsed.report) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ---- localStorage -------------------------------------------------------- */

export function saveToLocalStorage(
  report: PivotConfiguration,
  ui?: UIStateData,
  options: SerializeOptions & { key?: string } = {},
): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(
      options.key ?? DEFAULT_STORAGE_KEY,
      serializeSnapshot(report, ui, options),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadFromLocalStorage(key = DEFAULT_STORAGE_KEY): PivotSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return parseSnapshot(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function clearLocalStorage(key = DEFAULT_STORAGE_KEY): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ---- URL hash ------------------------------------------------------------ */

function encodeHashValue(json: string): string {
  // base64url keeps the hash compact and free of reserved characters.
  try {
    const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : json;
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return encodeURIComponent(json);
  }
}

function decodeHashValue(value: string): string {
  try {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(b64)));
    return decodeURIComponent(value);
  } catch {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
}

/** Read `#pivot=...` style params out of a location hash. */
function readHashParams(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = hash.replace(/^#/, '');
  if (!raw) return out;
  for (const part of raw.split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[decodeURIComponent(part.slice(0, eq))] = part.slice(eq + 1);
  }
  return out;
}

function writeHashParams(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${v}`)
    .join('&');
}

/** Encode a snapshot into a URL hash fragment value (base64url). */
export function encodeSnapshotToHash(
  report: PivotConfiguration,
  ui?: UIStateData,
  options: SerializeOptions = {},
): string {
  return encodeHashValue(serializeSnapshot(report, ui, options));
}

/** Persist a snapshot into `location.hash` under `key` (default `pivot`). */
export function saveToUrlHash(
  report: PivotConfiguration,
  ui?: UIStateData,
  options: SerializeOptions & { key?: string } = {},
): boolean {
  if (typeof location === 'undefined' || typeof history === 'undefined') return false;
  const key = options.key ?? DEFAULT_HASH_KEY;
  const params = readHashParams(location.hash);
  params[key] = encodeSnapshotToHash(report, ui, options);
  try {
    history.replaceState(null, '', `#${writeHashParams(params)}`);
    return true;
  } catch {
    location.hash = writeHashParams(params);
    return true;
  }
}

/** Restore a snapshot previously stored in `location.hash`. */
export function loadFromUrlHash(key = DEFAULT_HASH_KEY): PivotSnapshot | null {
  if (typeof location === 'undefined') return null;
  const params = readHashParams(location.hash);
  const value = params[key];
  if (!value) return null;
  return parseSnapshot(decodeHashValue(value));
}
