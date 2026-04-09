# Skill Layout Contract

This repository uses a three-stage skill layout:

1. Source mirror: `vendor/repos/`
2. Artifact: `vendor/skills/`
3. Host projection: `~/.moluoxixi/skills/`

## Source

- `vendor/repos/` contains cloned remote vendor repositories.
- `constants/skills.js` is the only author-facing manifest for remote vendor sources.
- Local vendor entries are not supported.

## Artifact

- `constants/skills.js` is the source-to-artifact mapping.
- Remote vendor sources are materialized into `vendor/skills/`.
- `vendor/skills/` is the only final artifact tree.
- Its nested directories are classification output, not authoring layout.

## Projection

- `~/.moluoxixi/skills/` is generated from leaf skill directories under `vendor/skills/`.
- Projection is flat by leaf skill name so hosts consume one stable entrypoint tree.
- Duplicate leaf names are errors because they would create ambiguous host-visible skills.

## Installed Home Layout

```text
~/.moluoxixi/
├─ AGENTS.md
├─ agents/
├─ skills/                  # flat host-facing projection
└─ vendor/
   ├─ repos/               # cloned remote vendor sources
   └─ skills/              # classified final artifacts
```
