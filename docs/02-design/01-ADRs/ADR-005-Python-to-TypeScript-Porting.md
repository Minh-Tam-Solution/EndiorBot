# ADR-005: Python-to-TypeScript Porting Strategy

**Status:** ACCEPTED
**Date:** 2026-02-22
**Author:** Architect
**SDLC Stage:** 02-DESIGN

---

## Context

EndiorBot needs to port several Python modules from SDLC-Orchestrator to TypeScript:
- Security layer (input sanitizer, output scrubber, shell guard)
- Quality layer (reflect step, history compactor, query classifier)
- Resilience layer (failover classifier, conversation tracker)

These modules contain regex patterns, state machines, and complex logic that must be ported carefully.

---

## Decision

Use **manual port with behavioral test suite** strategy:
1. Create comprehensive test cases from Python behavior
2. Port logic manually to TypeScript
3. Verify identical behavior via test suite
4. Use XRegExp for advanced regex patterns

---

## Files to Port

| Python File | TypeScript Target | LOC | Complexity |
|-------------|-------------------|-----|------------|
| input_sanitizer.py | src/security/input-sanitizer.ts | ~120 | Medium |
| output_scrubber.py | src/security/output-scrubber.ts | ~200 | Medium |
| shell_guard.py | src/security/shell-guard.ts | ~180 | Medium |
| reflect_step.py | src/agents/quality/reflect-step.ts | ~100 | Low |
| history_compactor.py | src/agents/quality/history-compactor.ts | ~350 | High |
| query_classifier.py | src/agents/quality/query-classifier.ts | ~140 | Medium |
| failover_classifier.py | src/agents/resilience/failover-classifier.ts | ~210 | Medium |
| conversation_tracker.py | src/agents/resilience/conversation-tracker.ts | ~480 | High |

**Total:** ~1,780 LOC Python → TypeScript

---

## Porting Guidelines

### Regex Compatibility

| Python | JavaScript/TypeScript |
|--------|----------------------|
| `re.compile(pattern)` | `new RegExp(pattern)` or XRegExp |
| `re.IGNORECASE` | `/pattern/i` flag |
| `re.MULTILINE` | `/pattern/m` flag |
| `re.DOTALL` | `/pattern/s` flag |
| Named groups `(?P<name>)` | `(?<name>)` |
| Lookbehind `(?<=)` | Supported in ES2018+ |

### Type Mappings

| Python Type | TypeScript Type |
|-------------|-----------------|
| `str` | `string` |
| `int`, `float` | `number` |
| `bool` | `boolean` |
| `list[T]` | `T[]` |
| `dict[K, V]` | `Record<K, V>` or `Map<K, V>` |
| `Optional[T]` | `T \| undefined` |
| `Union[A, B]` | `A \| B` |
| `None` | `null` or `undefined` |
| `Callable` | Function signature |

### Pattern Migration: Input Sanitizer

```python
# Python (input_sanitizer.py)
INJECTION_PATTERNS = [
    r"(?i)(?:--|;)\s*(?:drop|delete|truncate|alter)\s+(?:table|database)",
    r"(?i)union\s+(?:all\s+)?select",
    # ... 10 more patterns
]
```

```typescript
// TypeScript (input-sanitizer.ts)
const INJECTION_PATTERNS: RegExp[] = [
  /(?:--|;)\s*(?:drop|delete|truncate|alter)\s+(?:table|database)/i,
  /union\s+(?:all\s+)?select/i,
  // ... 10 more patterns
];
```

---

## Test Strategy

### Behavioral Test Suite

Each module requires 50+ test cases covering:
1. **Positive cases** - Valid inputs that should pass
2. **Negative cases** - Malicious inputs that should be blocked
3. **Edge cases** - Empty strings, unicode, special characters
4. **Performance** - Large inputs, many iterations

### Test File Structure

```
tests/
├── security/
│   ├── input-sanitizer.test.ts     # 50+ test cases
│   ├── output-scrubber.test.ts     # 50+ test cases
│   └── shell-guard.test.ts         # 50+ test cases
├── agents/
│   ├── quality/
│   │   ├── reflect-step.test.ts
│   │   ├── history-compactor.test.ts
│   │   └── query-classifier.test.ts
│   └── resilience/
│       ├── failover-classifier.test.ts
│       └── conversation-tracker.test.ts
```

### Sample Test Cases (Input Sanitizer)

```typescript
describe('InputSanitizer', () => {
  describe('SQL Injection', () => {
    it('should block DROP TABLE', () => {
      expect(sanitize("'; DROP TABLE users;--")).not.toContain('DROP');
    });

    it('should block UNION SELECT', () => {
      expect(sanitize("' UNION SELECT * FROM passwords")).not.toContain('UNION');
    });
  });

  describe('XSS', () => {
    it('should block script tags', () => {
      expect(sanitize('<script>alert(1)</script>')).not.toContain('<script>');
    });
  });

  describe('Command Injection', () => {
    it('should block backtick execution', () => {
      expect(sanitize('`rm -rf /`')).not.toContain('`');
    });
  });
});
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Auto-transpile (js2py) | Fast | Poor TypeScript types | ❌ Reject |
| Keep Python (subprocess) | No porting | Process overhead, deployment complexity | ❌ Reject |
| Rewrite from scratch | Clean design | May miss edge cases | ❌ Reject |
| Manual port + tests | Verified behavior, good types | More effort | ✅ Selected |

---

## Consequences

### Positive
- TypeScript-native, no subprocess calls
- Full type safety
- Easy integration with existing codebase
- Verified behavior via test suite

### Negative
- Manual effort (~2 weeks)
- Risk of behavioral drift if Python updated
- Test maintenance burden

### Risks
- Regex differences between Python and JS (mitigate: XRegExp, extensive testing)
- Unicode handling differences (mitigate: explicit UTF-8 handling)

---

## Implementation Plan

| Sprint | Modules | Effort |
|--------|---------|--------|
| 31 | input-sanitizer, output-scrubber, shell-guard | 3 days |
| 31 | reflect-step, history-compactor, query-classifier | 3 days |
| 32 | failover-classifier, conversation-tracker | 4 days |

---

## References

- [SDLC-Orchestrator Source](/path/to/SDLC-Orchestrator/)
- [XRegExp Library](https://xregexp.com/)

---

*SDLC Framework v6.4.0 - Stage 02: Design*
