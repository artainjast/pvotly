/**
 * Remote data sources for @pvotly/core.
 *
 * Fetch a URL and turn the response into `DataRecord[]` (or a ready-to-use
 * {@link DataSourceConfig}) so a remote JSON / CSV endpoint can feed a
 * `PivotEngine` / `PivotTable` directly:
 *
 * @example
 * ```ts
 * const config = await dataSourceFromUrl('/api/sales.csv');
 * const engine = new PivotEngine({ dataSource: config, slice });
 * ```
 *
 * Keeps zero hard dependencies: JSON parsing is native and CSV parsing reuses
 * the in-package {@link parseCsv}. The global `fetch` is used (available in
 * modern browsers, Node 18+, Deno and Bun).
 */

import type { CsvParseOptions, DataRecord, DataSourceConfig } from '../types';
import { parseCsv } from './parseCSV';

/** Explicit format hint for a remote payload. */
export type RemoteFormat = 'json' | 'csv';

/** Options controlling how a remote resource is fetched and parsed. */
export interface RemoteOptions {
  /**
   * Payload format. When omitted it is inferred from the response
   * `Content-Type` header, then from the URL extension, defaulting to `json`.
   */
  format?: RemoteFormat;
  /** Options applied when the payload is parsed as CSV. */
  csvOptions?: CsvParseOptions;
  /** Passed straight through to `fetch` (headers, method, credentials, signal...). */
  fetchOptions?: RequestInit;
}

/** Infer a {@link RemoteFormat} from a content-type header and/or URL. */
function inferFormat(url: string, contentType: string | null): RemoteFormat {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('csv')) return 'csv';
  if (ct.includes('json')) return 'json';
  // Strip query/hash before checking the extension.
  const path = url.split(/[?#]/, 1)[0]!.toLowerCase();
  if (path.endsWith('.csv') || path.endsWith('.tsv')) return 'csv';
  if (path.endsWith('.json')) return 'json';
  return 'json';
}

/** Normalize a parsed JSON payload into a flat array of records. */
function jsonToRecords(parsed: unknown): DataRecord[] {
  if (Array.isArray(parsed)) return parsed as DataRecord[];
  if (parsed && typeof parsed === 'object') {
    // Tolerate common envelope shapes: { data: [...] } / { records: [...] }.
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as DataRecord[];
    if (Array.isArray(obj.records)) return obj.records as DataRecord[];
    if (Array.isArray(obj.rows)) return obj.rows as DataRecord[];
  }
  throw new Error(
    'loadRemote: expected a JSON array of records (or an object with a "data"/"records"/"rows" array).',
  );
}

/**
 * Fetch `url` and parse the response into an array of {@link DataRecord}.
 *
 * The format is taken from `opts.format`, otherwise inferred from the response
 * `Content-Type` header and finally from the URL extension (defaulting to JSON).
 *
 * @throws if the request fails (non-2xx) or the payload cannot be parsed.
 */
export async function loadRemote(url: string, opts: RemoteOptions = {}): Promise<DataRecord[]> {
  let response: Response;
  try {
    response = await fetch(url, opts.fetchOptions);
  } catch (err) {
    throw new Error(`loadRemote: failed to fetch ${url}: ${(err as Error)?.message ?? err}`);
  }
  if (!response.ok) {
    throw new Error(`loadRemote: request to ${url} failed with HTTP ${response.status} ${response.statusText}`);
  }

  const format = opts.format ?? inferFormat(url, response.headers.get('content-type'));
  const text = await response.text();

  if (format === 'csv') {
    return parseCsv(text, opts.csvOptions);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`loadRemote: failed to parse JSON from ${url}: ${(err as Error)?.message ?? err}`);
  }
  return jsonToRecords(parsed);
}

/**
 * Fetch `url` and return a {@link DataSourceConfig} ready to hand to a
 * `PivotEngine` / `PivotTable` (i.e. `{ data }`).
 */
export async function dataSourceFromUrl(url: string, opts: RemoteOptions = {}): Promise<DataSourceConfig> {
  const data = await loadRemote(url, opts);
  return { data };
}
