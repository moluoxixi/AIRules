## 1. Requirement and Story Confirmation

- [ ] 1.1 Confirm user stories, acceptance criteria, route entry/exit, and permission boundaries
- [ ] 1.2 Confirm specs and design agree on frontend-visible behavior

## 2. Field Contract Comparison

- [ ] 2.1 Map every UI field to API/OpenAPI/interface code/API client/store/route params/permission/state/persistence/static/derived contracts
- [ ] 2.2 Resolve every `MISSING blocked:` field before implementation tasks begin

## 3. Layout and Component Decisions

- [ ] 3.1 Preview layout, interaction flow, responsive behavior, and state placement
- [ ] 3.2 Search existing components/hooks/composables/utilities/UI libraries and classify every UI unit as `existing`, `wrap existing`, or `new`

## 4. TDD Implementation

- [ ] 4.1 Write failing unit/component/integration/E2E tests according to the Frontend Test Matrix
- [ ] 4.2 Implement the smallest code changes needed to pass the failing tests
- [ ] 4.3 Refactor while keeping tests green and component decisions intact

## 5. Verification and Review

- [ ] 5.1 Run required frontend test commands and collect console/network/screenshot/log evidence
- [ ] 5.2 Review field mappings, component reuse decisions, state coverage, and permission behavior
