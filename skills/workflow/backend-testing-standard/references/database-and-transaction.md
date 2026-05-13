# Database And Transaction Testing

## Persistence Behavior

Test repository or integration behavior when changes affect:
- queries;
- filters;
- sorting;
- pagination;
- unique constraints;
- soft delete;
- tenant isolation;
- optimistic locking;
- migrations or schema assumptions.

## Transactions

For multi-write operations, verify:
- all writes commit on success;
- all writes roll back on failure;
- expected domain errors do not leave partial state;
- external calls are not incorrectly treated as transactional unless the architecture supports compensation.

## Test Data

Use realistic minimal fixtures. Avoid tests that pass only because all fields are empty or defaulted.

Clean up database state between tests using the project's established isolation approach.
