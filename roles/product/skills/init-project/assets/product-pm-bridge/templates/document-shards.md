# Document Shards

## Decision

N/A - no long source document requires sharding.

## Source Documents

| Source | Size / Reason | Sharded? | Shard Index | Source of Truth |
|---|---|---|---|---|
| — | — | — | — | — |

## Notes

- Use `bmad-shard-doc` only when the source document is too large to inspect reliably.
- Do not keep conflicting original and shard versions without naming the source of truth.
