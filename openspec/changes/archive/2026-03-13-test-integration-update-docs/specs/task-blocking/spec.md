## ADDED Requirements

### Requirement: blocking field controls execution mode
The system SHALL support background (async) and interactive (user-paused) execution modes.

#### Scenario: Background tasks execute automatically
- **WHEN** subtask has blocking: "background"
- **THEN** task is created with _blocking: "background" in payload
- **AND** Worker can claim and execute without user intervention

#### Scenario: Interactive tasks pause workflow
- **WHEN** subtask has blocking: "interactive"
- **THEN** task_decompose returns paused: true
- **AND** response includes nextAction: "Wait for user confirmation"

#### Scenario: Detect interactive subtasks
- **WHEN** any subtask has blocking: "interactive"
- **THEN** response includes hasInteractive: true
