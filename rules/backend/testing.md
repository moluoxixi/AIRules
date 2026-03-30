# Backend Testing

Cross-framework testing principles for backend projects.

## Test Pyramid

1. **Unit tests** - Business logic, utilities (fast, no I/O)
2. **Integration tests** - Database, external APIs
3. **Contract tests** - API request/response schemas
4. **E2E tests** - Critical user flows through full stack

## API Testing

Test endpoints as black boxes:

```typescript
describe('POST /api/orders', () => {
  it('should create order with valid data', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: '1', quantity: 2 }],
        shippingAddress: validAddress,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.status).toBe('pending');
  });

  it('should return 401 without authentication', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({ items: [] });

    expect(response.status).toBe(401);
  });
});
```

## Database Testing

Use test database or transactions:

```typescript
describe('UserRepository', () => {
  beforeEach(async () => {
    // Clean state for each test
    await db.truncate('users');
  });

  it('should persist user with hashed password', async () => {
    const user = await repository.create({
      email: 'test@example.com',
      password: 'plaintext',
    });

    expect(user.password).not.toBe('plaintext');
    expect(user.password).toMatch(/^\$2[aby]\$/); // bcrypt prefix
  });
});
```

## Integration Test Isolation

```typescript
// Use separate test database
const testDb = createDatabase({
  database: 'myapp_test',
  runMigrations: true,
});

// Or wrap in transactions that rollback
beforeEach(async () => {
  await db.beginTransaction();
});

afterEach(async () => {
  await db.rollbackTransaction();
});
```

## Mocking External Services

```typescript
// Mock HTTP clients, not your own code
jest.mock('../clients/paymentClient', () => ({
  charge: jest.fn().mockResolvedValue({ id: 'ch_123', status: 'succeeded' }),
}));

// Verify interactions when behavior depends on them
expect(paymentClient.charge).toHaveBeenCalledWith({
  amount: 1000,
  currency: 'usd',
});
```

## Test Data Factories

```typescript
const createUser = (overrides?: Partial<User>): User => ({
  id: randomUUID(),
  email: `user-${randomUUID()}@test.com`,
  createdAt: new Date(),
  ...overrides,
});
```
