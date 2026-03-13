## ADDED Requirements

### Requirement: All tools registered and functional
The system MUST have integration tests for all registered tools.

#### Scenario: task_create creates task
- **WHEN** calling task_create with type and payload
- **THEN** task is created and taskId returned

#### Scenario: task_status returns correct status
- **WHEN** checking status of existing task
- **THEN** returns correct status, retryCount, timestamps

#### Scenario: task_list filters by status and type
- **WHEN** listing tasks with filters
- **THEN** returns only matching tasks

#### Scenario: task_cancel sets FAILED status
- **WHEN** cancelling PENDING task
- **THEN** status changes to FAILED with "Cancelled" error

#### Scenario: task_stats returns accurate counts
- **WHEN** getting queue statistics
- **THEN** returns correct counts per status

#### Scenario: task_decompose creates subtasks with dependencies
- **WHEN** decomposing task with dependsOn
- **THEN** subtasks created with correct dependency references

#### Scenario: task_archive sets archived_at
- **WHEN** archiving completed task
- **THEN** archived_at timestamp is set

#### Scenario: task_cleanup removes old tasks
- **WHEN** cleaning up tasks older than N days
- **THEN** old COMPLETED/DEAD tasks are deleted

#### Scenario: task_find_stuck finds cancelled tasks
- **WHEN** finding stuck tasks
- **THEN** returns PENDING tasks with error messages

#### Scenario: task_repair fixes cancelled tasks
- **WHEN** repairing cancelled tasks
- **THEN** PENDING tasks with "Cancelled" changed to FAILED
