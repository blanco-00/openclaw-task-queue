## Context

The OpenClaw Task Queue uses SQLite with Compare-And-Swap (CAS) for atomic task claiming. This is a concurrency-critical component where bugs can cause:
- Duplicate task processing
- Lost tasks
- Incorrect state transitions

Current state: No tests exist. The code is implemented but unverified.

Testing framework: Vitest is already configured in devDependencies.

## Goals / Non-Goals

**Goals:**
- Verify atomic task claiming prevents race conditions
- Validate task lifecycle state machine (PENDING → RUNNING → COMPLETED/FAILED/DEAD)
- Test timeout recovery mechanism
- Test retry logic with exponential backoff
- Test OpenClaw tool handlers
- Enable future safe refactoring with test coverage

**Non-Goals:**
- 100% code coverage (focus on critical paths)
- Performance benchmarks
- End-to-end integration tests with real OpenClaw
- Testing platform-specific SQLite behavior

## Decisions

### D1: Use in-memory SQLite for tests
**Rationale**: In-memory databases (`:memory:`) are:
- Fast (no disk I/O)
- Isolated (each test gets fresh DB)
- No cleanup needed

**Alternative considered**: File-based with temp directories - rejected due to cleanup complexity and slower tests.

### D2: Vitest with describe/it blocks
**Rationale**: Already in devDependencies, fast, TypeScript-native.

### D3: Concurrency tests using Promise.all
**Rationale**: Simulate race conditions by having multiple "workers" try to claim tasks simultaneously using `Promise.all`. This directly tests the CAS mechanism.

```typescript
// Pattern for concurrency test
const results = await Promise.all([
  queue.claimTask('worker-1'),
  queue.claimTask('worker-2'),
  queue.claimTask('worker-3'),
]);
// Only one should succeed
const claimed = results.filter(r => r !== null);
expect(claimed).toHaveLength(1);
```

### D4: Mock PluginApi for tool tests
**Rationale**: Tools require PluginApi with `registerTool`. Create minimal mock for testing handlers.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| In-memory SQLite behaves differently than file-based | WAL mode tests use temp file; most tests don't depend on persistence |
| Concurrency tests may be flaky | Use deterministic patterns (Promise.all), avoid setTimeout |
| Tool tests don't cover real OpenClaw integration | Focus on handler logic; integration is out of scope |
