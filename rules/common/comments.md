# Common Comment Rules

Comment constraints applicable to all languages and technology stacks.

## Core Principles

- **Comment Language Localization**: Comment language should follow the primary language of the project/team's region. For example, Chinese teams use Chinese comments, Japanese teams use Japanese comments. This includes: function/class documentation comments, inline explanatory comments, TODO/FIXME descriptions, etc.
  - Identifiers in code (variable names, function names, class names, etc.) remain in English
  - Technical terms can retain their original English form (e.g., API, Promise, middleware, etc.)
- Comments should explain "why", "what are the constraints", and "where are the boundaries" by default, not restate the obvious "what the code does"
- Only add comments when the code itself is insufficient to express intent; avoid noise comments
- Comments should be maintained alongside code; once comments become outdated, prioritize fixing or removing them

## Scenarios Where Comments Are Required

- Exported public APIs have non-obvious constraints, preconditions, post-conditions, or side effects
- Business rules cannot be directly inferred from naming
- Performance trade-offs, compatibility handling, fallback branches, or security boundaries exist
- Temporary workarounds need to document reasons, trigger conditions, and cleanup signals

## Scenarios Where Comments Should Not Be Written

- Line-by-line translation of code
- Repeating information already clearly expressed by the type system, function names, or variable names
- Using comments to cover up poor naming or overly long functions; prioritize refactoring instead

## Documentation Comments vs Inline Comments

- Prioritize documentation comments for externally reusable interfaces
- Prioritize short comments close to the code for local complex logic
- Comments should be specific and verifiable; avoid empty phrases like "do some processing here"

## File Header Comments

- Each module/file header should describe its responsibilities and purpose
- Describe the core functional boundaries of the module
- Optional: describe relationships or dependencies with other modules

## Function Signature Comments

- Public functions must describe parameter meanings and expected types/ranges
- Must describe return value meanings and possible special values (e.g., null/empty values)
- Must describe possible exceptions/errors and their trigger conditions
- Describe preconditions (conditions that must be met before calling)
- Describe side effects (if any)

## Marker Comment Standards

Use the following formats consistently to mark special code:

- `TODO:` - Features to be implemented, must include description and optional owner/due date
- `FIXME:` - Known issues requiring fixes, must include problem description
- `HACK:` - Temporary solutions, must explain reasons and when they can be removed
- `NOTE:` - Important reminders to draw reader attention to specific details
- `WARNING:` - Potential risks or dangerous operation warnings

Format requirements:
- Markers in uppercase, followed by colon and space
- Content should be concise and clear
- Include sufficient context information
