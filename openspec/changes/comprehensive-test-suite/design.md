## Context

Current test coverage includes basic queue tests but lacks comprehensive coverage for all features. Need to ensure every feature is tested.

## Goals / Non-Goals

**Goals:**
- Unit tests for all TaskQueue methods
- Integration tests for all registered tools
- Complete flow test from npm install to task completion

**Non-Goals:**
- Performance testing
- Load testing

## Decisions

### Test Strategy
- Use existing vitest framework
- In-memory SQLite for speed
- Mock PluginApi for tool tests

### Test Categories
1. Unit: queue.test.ts - core queue operations
2. Integration: tools.test.ts, decompose.test.ts - tool registration and execution
3. Flow: setup script - full end-to-end

## Risks / Trade-offs

- [Risk] Too many tests slow CI → Mitigation: Keep tests fast, under 10s total
- [Risk] Mock differences from real behavior → Mitigation: Use real DB in integration tests
