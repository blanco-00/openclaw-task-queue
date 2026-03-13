## Context

The openclaw-task-queue plugin has implemented task decomposition features:
- `task_decompose` - Split complex tasks into subtasks with dependencies
- `blocking` modes - interactive (needs user) vs background (async)
- `task_archive` - Archive completed tasks
- `task_cleanup` - Remove old archived tasks

These need integration testing and documentation.

## Goals / Non-Goals

**Goals:**
- Write integration tests covering full workflow from plugin installation
- Test task decomposition with dependencies
- Test blocking modes behavior
- Test archive and cleanup functions
- Update README with new tool examples

**Non-Goals:**
- Unit tests (already exist)
- Performance testing
- Load testing

## Decisions

### Testing Strategy
- Use existing test infrastructure (vitest)
- Create new integration test file: `src/__tests__/decompose.test.ts`
- Test real queue operations with in-memory database

### Documentation Update
- Add new tools section to README
- Include usage examples for each new tool
- Document database schema changes

## Risks / Trade-offs

- [Risk] Integration tests may be slow → Mitigation: Use in-memory DB for speed
- [Risk] Documentation may become outdated → Mitigation: Keep examples minimal and clear
