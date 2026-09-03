# Knowledge Organization

## Ownership

`sources/` is the immutable inbox. `library/`, `index.md`, and
`relations.json` are derived project knowledge. `.state.json` records the
source and relation snapshots successfully organized; timestamps do not define
identity.

## Boundaries

Choose the first directory by stable business domain, service, package, or
product module. Within a domain, split by stable entity:

- `apis`: resources and coherent operation groups.
- `models`: schemas and domain objects.
- `events`: messages, topics, and lifecycle events.
- `processes`: multi-step business flows.
- `concepts`: terminology and explanatory material.
- `decisions`: factual architectural decisions and rationale.

Use `shared/` only for genuinely cross-domain material such as authentication
or a common error model. Tags are metadata, not duplicate pages.

Keep a coherent CRUD or lifecycle surface together. Split a page when it has an
independent version, owner, lifecycle, or enough internal structure that one
concept is hard to locate. Prefer semantic cohesion over fixed size thresholds.

## Canonical Pages

Each stable entity has one canonical page. Prefer source identifiers such as
OpenAPI `operationId`; otherwise derive an ID from domain, kind, version, and
stable name. For an API without `operationId`, use version plus method and path.
Link aliases to the canonical page instead of copying content.

Start each page with compact metadata:

```yaml
---
id: api:payments:v1:create-payment
kind: api
domain: payments
sources:
  - .moluoxixi/knowledge/sources/payments.yaml#/paths/~1payments/post
---
```

Record purpose, contract or behavior, data and error semantics, lifecycle,
relationships, deprecation state, and unresolved conflicts. Preserve exact
names and values from authoritative sources.

## Relation Ledger

`relations.json` is the machine-readable source of truth for asset
dependencies. Store one entry per canonical page:

```json
{
  "version": 1,
  "assets": {
    "api:payments:v1:create-payment": {
      "page": "library/payments/apis/create-payment.md",
      "sources": [
        {
          "path": "payments.yaml",
          "selector": "#/paths/~1payments/post",
          "sha256": "<current lowercase SHA-256>"
        }
      ]
    }
  }
}
```

`page` is relative to the knowledge root and must stay under `library/`.
`path` is relative to `sources/`; omit `selector` only when the whole file
supports the asset. Obtain hashes from `knowledge.py sources --json`. Each
library file must appear in exactly one asset entry. The runtime derives the
reverse source-to-asset index from this ledger and compares it with the previous
acknowledged snapshot.

## Source Changes

- Addition or modification: update affected pages, the index, and every
  relation hash that reviewed the changed source.
- Duplicate: merge evidence into the canonical page when identity is certain.
- Conflict: preserve both claims and ask which source is authoritative.
- Deletion: remove unsupported claims and the deleted-source relation. Delete
  the page and asset entry when no source supports the asset; keep both when
  other valid sources still support it.
- Rename: update the source path when identity is certain; otherwise retain
  delete-plus-add semantics.

## Index

Keep `index.md` compact: list domains and canonical pages with a one-line purpose
plus pending or conflict status. It is navigation, not a copy of the library.
Avoid generated timestamps so unchanged knowledge stays diff-stable.

Before acknowledgement, rerun status and resolve every relation error. A stale
hash means the referenced source version has not yet been reviewed, even when
the page text does not need to change.
