# Frontend Test Dimensions

## Static Quality

Check lint, formatting, import rules, unused code, dependency boundaries, and project-specific static rules.

## Type Correctness

Run the project's type mechanism, such as TypeScript, vue-tsc, framework typecheck, or workspace type tasks.

## Unit Logic

Cover:
- pure utilities;
- data transforms;
- validators;
- permission rules;
- hooks/composables without DOM dependencies;
- stores and reducers;
- error conversion and failure propagation.

## Component Behavior

Cover:
- props and emitted events or callbacks;
- slots or children;
- loading, empty, error, and success states;
- form validation and submission;
- disabled and permission-limited states;
- async updates and race-sensitive behavior.

Test visible behavior rather than implementation details.

## Page Integration

Cover:
- route loading and parameter handling;
- API trigger timing;
- success, failure, and empty API responses;
- state persistence or reset between navigation;
- modal, drawer, table, tab, menu, and pagination flows.

## Delivery Behavior

Check that the production build or equivalent packaging path works, and that the built app can render in its expected host when the project supports previewing.
