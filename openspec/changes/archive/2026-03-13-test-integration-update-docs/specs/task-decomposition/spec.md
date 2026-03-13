## ADDED Requirements

### Requirement: task_decompose creates subtasks with dependencies
The system SHALL allow decomposition of complex tasks into atomic subtasks with explicit dependencies.

#### Scenario: Create subtasks with dependencies
- **WHEN** AI calls task_decompose with subtasks array containing dependsOn
- **THEN** system creates tasks with correct dependency references
- **AND** dependent tasks wait for dependencies to complete before execution

#### Scenario: Create subtasks with order
- **WHEN** AI calls task_decompose with orderIndex
- **THEN** tasks are executed in orderIndex order

#### Scenario: Ask user when cannot decompose
- **WHEN** AI sets askUser: true
- **THEN** system returns needsUserInput: true with userQuestion
- **AND** workflow pauses for user clarification

### Requirement: task_decompose returns task mapping
The system SHALL return mapping between temp IDs and real task IDs.

#### Scenario: Verify task IDs returned
- **WHEN** task_decompose creates subtasks
- **THEN** response includes array of {tempId, taskId} for each subtask
