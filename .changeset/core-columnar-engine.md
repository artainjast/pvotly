---
'@pvotly/core': minor
---

Faster pivot builds and interactions on large datasets (same output, verified against the previous engine on 18,000 random reports):

- Grouping and aggregation now run on dictionary-encoded columns with integer bucket ids, in a single pass that also builds both axis trees (previously nested string-keyed maps plus a second pass).
- Record-level filters are evaluated once per distinct member instead of once per record, and no longer copy the record array when nothing is filtered.
- `Dataset.parseName` is cached; member sorting reuses one `Intl.Collator`.
- `reportChange` is only built when a listener is subscribed, and `getConfiguration()` / `reportChange` no longer deep-copy every data row. **Behavior change:** the row objects in a returned configuration's `dataSource.data` / `matrix` are now shared with the engine; treat them as read-only.
- A built grid no longer keeps the aggregation state alive through `getCell`.
- New: `Dataset.values()`, `Dataset.encoded()`, `Dataset.numbers()` column accessors and `EventEmitter.listenerCount()`.
