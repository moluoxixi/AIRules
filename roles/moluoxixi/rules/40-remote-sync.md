# Remote role synchronization

- Treat `roles/moluoxixi/**` as one versioned, full-sync unit.
- Validate the complete role, file manifest, and content hashes before publication.
- Stage remote updates in a temporary location, validate them, then switch atomically; retain a last-known-good version for rollback.
- Never mix project runtime state, evidence, approved project memory, credentials, caches, or local overrides into the role path.
- Reject partial asset updates that would make the skill, agents, hooks, rules, MCP server, scripts, or templates refer to different role versions.
- Keep client-specific discovery and configuration in adapters; do not invent unsupported fields in a Codex plugin manifest.
