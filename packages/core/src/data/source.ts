/**
 * Async / remote data-source resolution for @pvotly/core.
 *
 * A {@link DataSourceConfig} can describe its data three ways:
 *  - inline (`data` / `matrix` / `csv`) — synchronous, the default;
 *  - a declarative {@link RemoteDataSource} (`remote: { type: 'remote', url, ... }`);
 *  - a custom `fetcher: () => Promise<DataRecord[]>`.
 *
 * {@link loadDataSource} normalizes all of these into a `DataRecord[]`. The
 * {@link import('../engine/PivotEngine').PivotEngine} uses it to (re)ingest data
 * asynchronously via `loadDataSource()` / `refresh()`.
 *
 * Zero hard dependencies: the global `fetch` is used (browsers, Node 18+, Deno,
 * Bun) and CSV parsing reuses the in-package {@link parseCsv}.
 */

import type { DataRecord, DataSourceConfig, DataValue, RemoteDataSource } from '../types';
import { parseCsv } from './parseCSV';
import { loadRemote } from './remote';

/** True when a source needs an async round-trip to produce its records. */
export function isAsyncSource(source: DataSourceConfig | undefined): boolean {
  if (!source) return false;
  return typeof source.fetcher === 'function' || source.remote?.type === 'remote';
}

/** Convert an array-of-arrays (header row first) into records. */
function matrixToRecords(matrix: DataValue[][]): DataRecord[] {
  if (!matrix.length) return [];
  const [header, ...rows] = matrix;
  const keys = header!.map((h) => String(h));
  return rows.map((row) => {
    const rec: DataRecord = {};
    keys.forEach((k, i) => {
      rec[k] = row[i] ?? null;
    });
    return rec;
  });
}

/** Resolve the synchronous inline portion of a source (data / csv / matrix). */
function inlineRecords(source: DataSourceConfig): DataRecord[] {
  if (source.data) return source.data;
  if (source.csv != null) return parseCsv(source.csv, source.csvOptions);
  if (source.matrix && source.matrix.length) return matrixToRecords(source.matrix);
  return [];
}

/** Fetch + parse (+ transform) a declarative {@link RemoteDataSource}. */
export async function loadRemoteSource(remote: RemoteDataSource): Promise<DataRecord[]> {
  // Without a transform the shared loader already yields records.
  if (!remote.transform) {
    return loadRemote(remote.url, {
      format: remote.format,
      csvOptions: remote.csvOptions,
      fetchOptions: remote.fetchOptions,
    });
  }

  // With a transform we hand the user the parsed payload (JSON value or CSV
  // records) and let them shape it into records.
  let response: Response;
  try {
    response = await fetch(remote.url, remote.fetchOptions);
  } catch (err) {
    throw new Error(`loadRemoteSource: failed to fetch ${remote.url}: ${(err as Error)?.message ?? err}`);
  }
  if (!response.ok) {
    throw new Error(
      `loadRemoteSource: request to ${remote.url} failed with HTTP ${response.status} ${response.statusText}`,
    );
  }

  const text = await response.text();
  let raw: unknown;
  if (remote.format === 'csv') {
    raw = parseCsv(text, remote.csvOptions);
  } else {
    try {
      raw = JSON.parse(text);
    } catch {
      // Fall back to raw text so transform can still handle exotic payloads.
      raw = text;
    }
  }
  return remote.transform(raw);
}

/**
 * Resolve a {@link DataSourceConfig} to its records, awaiting any async source.
 * `fetcher` wins over `remote`, which wins over inline data.
 */
export async function loadDataSource(source: DataSourceConfig): Promise<DataRecord[]> {
  if (typeof source.fetcher === 'function') {
    return source.fetcher();
  }
  if (source.remote?.type === 'remote') {
    return loadRemoteSource(source.remote);
  }
  return inlineRecords(source);
}
