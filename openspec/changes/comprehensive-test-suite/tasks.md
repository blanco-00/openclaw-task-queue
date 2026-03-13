## 1. Unit Tests

- [ ] 1.1 Add test for createTask with all options (dependsOn, orderIndex)
- [ ] 1.2 Add test for claimTask with dependency checking
- [ ] 1.3 Add test for failTask with retryable=false
- [ ] 1.4 Add test for failTask with retryable=true (retry logic)
- [ ] 1.5 Add test for reclaimTimeoutTasks

## 2. Integration Tests

- [ ] 2.1 Add test for task_cancel sets FAILED
- [ ] 2.2 Add test for task_decompose with dependencies
- [ ] 2.3 Add test for task_archive sets archived_at
- [ ] 2.4 Add test for task_cleanup removes old tasks
- [ ] 2.5 Add test for task_find_stuck
- [ ] 2.6 Add test for task_repair

## 3. Setup Tests

- [ ] 3.1 Verify npm install works
- [ ] 3.2 Verify npm run build succeeds
- [ ] 3.3 Verify npm test passes all tests
- [ ] 3.4 Add end-to-end flow test

## 4. Documentation

- [ ] 4.1 Document test commands in README
- [ ] 4.2 Document test coverage
