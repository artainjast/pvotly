import type { AggregationName, DataRecord, DataValue } from '../types';
import type { Dataset } from '../data/dataset';
import { createAggregator, type Aggregator, type AggregatorRegistry } from './aggregate';
import { pathKey, valueToken, type MemberNode, type PathSeg } from './tree';

/** One base aggregation the grid needs: a reducer over a source field (`null` = none). */
export interface AggSpec {
  aggregation: AggregationName;
  field: string | null;
}

/** Member hierarchy of one axis. */
export interface AxisTree {
  /** Top-level members in first-seen order (same shape as `buildMemberTree`). */
  roots: MemberNode[];
}

/** Aggregates of a filtered dataset over every row-prefix × column-prefix bucket. */
export interface Cube {
  rows: AxisTree;
  columns: AxisTree;
  /**
   * Value of `specs[spec]` for the bucket at (`rowKey`, `colKey`) — `MemberNode.key`
   * paths, `''` for the axis total — or `null` when no record falls into it.
   */
  value(rowKey: string, colKey: string, spec: number): number | DataValue;
}

/**
 * Aggregate the `selection` of records (indices into `dataset.records`, in
 * record order) into a cross-tab.
 *
 * Every record is pushed into each (row prefix, column prefix) bucket it belongs
 * to, in record order, exactly like a per-bucket reducer would see it. Member
 * values are dictionary codes from {@link Dataset.encoded}, so grouping walks
 * integer maps instead of building string keys per record.
 */
export function buildCube(
  dataset: Dataset,
  rowFields: string[],
  colFields: string[],
  selection: Int32Array,
  specs: AggSpec[],
  registry?: AggregatorRegistry,
): Cube {
  const rows = new AxisBuilder(dataset, rowFields);
  const cols = new AxisBuilder(dataset, colFields);
  const stores = specs.map((spec) => createStore(spec, dataset, registry));

  // Node ids on one axis never exceed (fields × records), so this stride makes
  // `rowId * stride + colId` a collision-free numeric key.
  const stride = colFields.length * dataset.records.length + 1;
  const bucketOf = new Map<number, number>();
  const bucket = (rowId: number, colId: number): number => {
    const key = rowId * stride + colId;
    let id = bucketOf.get(key);
    if (id === undefined) {
      id = bucketOf.size;
      bucketOf.set(key, id);
      for (const store of stores) store.grow();
    }
    return id;
  };

  // Buckets a record lands in depend only on its leaf (row, column) pair.
  const leafBuckets = new Map<number, Int32Array>();
  let lastKey = -1;
  let lastBuckets: Int32Array = new Int32Array(0);
  const rowChain: number[] = [];
  const colChain: number[] = [];

  for (let s = 0; s < selection.length; s++) {
    const record = selection[s]!;
    const key = rows.leafOf(record) * stride + cols.leafOf(record);
    let buckets = key === lastKey ? lastBuckets : leafBuckets.get(key);
    if (!buckets) {
      rows.chain(Math.floor(key / stride), rowChain);
      cols.chain(key % stride, colChain);
      buckets = new Int32Array(rowChain.length * colChain.length);
      let k = 0;
      for (const r of rowChain) for (const c of colChain) buckets[k++] = bucket(r, c);
      leafBuckets.set(key, buckets);
    }
    lastKey = key;
    lastBuckets = buckets;
    for (let j = 0; j < stores.length; j++) {
      const store = stores[j]!;
      for (let k = 0; k < buckets.length; k++) store.push(buckets[k]!, record);
    }
  }

  return {
    rows: { roots: rows.roots },
    columns: { roots: cols.roots },
    value(rowKey, colKey, spec) {
      const r = rows.idByKey.get(rowKey);
      const c = cols.idByKey.get(colKey);
      if (r === undefined || c === undefined) return null;
      const b = bucketOf.get(r * stride + c);
      return b === undefined ? null : stores[spec]!.value(b);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* axis trees                                                                 */
/* -------------------------------------------------------------------------- */

/** Builds one axis' member tree while assigning integer node ids (root = 0). */
class AxisBuilder {
  readonly roots: MemberNode[] = [];
  readonly idByKey = new Map<string, number>([['', 0]]);
  private readonly codes: Int32Array[];
  private readonly dictionaries: DataValue[][];
  private readonly nodes: Array<MemberNode | null> = [null];
  private readonly parent: number[] = [-1];
  private readonly childByCode: Array<Map<number, number>> = [new Map()];

  constructor(
    private readonly dataset: Dataset,
    private readonly fields: string[],
  ) {
    const columns = fields.map((f) => dataset.encoded(f));
    this.codes = columns.map((c) => c.codes);
    this.dictionaries = columns.map((c) => c.values);
  }

  /** Id of the deepest node on `record`'s path, creating nodes as needed. */
  leafOf(record: number): number {
    let id = 0;
    for (let level = 0; level < this.fields.length; level++) {
      const code = this.codes[level]![record]!;
      const child = this.childByCode[id]!.get(code);
      id = child === undefined ? this.addNode(id, level, code) : child;
    }
    return id;
  }

  /** Fill `out` with `id` and all of its ancestors up to the root. */
  chain(id: number, out: number[]): void {
    out.length = 0;
    for (let n = id; n >= 0; n = this.parent[n]!) out.push(n);
  }

  private addNode(parentId: number, level: number, code: number): number {
    const uniqueName = this.fields[level]!;
    const value = this.dictionaries[level]![code]!;
    const parentNode = this.nodes[parentId] ?? null;
    const path: PathSeg[] = parentNode ? parentNode.path.map((p) => ({ ...p })) : [];
    path.push({ uniqueName, value });
    const node: MemberNode = {
      uniqueName,
      value,
      caption: this.dataset.memberCaption(uniqueName, value),
      level,
      path,
      key: pathKey(path),
      children: new Map(),
      orderedChildren: [],
      leafCount: 0,
    };
    const id = this.nodes.length;
    this.nodes.push(node);
    this.parent.push(parentId);
    this.childByCode.push(new Map());
    this.childByCode[parentId]!.set(code, id);
    this.idByKey.set(node.key, id);
    if (parentNode) parentNode.children.set(valueToken(value), node);
    else this.roots.push(node);
    return id;
  }
}

/* -------------------------------------------------------------------------- */
/* aggregate stores                                                           */
/* -------------------------------------------------------------------------- */

/** Per-bucket state for one {@link AggSpec}; buckets are dense ids from 0. */
interface Store {
  grow(): void;
  push(bucket: number, record: number): void;
  value(bucket: number): number | DataValue;
}

/**
 * Pick a store for a spec. The common built-in reducers get array-backed stores
 * over the field's numeric column; they apply the same arithmetic, in the same
 * order, as the matching {@link Aggregator}. Everything else (median, variance,
 * distinct count, first/last, custom reducers) uses the regular aggregators.
 */
function createStore(spec: AggSpec, dataset: Dataset, registry?: AggregatorRegistry): Store {
  const { aggregation, field } = spec;
  if (aggregation === 'count') return new CountStore();
  if (field !== null) {
    switch (aggregation) {
      case 'sum':
        return new SumStore(dataset.numbers(field));
      case 'average':
        return new AverageStore(dataset.numbers(field));
      case 'min':
        return new ExtremumStore(dataset.numbers(field), Math.min);
      case 'max':
        return new ExtremumStore(dataset.numbers(field), Math.max);
      case 'product':
        return new ProductStore(dataset.numbers(field));
    }
  }
  return new AggregatorStore(
    () => createAggregator(aggregation, registry),
    field === null ? null : dataset.values(field),
    dataset.records,
  );
}

class CountStore implements Store {
  private readonly counts: number[] = [];
  grow(): void {
    this.counts.push(0);
  }
  push(bucket: number): void {
    this.counts[bucket] = this.counts[bucket]! + 1;
  }
  value(bucket: number): number {
    return this.counts[bucket]!;
  }
}

class SumStore implements Store {
  private readonly sums: number[] = [];
  private readonly has: boolean[] = [];
  constructor(private readonly numbers: Float64Array) {}
  grow(): void {
    this.sums.push(0);
    this.has.push(false);
  }
  push(bucket: number, record: number): void {
    const v = this.numbers[record]!;
    if (v === v) {
      this.sums[bucket] = this.sums[bucket]! + v;
      this.has[bucket] = true;
    }
  }
  value(bucket: number): number | null {
    return this.has[bucket] ? this.sums[bucket]! : null;
  }
}

class AverageStore implements Store {
  private readonly sums: number[] = [];
  private readonly counts: number[] = [];
  constructor(private readonly numbers: Float64Array) {}
  grow(): void {
    this.sums.push(0);
    this.counts.push(0);
  }
  push(bucket: number, record: number): void {
    const v = this.numbers[record]!;
    if (v === v) {
      this.sums[bucket] = this.sums[bucket]! + v;
      this.counts[bucket] = this.counts[bucket]! + 1;
    }
  }
  value(bucket: number): number | null {
    const n = this.counts[bucket]!;
    return n ? this.sums[bucket]! / n : null;
  }
}

/** Min or max; `NaN` marks a bucket that has seen no number yet. */
class ExtremumStore implements Store {
  private readonly best: number[] = [];
  constructor(
    private readonly numbers: Float64Array,
    private readonly pick: (a: number, b: number) => number,
  ) {}
  grow(): void {
    this.best.push(NaN);
  }
  push(bucket: number, record: number): void {
    const v = this.numbers[record]!;
    if (v === v) {
      const current = this.best[bucket]!;
      this.best[bucket] = current === current ? this.pick(current, v) : v;
    }
  }
  value(bucket: number): number | null {
    const v = this.best[bucket]!;
    return v === v ? v : null;
  }
}

class ProductStore implements Store {
  private readonly products: number[] = [];
  private readonly has: boolean[] = [];
  constructor(private readonly numbers: Float64Array) {}
  grow(): void {
    this.products.push(1);
    this.has.push(false);
  }
  push(bucket: number, record: number): void {
    const v = this.numbers[record]!;
    if (v === v) {
      this.products[bucket] = this.products[bucket]! * v;
      this.has[bucket] = true;
    }
  }
  value(bucket: number): number | null {
    return this.has[bucket] ? this.products[bucket]! : null;
  }
}

class AggregatorStore implements Store {
  private readonly aggregators: Aggregator[] = [];
  constructor(
    private readonly create: () => Aggregator,
    private readonly values: DataValue[] | null,
    private readonly records: DataRecord[],
  ) {}
  grow(): void {
    this.aggregators.push(this.create());
  }
  push(bucket: number, record: number): void {
    this.aggregators[bucket]!.push(this.values ? this.values[record]! : null, this.records[record]!);
  }
  value(bucket: number): number | DataValue {
    return this.aggregators[bucket]!.value();
  }
}
