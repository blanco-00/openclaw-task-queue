## ADDED Requirements

### Requirement: task_archive marks task as archived
The system SHALL allow archiving completed tasks for retention.

#### Scenario: Archive a task
- **WHEN** AI calls task_archive with taskId
- **THEN** task's archived_at is set to current timestamp

#### Scenario: Archived tasks excluded from normal queries
- **WHEN** archived task exists in database
- **THEN** archived_at field contains timestamp
- **AND** listTasks still returns archived tasks (not filtered by default)
