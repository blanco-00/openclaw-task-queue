## Why

The OpenClaw Task Queue is a concurrency-sensitive component that relies on SQLite's Compare-And-Swap (CAS) pattern for atomic task claiming. Without comprehensive tests, we cannot verify:
1. Race conditions are truly prevented
2. Task lifecycle transitions are correct
3. Timeout recovery works as expected
4. Retry logic handles failures properly

Before publishing to npm and promoting to the OpenClaw community, we need a solid test suite to ensure reliability and enable safe future development.

## What Changes

- Add Vitest test framework configuration
- Add unit tests for `TaskQueue` class (create, claim, complete, fail, timeout, retry)
- Add unit tests for `TaskWorker` class (start, stop, concurrency, processing)
- Add unit tests for OpenClaw tools (task_create, task_status, task_list, task_cancel, task_stats)
- Add concurrency stress tests to verify atomic operations under load
- Add test utilities for SQLite in-memory database setup

## Capabilities

### New Capabilities

- `task-queue-tests`: Comprehensive test suite covering TaskQueue, TaskWorker, and Tools with focus on concurrency safety

### Modified Capabilities

None - this change adds tests without modifying existing behavior.

## Impact

- **New Files**: `src/__tests__/` directory with test files
- **Dependencies**: vitest (already in devDependencies)
- **CI/CD**: Tests can be run via `npm test`
- **Coverage**: No production code changes, only additions
