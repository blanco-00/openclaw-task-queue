## Why

The task queue plugin has new features (task decomposition, blocking modes, archive, cleanup) that need comprehensive integration testing and documentation update to ensure they work correctly in a real-world scenario.

## What Changes

- Add integration tests covering all new tools (task_decompose, task_archive, task_cleanup)
- Test dependency resolution in Worker
- Test blocking modes (background vs interactive)
- Update README with new tool usage examples
- Document the new database schema fields

## Capabilities

### New Capabilities
- `task-decomposition`: AI-powered task decomposition with dependency tracking
- `task-blocking`: Support for interactive vs background task modes
- `task-archive`: Archive completed tasks for retention
- `task-cleanup`: Automatic cleanup of old archived tasks

### Modified Capabilities
- None - all new capabilities

## Impact

- Test files: `src/__tests__/`
- Documentation: `README.md`
- Code: `src/tools.ts`, `src/queue.ts`, `src/types.ts`
