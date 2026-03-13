## 1. Test Infrastructure Setup

- [x] 1.1 Create `src/__tests__/` directory structure
- [x] 1.2 Create test utilities file with in-memory database factory and helpers
- [x] 1.3 Create mock PluginApi for tool tests

## 2. TaskQueue Core Tests

- [x] 2.1 Create `src/__tests__/queue.test.ts`
- [x] 2.2 Test: create task with defaults (type, payload, PENDING status, unique ID)
- [x] 2.3 Test: create task with priority levels (HIGH/MEDIUM/LOW)
- [x] 2.4 Test: create task with scheduled time (future vs immediate)
- [x] 2.5 Test: complete task (RUNNING → COMPLETED, timestamp set)
- [x] 2.6 Test: fail task within retry limit (RUNNING → PENDING, retry_count++)
- [x] 2.7 Test: fail task exceeding retry limit (RUNNING → DEAD)
- [x] 2.8 Test: get task by ID (returns full task with parsed payload)
- [x] 2.9 Test: list tasks with status filter
- [x] 2.10 Test: get task counts by status

## 3. Atomic Task Claiming Tests

- [x] 3.1 Test: single worker claims task successfully
- [x] 3.2 Test: claim returns null when no PENDING tasks
- [x] 3.3 Test: concurrent claims - only one succeeds (CAS verification)
- [x] 3.4 Test: priority ordering - highest priority claimed first
- [x] 3.5 Test: FIFO ordering - oldest task claimed first for equal priority

## 4. Timeout Recovery Tests

- [x] 4.1 Test: reclaim timed-out RUNNING task (→ PENDING, retry_count++)
- [x] 4.2 Test: no reclaim for fresh RUNNING tasks within timeout
- [x] 4.3 Test: no reclaim when retry_count >= max_retries

## 5. TaskWorker Tests

- [x] 5.1 Create `src/__tests__/worker.test.ts`
- [x] 5.2 Test: worker processes tasks with processor function
- [x] 5.3 Test: worker respects concurrency limit
- [x] 5.4 Test: worker.stop() waits for active tasks to complete

## 6. OpenClaw Tools Tests

- [x] 6.1 Create `src/__tests__/tools.test.ts`
- [x] 6.2 Test: task_create returns success with taskId
- [x] 6.3 Test: task_status returns task information
- [x] 6.4 Test: task_status with invalid ID returns error
- [x] 6.5 Test: task_list with status filter
- [x] 6.6 Test: task_cancel on PENDING task succeeds
- [x] 6.7 Test: task_cancel on RUNNING task returns error
- [x] 6.8 Test: task_stats returns counts by status

## 7. Verification

- [x] 7.1 Run all tests with `npm test` - all pass
- [x] 7.2 Verify no TypeScript errors with `npm run build`
