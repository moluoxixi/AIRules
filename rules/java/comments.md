# Java Comments

JavaDoc conventions for Java / Spring Boot projects.

## Class-Level Documentation

Every public class must have a class-level JavaDoc:

```java
/**
 * Service responsible for order processing and payment validation.
 * Handles order lifecycle from creation to completion.
 */
@Service
public class OrderService {
```

## Method Documentation

Public methods must document parameters, return values, and exceptions:

```java
/**
 * Processes a payment for the given order.
 *
 * @param orderId the unique identifier of the order
 * @param paymentRequest contains payment method and amount details
 * @return PaymentResult with transaction ID and status
 * @throws OrderNotFoundException if order does not exist
 * @throws PaymentFailedException if payment processor returns error
 * @throws IllegalArgumentException if payment amount is negative
 */
public PaymentResult processPayment(String orderId, PaymentRequest paymentRequest) {
```

## Required Tags

- `@param` - All parameters, describe constraints and valid values
- `@return` - All non-void returns, describe possible values
- `@throws` - All checked exceptions and significant unchecked exceptions

## Optional Tags

- `@see` - Related classes or methods
- `@since` - API version when introduced
- `@deprecated` - With explanation and replacement

## Code Examples

Include runnable examples for complex APIs:

```java
/**
 * Creates a cached thread pool with custom rejection policy.
 *
 * <p>Example usage:
 * <pre>{@code
 * ExecutorService executor = ThreadPoolBuilder.create()
 *     .coreSize(4)
 *     .maxSize(16)
 *     .build();
 * }</pre>
 */
```
