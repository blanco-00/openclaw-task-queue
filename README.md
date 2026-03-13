# OpenClaw Task Queue

SQLite-based task queue with atomic operations for AI agents.

## Features

- **SQLite + WAL mode** - Single-file database with better concurrency
- **Atomic task claiming** - Compare-And-Swap (CAS) prevents duplicate processing
- **Automatic timeout recovery** - Stalled tasks are automatically reclaimed
- **Retry with backoff** - Configurable retry attempts for failed tasks
- **Priority queues** - Tasks processed by priority then creation time
- **Scheduled tasks** - Delay task execution until a specific time
- **Task tracking** - Full visibility into task status and history

## Installation

### As OpenClaw Plugin

```bash
openclaw plugins install @openclaw-task-queue/core
```

### As Standalone Library

```bash
npm install @openclaw-task-queue/core better-sqlite3
```

## Quick Start

### OpenClaw Plugin Usage

After installation, the following tools are automatically available to your agent:

```
User: 帮我分析这个大型数据集，但不用马上完成，后台处理就行

Agent: 我来创建一个后台任务来处理这个分析。
[Uses task_create tool]

✅ 已创建任务 task-1710123456-abc123
任务将在后台执行，预计需要 5-10 分钟。

你可以随时用 task_status 查询进度。
```

### Standalone Usage

```typescript
import { TaskQueue, TaskWorker } from "@openclaw-task-queue/core";

// Create queue
const queue = new TaskQueue({
  dbPath: "./tasks.db",
  maxRetries: 3,
  timeoutSeconds: 300,
});

// Create task
const taskId = await queue.createTask({
  type: "data-analysis",
  payload: { dataset: "sales_2024.csv" },
  priority: "high",
});

console.log(`Created task: ${taskId}`);

// Start worker with processor
const worker = new TaskWorker(queue, {
  concurrency: 2,
  processor: async (task) => {
    console.log(`Processing ${task.id}...`);
    
    // Your processing logic here
    const result = await processData(task.payload);
    
    return result;
  }
});

await worker.start();
```

## Tools

### task_create

Create a new background task.

```json
{
  "type": "report-generation",
  "payload": {
    "template": "monthly",
    "month": "2024-03"
  },
  "priority": "high",
  "scheduledAt": "2024-04-01T09:00:00Z"
}
```

Parameters:
- `type` (required): Task type identifier
- `payload` (required): Task data
- `priority`: "high" | "medium" | "low" (default: "medium")
- `scheduledAt`: ISO datetime for delayed execution
- `maxRetries`: Override default retry count
- `timeoutSeconds`: Override default timeout

### task_status

Check task status and progress.

```json
{
  "taskId": "task-1710123456-abc123"
}
```

Returns:
```json
{
  "success": true,
  "id": "task-1710123456-abc123",
  "status": "RUNNING",
  "retryCount": 0,
  "createdAt": "2024-03-11T10:30:00Z",
  "startedAt": "2024-03-11T10:30:05Z",
  "completedAt": null,
  "error": null
}
```

### task_list

List tasks with filters.

```json
{
  "status": "PENDING",
  "type": "data-analysis",
  "limit": 50
}
```

### task_cancel

Cancel a pending task.

```json
{
  "taskId": "task-1710123456-abc123"
}
```

### task_stats

Get queue statistics.

Returns:
```json
{
  "success": true,
  "counts": {
    "PENDING": 15,
    "RUNNING": 2,
    "COMPLETED": 234,
    "FAILED": 3,
    "DEAD": 1
  }
}
```

## Task Lifecycle

```
┌─────────┐    claim()    ┌─────────┐    complete()    ┌──────────┐
│ PENDING │──────────────▶│ RUNNING │────────────────▶│ COMPLETED│
└─────────┘               └────┬────┘                 └──────────┘
                               │
                          fail() │ timeout()
                               │
                               ▼
                          ┌─────────┐    retry()    ┌─────────┐
                          │ FAILED  │──────────────▶│ PENDING │
                          └─────────┘               └─────────┘
                               │
                    max_retry  │
                               ▼
                          ┌─────────┐
                          │  DEAD   │
                          └─────────┘
```

## Configuration

### OpenClaw Plugin

Add to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "task-queue": {
        "enabled": true,
        "config": {
          "dbPath": "~/.openclaw/task-queue.db",
          "concurrency": 1,
          "pollIntervalMs": 5000,
          "maxRetries": 3,
          "timeoutSeconds": 300,
          "enableWorker": true
        }
      }
    }
  }
}
```

### Standalone

```typescript
const queue = new TaskQueue({
  dbPath: "./tasks.db",        // SQLite database path
  maxRetries: 3,               // Max retry attempts
  timeoutSeconds: 300,         // Task timeout (5 min)
});

const worker = new TaskWorker(queue, {
  concurrency: 2,              // Parallel tasks
  pollIntervalMs: 5000,        // Poll every 5s
  processor: async (task) => { // Task processor
    // Process task
    return result;
  }
});
```

## Architecture

### Why SQLite?

- **No external dependencies** - No Redis, PostgreSQL, etc.
- **Single file** - Easy backup, migration, and debugging
- **WAL mode** - Better concurrent read/write performance
- **Atomic operations** - Compare-And-Swap prevents race conditions

### Atomic Task Claiming

The key to preventing duplicate task processing is the Compare-And-Swap (CAS) pattern:

```sql
UPDATE tasks
SET status = 'RUNNING',
    claimed_at = CURRENT_TIMESTAMP,
    claimed_by = :worker_id
WHERE id = (
    SELECT id FROM tasks
    WHERE status = 'PENDING'
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
)
AND status = 'PENDING'  -- CAS check!
RETURNING *;
```

This single statement atomically:
1. Finds the highest priority pending task
2. Claims it only if still pending (prevents race)
3. Returns the claimed task

## Comparison

| Feature | This Project | File-based | Redis (BullMQ) |
|---------|-------------|------------|----------------|
| Concurrency safe | ✅ | ❌ | ✅ |
| No external deps | ✅ | ✅ | ❌ |
| Easy backup | ✅ | ✅ | ❌ |
| Atomic ops | ✅ | ❌ | ✅ |
| Query tasks | ✅ | ❌ | ⚠️ |
| OpenClaw native | ✅ | ⚠️ | ❌ |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch
```

## License

MIT
