# Java Testing

Testing standards for Java / Spring Boot projects using JUnit 5 and Mockito.

## Test Framework Stack

- **JUnit 5**: Unit and integration testing
- **Mockito**: Mocking external dependencies
- **AssertJ**: Fluent assertions
- **SpringBootTest**: Integration testing with context

## Naming Convention

Tests follow `should_expectedBehavior_when_condition` pattern:

```java
@Test
void should_throwValidationException_when_emailIsInvalid() {
    // Test implementation
}

@Test
void should_returnOrder_when_orderExists() {
    // Test implementation
}
```

## Unit Test Structure

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private OrderService orderService;

    @Test
    void should_calculateTotal_when_itemsProvided() {
        // Arrange
        List<Item> items = List.of(new Item("A", 10.0), new Item("B", 20.0));

        // Act
        double total = orderService.calculateTotal(items);

        // Assert
        assertThat(total).isEqualTo(30.0);
    }
}
```

## Integration Tests

```java
@SpringBootTest
@AutoConfigureMockMvc
class OrderControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void should_createOrder_when_requestIsValid() throws Exception {
        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\": \"book\", \"quantity\": 2}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists());
    }
}
```

## Mocking Guidelines

- Mock external dependencies (databases, HTTP clients, message queues)
- Do not mock internal service methods
- Use `@MockBean` for Spring context integration
