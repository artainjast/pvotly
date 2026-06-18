import { afterEach, describe, expect, it, vi } from 'vitest';
import { PivotEngine } from './PivotEngine';
import { buildGrid } from './build';
import { serializeGrid } from './serialize';
import { Dataset } from '../data/dataset';
import { SALES } from '../__fixtures__/sales';
import type { PivotConfiguration, PivotGrid, ServerSidePivotRequest } from '../types';
import type { WorkerRequestMessage, WorkerResponseMessage } from './workerProtocol';

const SLICE: PivotConfiguration['slice'] = {
  rows: [{ uniqueName: 'country' }],
  measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PivotEngine: async data source', () => {
  it('loadDataSource ingests from a custom fetcher', async () => {
    const engine = new PivotEngine({ dataSource: { fetcher: async () => SALES }, slice: SLICE });
    expect(engine.hasAsyncSource()).toBe(true);
    expect(engine.getDataset().records).toHaveLength(0);

    await engine.loadDataSource();
    expect(engine.getDataset().records).toHaveLength(SALES.length);
    // Canada revenue = 300 + 80 + 120 = 500.
    const grid = engine.getGrid();
    const canada = grid.rowLeaves.find((n) => n.value === 'Canada')!;
    expect(grid.getCell(canada, grid.columnLeaves[0]!, { uniqueName: 'revenue', aggregation: 'sum' }).value).toBe(500);
    engine.dispose();
  });

  it('refresh re-fetches and re-ingests', async () => {
    let call = 0;
    const engine = new PivotEngine({
      dataSource: {
        fetcher: async () => (call++ === 0 ? SALES.slice(0, 1) : SALES),
      },
      slice: SLICE,
    });
    await engine.loadDataSource();
    expect(engine.getDataset().records).toHaveLength(1);
    await engine.refresh();
    expect(engine.getDataset().records).toHaveLength(SALES.length);
    engine.dispose();
  });

  it('emits dataChange after loading', async () => {
    const engine = new PivotEngine({ dataSource: { fetcher: async () => SALES }, slice: SLICE });
    const onChange = vi.fn();
    engine.on('dataChange', onChange);
    await engine.loadDataSource();
    expect(onChange).toHaveBeenCalledWith({ records: SALES.length });
    engine.dispose();
  });
});

describe('PivotEngine: getGridAsync', () => {
  it('falls back to a local build when no server/worker is configured', async () => {
    const engine = new PivotEngine({ dataSource: { data: SALES }, slice: SLICE });
    const sync = engine.getGrid();
    const async = await engine.getGridAsync();
    expect(async.meta).toEqual(sync.meta);
  });

  it('delegates to serverSide.query when present', async () => {
    const sentinel = { meta: { valuesAxis: 'rows' } } as unknown as PivotGrid;
    let received: ServerSidePivotRequest | undefined;
    const query = vi.fn(async (req: ServerSidePivotRequest) => {
      received = req;
      return sentinel;
    });
    const engine = new PivotEngine({
      dataSource: { data: SALES },
      valuesAxis: 'rows',
      serverSide: { query },
      slice: SLICE,
    });
    const grid = await engine.getGridAsync();
    expect(grid).toBe(sentinel);
    expect(query).toHaveBeenCalledTimes(1);
    expect(received!.valuesAxis).toBe('rows');
    expect(received!.slice).toEqual(SLICE);
  });

  it('builds via a worker (factory) and re-hydrates the grid', async () => {
    class FakeWorker {
      onmessage: ((event: MessageEvent<WorkerResponseMessage>) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      postMessage(msg: WorkerRequestMessage) {
        const grid = serializeGrid(buildGrid(new Dataset(msg.config.dataSource), msg.config));
        queueMicrotask(() =>
          this.onmessage?.({ data: { id: msg.id, grid } } as MessageEvent<WorkerResponseMessage>),
        );
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);

    const engine = new PivotEngine({
      dataSource: { data: SALES },
      options: { useWorker: true, worker: { factory: () => new FakeWorker() as unknown as Worker } },
      slice: SLICE,
    });
    const grid = await engine.getGridAsync();
    const usa = grid.rowLeaves.find((n) => n.value === 'USA')!;
    expect(grid.getCell(usa, grid.columnLeaves[0]!, { uniqueName: 'revenue', aggregation: 'sum' }).value).toBe(350);
    engine.dispose();
  });
});

describe('PivotEngine: incremental rebuild', () => {
  it('slice mutations reuse the ingested dataset (no re-ingest)', () => {
    const engine = new PivotEngine({ dataSource: { data: SALES }, slice: SLICE });
    const ds = engine.getDataset();
    engine.getGrid();
    engine.addToColumns('category');
    engine.getGrid();
    expect(engine.getDataset()).toBe(ds);
  });

  it('setConfiguration reuses data with { reuseData: true }, re-ingests otherwise', () => {
    const engine = new PivotEngine({ dataSource: { data: SALES }, slice: SLICE });
    const ds = engine.getDataset();
    engine.setConfiguration({ dataSource: { data: SALES }, slice: { rows: [{ uniqueName: 'category' }] } }, { reuseData: true });
    expect(engine.getDataset()).toBe(ds);
    engine.setConfiguration({ dataSource: { data: SALES }, slice: SLICE });
    expect(engine.getDataset()).not.toBe(ds);
  });
});
