import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAsyncSource, loadDataSource, loadRemoteSource } from './source';
import type { DataRecord } from '../types';

function fakeResponse(body: string, contentType = 'application/json'): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isAsyncSource', () => {
  it('detects fetcher and remote sources', () => {
    expect(isAsyncSource({ data: [] })).toBe(false);
    expect(isAsyncSource({ fetcher: async () => [] })).toBe(true);
    expect(isAsyncSource({ remote: { type: 'remote', url: '/x' } })).toBe(true);
    expect(isAsyncSource(undefined)).toBe(false);
  });
});

describe('loadDataSource', () => {
  it('returns inline data as-is', async () => {
    const data: DataRecord[] = [{ a: 1 }];
    await expect(loadDataSource({ data })).resolves.toBe(data);
  });

  it('parses inline csv and matrix', async () => {
    const csv = await loadDataSource({ csv: 'a,b\n1,2' });
    expect(csv).toEqual([{ a: 1, b: 2 }]);
    const matrix = await loadDataSource({ matrix: [['a', 'b'], [1, 2]] });
    expect(matrix).toEqual([{ a: 1, b: 2 }]);
  });

  it('calls a custom fetcher', async () => {
    const rows = [{ x: 10 }];
    await expect(loadDataSource({ fetcher: async () => rows })).resolves.toBe(rows);
  });

  it('fetcher wins over remote', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const rows = await loadDataSource({
      fetcher: async () => [{ via: 'fetcher' }],
      remote: { type: 'remote', url: '/should-not-be-called' },
    });
    expect(rows).toEqual([{ via: 'fetcher' }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('loads a remote JSON endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(JSON.stringify([{ id: 1 }, { id: 2 }]))));
    const rows = await loadDataSource({ remote: { type: 'remote', url: '/api/data.json' } });
    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('loads a remote CSV endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse('a,b\n1,2', 'text/csv')));
    const rows = await loadDataSource({ remote: { type: 'remote', url: '/api/data.csv' } });
    expect(rows).toEqual([{ a: 1, b: 2 }]);
  });
});

describe('loadRemoteSource: transform', () => {
  it('hands the parsed JSON payload to transform', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(JSON.stringify({ result: { rows: [{ v: 1 }] } }))));
    const rows = await loadRemoteSource({
      type: 'remote',
      url: '/api/envelope.json',
      transform: (raw) => (raw as { result: { rows: DataRecord[] } }).result.rows,
    });
    expect(rows).toEqual([{ v: 1 }]);
  });

  it('throws a clear error on a non-2xx response (no transform)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, statusText: 'Server Error', text: async () => '' }) as unknown as Response),
    );
    await expect(loadRemoteSource({ type: 'remote', url: '/api/fail' })).rejects.toThrow(/HTTP 500/);
  });
});
