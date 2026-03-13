## ADDED Requirements

### Requirement: TaskQueue unit tests
The system MUST have comprehensive unit tests for all TaskQueue methods.

#### Scenario: createTask creates task with all options
- **WHEN** creating task with type, payload, priority, dependsOn, orderIndex
- **THEN** task is created with all fields stored correctly

#### Scenario: claimTask respects dependencies
- **WHEN** claiming task with dependsOn
- **THEN** task is only claimed when all dependencies are COMPLETED

#### Scenario: completeTask sets status to COMPLETED
- **WHEN** completing a RUNNING task
- **THEN** status changes to COMPLETED with result stored

#### Scenario: failTask with retryable=false sets FAILED
- **WHEN** failing task with retryable=false
- **THEN** status changes to FAILED, not retried

#### Scenario: failTask with retryable=true retries
- **WHEN** failing task with retryable=true and retries remaining
- **THEN** status changes to PENDING with retry_count incremented

#### Scenario: reclaimTimeoutTasks recovers stuck tasks
- **WHEN** running tasks exceed timeout
- **THEN** tasks are returned to PENDING with retry_count incremented
