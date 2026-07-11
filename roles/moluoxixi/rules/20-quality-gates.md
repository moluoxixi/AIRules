# Quality gates

- Define measurable acceptance criteria before test design and design tests before implementation planning.
- Require all acceptance criteria to have tests, all tests to have task ownership, all tasks to finish, and all tests to have fresh passing evidence.
- Configure validation explicitly per project; never assume `npm test`, a fixed coverage percentage, or one universal toolchain.
- Bind evidence to case revision, actor, timestamp, method, outcome, and hash. Invalidate affected evidence after implementation changes.
- Distinguish product failure, assertion failure, timeout, flaky result, skipped check, and infrastructure block.
- Keep implementer, verifier, and reviewer identities distinct when separation of duties is enabled.
- Review findings by severity and resolve all blocking findings before delivery.
- Require exact delivered revision, rollout or handoff, rollback, residual risk, and evidence links.
- Allow only configured waivers with approver, rationale, expiry, affected IDs, and compensating control. Never waive evidence integrity or required approval.
