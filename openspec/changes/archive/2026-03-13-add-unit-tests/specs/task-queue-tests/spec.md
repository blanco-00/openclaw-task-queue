## ADDED Requirements

### Requirement: TaskQueue core operations tested
The test suite SHALL verify all core TaskQueue operations work correctly in isolation.

#### Scenario: Create task with defaults
- **WHEN** createTask is called with type and payload
- **THEN** a unique task ID is returned
- **AND** task is stored with status PENDING

#### Scenario: Create task with priority
- **WHEN** createTask is called with priority HIGH
- **THEN** task is stored with priority 10

#### Scenario: Create task with scheduled time
- **WHEN** createTask is called with scheduledAt in the future
- **THEN** task is stored but not claimable until scheduled time

#### Scenario: Complete task
- **WHEN** completeTask is called on a RUNNING task
- **THEN** task status becomes COMPLETED
- **AND** completed_at timestamp is set

#### Scenario: Fail task within retry limit
- **WHEN** failTask is called on a RUNNING task with retry_count < max_retries
- **THEN** task status becomes PENDING
- **AND** retry_count is incremented

#### Scenario: Fail task exceeding retry limit
- **WHEN** failTask is called on a RUNNING task with retry_count >= max_retries
- **THEN** task status becomes DEAD

#### Scenario: Get task by ID
- **WHEN** getTask is called with valid ID
- **THEN** full task object is returned with parsed payload

#### Scenario: List tasks with filters
- **WHEN** listTasks is called with status filter
- **THEN** only tasks matching status are returned

#### Scenario: Get task counts
- **WHEN** getTaskCounts is called
- **THEN** counts by status are returned

### Requirement: Atomic task claiming verified
The test suite SHALL verify CAS-based task claiming prevents race conditions.

#### Scenario: Single worker claims task
- **WHEN** claimTask is called with a PENDING task available
- **THEN** task status becomes RUNNING
- **AND** claimed_by is set to worker ID
- **AND** claimed_at timestamp is set

#### Scenario: No task available returns null
- **WHEN** claimTask is called with no PENDING tasks
- **THEN** null is returned

#### Scenario: Concurrent claim attempts
- **WHEN** multiple workers call claimTask simultaneously on same task pool
- **THEN** exactly one worker receives the task
- **AND** other workers receive null

#### Scenario: Priority ordering
- **WHEN** multiple PENDING tasks exist with different priorities
- **THEN** highest priority task is claimed first

#### Scenario: FIFO for equal priority
- **WHEN** multiple PENDING tasks have same priority
- **THEN** oldest task (by created_at) is claimed first

### Requirement: Timeout recovery tested
The test suite SHALL verify timed-out tasks are properly reclaimed.

#### Scenario: Reclaim timed-out task
- **WHEN** reclaimTimeoutTasks is called with a RUNNING task past timeout
- **THEN** task status becomes PENDING
- **AND** retry_count is incremented
- **AND** claimed_at and claimed_by are cleared

#### Scenario: No reclaim for fresh tasks
- **WHEN** reclaimTimeoutTasks is called with RUNNING task within timeout
- **THEN** task remains RUNNING

#### Scenario: No reclaim beyond max retries
- **WHEN** reclaimTimeoutTasks is called with RUNNING task past timeout AND retry_count >= max_retries
- **THEN** task is NOT reclaimed (remains RUNNING - will become DEAD on next fail)

### Requirement: TaskWorker lifecycle tested
The test suite SHALL verify TaskWorker start, stop, and processing behavior.

#### Scenario: Worker processes tasks
- **WHEN** worker is started with a processor function
- **AND** tasks exist in queue
- **THEN** tasks are claimed and processed
- **AND** processor function is called with task

#### Scenario: Worker respects concurrency
- **WHEN** worker is configured with concurrency: 2
- **AND** 5 PENDING tasks exist
- **THEN** at most 2 tasks are processed simultaneously

#### Scenario: Worker stop waits for active tasks
- **WHEN** worker.stop() is called during task processing
- **THEN** worker waits for active tasks to complete
- **AND** no new tasks are claimed

### Requirement: OpenClaw tools tested
The test suite SHALL verify all OpenClaw tool handlers work correctly.

#### Scenario: task_create tool
- **WHEN** task_create is called with type and payload
- **THEN** success response with taskId is returned

#### Scenario: task_status tool
- **WHEN** task_status is called with valid taskId
- **THEN** task status information is returned

#### Scenario: task_status tool with invalid ID
- **WHEN** task_status is called with non-existent taskId
- **THEN** error response is returned

#### Scenario: task_list tool
- **WHEN** task_list is called with status filter
- **THEN** filtered task list is returned

#### Scenario: task_cancel tool on pending task
- **WHEN** task_cancel is called on PENDING task
- **THEN** task is cancelled (status becomes FAILED with cancellation reason)

#### Scenario: task_cancel tool on running task
- **WHEN** task_cancel is called on RUNNING task
- **THEN** error response is returned (cannot cancel running task)

#### Scenario: task_stats tool
- **WHEN** task_stats is called
- **THEN** counts by status are returned
