# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`

**Created**: [DATE]

**Status**: Draft

**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

User stories are prioritized as independently testable user journeys. Each story must be deliverable as a slice of value.

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### Edge Cases

- What happens when [boundary condition]?
- How does the UI handle [error scenario]?
- What permission or feature-flag state changes the visible UI?

## Frontend Contract Discovery *(mandatory for frontend changes)*

### Fields

| Area | Field | UI Purpose | Source Type | Source Path / Endpoint | Exists? | Missing Status |
|------|-------|------------|-------------|------------------------|---------|----------------|
| [page/region] | [field] | [why shown] | [API/OpenAPI/interface code/API client/store/route params/permission/state/persistence/static/derived] | [path] | [yes/no/unclear] | [OK or MISSING blocked: reason] |

If any UI-required field is absent, ambiguous, or permission-unverifiable, write `MISSING blocked: <reason>` and stop before planning implementation.

### Components

| UI Unit | Decision | Existing / Wrapped Path | Reason | States Covered |
|---------|----------|-------------------------|--------|----------------|
| [component] | [existing/wrap existing/new] | [path or N/A] | [why] | [loading/empty/error/disabled/success/permission-denied/pending/N/A] |

### Frontend Test Expectations

- Unit/component coverage: [required or N/A with reason]
- Integration/browser/E2E coverage: [required or N/A with reason]
- Responsive/visual evidence: [desktop/mobile viewport evidence or N/A with reason]

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST [specific capability]
- **FR-002**: System MUST [specific capability]
- **FR-003**: Users MUST be able to [key interaction]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: [Measurable outcome]
- **SC-002**: [Frontend-specific measurable outcome, e.g. "P1 journey completes without console errors at desktop and mobile viewports"]

## Assumptions

- [Assumption about target users]
- [Assumption about source contract availability]
