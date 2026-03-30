# NestJS Testing

Testing standards for NestJS projects using Jest.

## Test Framework Stack

- **Jest**: Test runner and assertions
- **@nestjs/testing**: TestingModule for dependency injection
- **supertest**: HTTP endpoint testing

## Unit Tests

Test services and providers in isolation:

```typescript
describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UserService);
    repository = module.get(UserRepository);
  });

  it('should return user when found', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    repository.findById.mockResolvedValue(mockUser);

    const result = await service.findById('1');

    expect(result).toEqual(mockUser);
  });
});
```

## Controller Tests

```typescript
describe('UserController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [UserService],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('GET /users/:id should return user', () => {
    return request(app.getHttpServer())
      .get('/users/1')
      .expect(200)
      .expect({ id: '1', email: 'test@example.com' });
  });
});
```

## E2E Tests

```typescript
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('POST /auth/login should authenticate user', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(201)
      .expect(res => {
        expect(res.body.accessToken).toBeDefined();
      });
  });
});
```
