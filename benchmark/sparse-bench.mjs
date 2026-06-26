/**
 * Build heap/time on a mostly-empty grid (high row cardinality, each row leaf
 * touching only a few column leaves). `buildGrid` now shares one frozen cell for
 * every empty body cell; to see the win, run this on `main` (dense empty cells)
 * vs this branch (shared empty cell).
 *
 * Run: node --expose-gc benchmark/sparse-bench.mjs [rows]
 */
import { buildGrid, Dataset } from '../packages/core/dist/index.js';

const heapMB = () => process.memoryUsage().heapUsed / 1024 / 1024;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

const user = range(2000, (i) => `user_${i}`);
const item = range(40, (i) => `item_${i}`);
const country = range(12, (i) => `C_${i}`);
const device = range(5, (i) => `D_${i}`);

const ROWS = Number(process.argv[2] ?? 150_000);
const records = range(ROWS, () => ({
  user: pick(user), item: pick(item),
  country: pick(country), device: pick(device),
  amount: Math.random() * 1000,
}));

const config = {
  dataSource: { data: records },
  slice: {
    rows: [{ uniqueName: 'user' }, { uniqueName: 'item' }],
    columns: [{ uniqueName: 'country' }, { uniqueName: 'device' }],
    measures: [{ uniqueName: 'amount', aggregation: 'sum' }],
  },
};

function run(label) {
  if (global.gc) global.gc();
  const before = heapMB();
  const t0 = performance.now();
  const grid = buildGrid(new Dataset({ data: records }), config);
  const build = performance.now() - t0;
  if (global.gc) global.gc();
  const heap = heapMB() - before;

  const t1 = performance.now();
  let sum = 0;
  for (let r = 0; r < Math.min(50, grid.rowLeaves.length); r++) {
    for (let c = 0; c < Math.min(20, grid.columnLeaves.length); c++) {
      const v = grid.getCell(grid.rowLeaves[r], grid.columnLeaves[c], grid.measures[0]).value;
      if (typeof v === 'number') sum += v;
    }
  }
  const vp = performance.now() - t1;

  console.log(
    `  ${label}: build=${build.toFixed(0)}ms  heapΔ(retained)=${heap.toFixed(0)}MB  ` +
    `viewport(50×20)=${vp.toFixed(1)}ms  out=${grid.rowLeaves.length}×${grid.columnLeaves.length}  body=${grid.body.length}`,
  );
}

console.log(`\nbuild on a mostly-empty grid — ${ROWS.toLocaleString()} rows\n`);
run('BUILD ');
console.log();
