## ADDED Requirements

### Requirement: task_cleanup removes old archived tasks
The system SHALL support automatic cleanup of old archived tasks.

#### Scenario: Cleanup old tasks
- **WHEN** AI calls task_cleanup with olderThanDays
- **THEN** system deletes archived tasks older than specified days

#### Scenario: Default cleanup period
- **WHEN** AI calls task_cleanup without olderThanDays
- **THEN** system uses default of 7 days

#### Scenario: Cleanup only affects completed/dead tasks
- **WHEN** task_cleanup runs
- **THEN** only tasks with status COMPLETED or DEAD are deleted
