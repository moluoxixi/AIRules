# Java Verification

Quality gates for Java / Spring Boot projects.

## Static Analysis Tools

| Tool | Purpose | Command |
|------|---------|---------|
| Checkstyle | Code style enforcement | `mvn checkstyle:check` |
| SpotBugs | Bug pattern detection | `mvn spotbugs:check` |
| PMD | Code quality analysis | `mvn pmd:check` |

## Formatting

Use **google-java-format** for consistent formatting:

```xml
<plugin>
    <groupId>com.spotify.fmt</groupId>
    <artifactId>fmt-maven-plugin</artifactId>
    <version>2.21.1</version>
</plugin>
```

Command: `mvn fmt:check` or `mvn fmt:format`

## Build Verification

```bash
# Full verification pipeline
mvn clean verify

# Individual checks
mvn compile          # Compilation
mvn test             # Unit tests
mvn integration-test # Integration tests
mvn checkstyle:check # Style check
mvn spotbugs:check   # Bug detection
```

## Pre-Commit Checklist

- [ ] `mvn compile` succeeds
- [ ] `mvn test` passes
- [ ] `mvn checkstyle:check` passes
- [ ] `mvn spotbugs:check` passes (zero errors)
- [ ] No compiler warnings

## Gradle Equivalent

```bash
./gradlew build          # Full build with tests
./gradlew check          # All verification tasks
./gradlew spotbugsMain   # Bug detection
```
