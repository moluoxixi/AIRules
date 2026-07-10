---
name: correction-loop
description: Classify a failed requirement, design, test, implementation, environment, flaky, or security gate and run a bounded evidence-backed correction. Use immediately after any test failure, review finding, unexpected behavior, or repeated unsuccessful fix attempt.
---

# Route a bounded correction

1. Preserve the failing command, output, inputs, environment, and minimal reproduction.
2. Classify the failure before changing code:
   - `REQUIREMENT_GAP`
   - `DESIGN_CONTRACT_ERROR`
   - `TEST_CONTRACT_MISSING`
   - `IMPLEMENTATION_DEFECT`
   - `TEST_ORACLE_ERROR`
   - `ENVIRONMENT_FAILURE`
   - `FLAKY_TEST`
   - `SECURITY_POLICY`
3. Record a failed gate with the evidence reference and a unique idempotency key.
4. Work only in the routed responsibility stage.
5. Form a new diagnostic hypothesis, make the smallest responsible correction, and re-run the original reproduction plus regression coverage.

Never weaken a gate, edit a test merely to match broken behavior, or silently retry flaky and environment failures. The second occurrence of the same gate/failure-class signature becomes `blocked`; stop and escalate instead of looping.
