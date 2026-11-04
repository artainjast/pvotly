---
'@pvotly/core': minor
---

Sparse body: empty (null-valued) intersections now share one frozen `PivotCell`
instead of each getting a distinct object, so heap is bounded by the non-empty
cells (~4.5–5× less retained heap, ~2.4–2.6× faster build on high-cardinality,
mostly-empty pivots). Output through `getCell` is unchanged.

- Empty cells are kept out of the cell index and served as a shared singleton,
  **unless** the measure carries/renders something on blanks — a sequence-based
  show-as (running total / rank / prev-delta), a `nullValue` format, or a
  conditional rule that matches `null` — in which case its empty cells are
  materialized as real, indexed cells (checked once per measure).
- `getCell` (and `deserializeGrid`'s fallback) now derive `isTotal` /
  `isGrandTotal` for a synthesized blank from the row/column header nodes, so an
  empty subtotal/grand-total cell keeps its shading.
- **Note:** reading `grid.body[r][c]` directly for an *empty* cell now returns the
  shared singleton (`measure: ''`, empty paths) rather than a distinct per-cell
  object. `body` is public, but consumers should read cells through `getCell`,
  which is unaffected; in-repo only `deserializeGrid` reads `body`, and it still
  works.
