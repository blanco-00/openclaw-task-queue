# OpenClaw 任务队列

基于 SQLite 的 AI 代理任务队列，支持原子操作。

## 核心价值

让 AI 自己管理任务队列，实现「用户提交任务 → AI 自动拆分 → 定时领取 → 执行 → 反馈」的完全自动化。

## 特性

- **AI 自驱闭环** - 定时自动领取任务执行，无需人工干预
- **SQLite + WAL 模式** - 单文件数据库，高并发支持
- **原子任务认领** - CAS 防止重复处理
- **自动超时恢复** - 卡住的任务自动回收
- **失败重试** - 可配置重试次数
- **优先级队列** - 按优先级和创建时间处理
- **定时任务** - 支持延迟到指定时间执行
- **任务追踪** - 完整的状态和历史记录
- **内置 Cron** - 自动定时处理任务队列

## 安装

### 作为 OpenClaw 插件

```bash
openclaw plugins install @openclaw-task-queue/core
```

### 作为独立库

```bash
npm install @openclaw-task-queue/core better-sqlite3
```

## 工作流

```
用户提交 → AI拆分 → 定时领取 → 执行 → 反馈
```

## 快速开始

### OpenClaw 插件用法

安装后，以下工具会自动可用：

```
用户: 帮我分析这个大型数据集

代理: [调用 task_create]
✅ 已创建任务 task-xxx
```

### 演示

#### 1. 创建任务

```
用户: 创建一个简单的测试任务

代理: [调用 task_create]
✅ 已创建简单测试任务

| 项目 | 详情 |
|------|------|
| 任务ID | task-xxx |
| 类型 | test |
| 优先级 | low |
| 状态 | ⏳ PENDING |
```

#### 2. 获取统计

```
用户: 获取任务统计

代理: [调用 task_stats]
任务统计结果：

| 状态 | 数量 |
|------|------|
| ⏳ PENDING | 3 |
| 🔄 RUNNING | 0 |
| ✅ COMPLETED | 0 |
| ❌ FAILED | 0 |
```

#### 3. 列出任务

```
用户: 列出所有待处理任务

代理: [调用 task_list]
待处理任务列表：

| 序号 | 任务ID | 类型 | 优先级 |
|------|--------|------|--------|
| 1 | task-xxx | test | 5 |
| 2 | task-yyy | analysis | 10 |
```

#### 4. 查看状态

```
用户: 查看任务 xxx 的状态

代理: [调用 task_status]
任务状态:

| 项目 | 详情 |
|------|------|
| 任务ID | task-xxx |
| 状态 | ⏳ PENDING |
| 优先级 | 5 |
| 创建时间 | 2026-03-13 12:00:00 |
```

#### 5. 取消任务

```
用户: 取消任务 task-xxx

代理: [调用 task_cancel]
已成功取消任务 task-xxx ✅
```

### 独立使用

```typescript
import { TaskQueue, TaskWorker } from "@openclaw-task-queue/core";

const queue = new TaskQueue({
  dbPath: "./tasks.db",
  maxRetries: 3,
  timeoutSeconds: 300,
});

const taskId = await queue.createTask({
  type: "data-analysis",
  payload: { dataset: "sales_2024.csv" },
  priority: "high",
});

console.log(`Created task: ${taskId}`);
```

## 工具

### task_create

创建新后台任务。

```json
{
  "type": "report-generation",
  "payload": {
    "template": "monthly",
    "month": "2024-03"
  },
  "priority": "high"
}
```

参数:
- `type` (必填): 任务类型标识符
- `payload` (必填): 任务数据
- `priority`: "high" | "medium" | "low" (默认: "medium")
- `scheduledAt`: 延迟执行的 ISO 时间

### task_status

查看任务状态。

```json
{
  "taskId": "task-1710123456-abc123"
}
```

### task_list

列出任务（支持过滤）。

```json
{
  "status": "PENDING",
  "type": "data-analysis",
  "limit": 50
}
```

### task_cancel

取消待处理任务。

```json
{
  "taskId": "task-1710123456-abc123"
}
```

### task_stats

获取队列统计。

```json
{}
```

返回:
```json
{
  "PENDING": 15,
  "RUNNING": 2,
  "COMPLETED": 234,
  "FAILED": 3,
  "DEAD": 1
}
```

### task_decompose

将复杂任务拆分为原子子任务（带依赖关系）。

```json
{
  "subtasks": [
    {
      "id": "step-1",
      "type": "analyze",
      "payload": { "target": "dataset" },
      "orderIndex": 0
    },
    {
      "id": "step-2",
      "type": "process",
      "payload": { "input": "step-1-result" },
      "dependsOn": ["step-1"],
      "blocking": "interactive",
      "orderIndex": 1
    },
    {
      "id": "step-3",
      "type": "report",
      "payload": { "data": "step-2-result" },
      "dependsOn": ["step-2"],
      "blocking": "background",
      "orderIndex": 2
    }
  ]
}
```

参数:
- `subtasks` (必填): 子任务定义数组
  - `id`: 临时ID，用于引用 (如 "step-1")
  - `type`: 任务类型
  - `payload`: 任务数据
  - `blocking`: "background" (默认) | "interactive"
  - `dependsOn`: 依赖的子任务ID数组
  - `orderIndex`: 执行顺序 (越小越先)
- `askUser`: 无法拆分时设为true，会提示用户

返回:
```json
{
  "success": true,
  "createdSubtasks": 3,
  "tasks": [
    { "tempId": "step-1", "taskId": "task-xxx", "blocking": false },
    { "tempId": "step-2", "taskId": "task-yyy", "blocking": true },
    { "tempId": "step-3", "taskId": "task-zzz", "blocking": false }
  ],
  "paused": true,
  "message": "已创建3个子任务。工作流在交互式子任务处暂停。",
  "nextAction": "等待用户确认后继续。"
}
```

### task_archive

归档已完成的任务。

```json
{
  "taskId": "task-1710123456-abc123"
}
```

### task_cleanup

清理旧的归档任务。

```json
{
  "olderThanDays": 7
}
```

参数:
- `olderThanDays`: 删除多少天前的归档任务 (默认: 7)

### task_purge

永久删除指定任务。

```json
{
  "taskIds": ["task-1710123456-abc123", "task-1710123457-def456"]
}
```

参数:
- `taskIds` (必填): 要删除的任务ID数组

### task_find_stuck

查找卡住的任务（PENDING 状态且有错误信息）。

```json
{}
```

返回带有 "Cancelled by user" 或 timeout 错误的任务。

### task_repair

修复历史遗留的已取消任务。修复bug修复前的已取消任务 - 将状态为 PENDING 且错误信息包含 "Cancelled" 的任务改为 FAILED 状态。

```json
{}
```

返回修复的任务数量。

## 任务生命周期

```
PENDING → claim() → RUNNING → complete() → COMPLETED
                    │
              fail(retryable=true) │ timeout()
                    │
                    ▼
            FAILED(可重试) → retry() → PENDING
                    │
         fail(retryable=false) / 超过最大重试
                    ▼
                   DEAD

PENDING → cancel() → FAILED (不可重试)
```

## 配置

### OpenClaw 插件

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
          "enableWorker": true,
          "cronEnabled": true,
          "cronIntervalMs": 60000
        }
      }
    }
  }
}
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| dbPath | string | ~/.openclaw/task-queue.db | 数据库路径 |
| concurrency | number | 1 | 最大并发任务数 |
| pollIntervalMs | number | 5000 | Worker 轮询间隔 |
| maxRetries | number | 3 | 最大重试次数 |
| timeoutSeconds | number | 300 | 任务超时时间 |
| enableWorker | boolean | true | 启用 Worker |
| cronEnabled | boolean | true | 启用内置 Cron |
| cronIntervalMs | number | 60000 | Cron 间隔 |

## 长运行 Agent

### 核心思路

利用任务队列 + 内置 Cron，构建自主工作的 AI Agent:

1. **任务入口**: 用户通过对话提交任务
2. **任务拆分**: AI 自动拆分为可执行的子任务
3. **定时领取**: Cron 自动检查并领取任务
4. **执行反馈**: 执行完成后更新状态并通知用户

### 配置示例

```javascript
// 用户提交: "帮我重构这个项目"

// 1. AI 使用 task_create 创建任务
await taskCreate({
  type: "code-refactor",
  payload: { target: "整个项目" }
});

// 2. AI 拆分为子任务
await taskCreate({ type: "analyze", payload: {...} });
await taskCreate({ type: "refactor-module-a", payload: {...} });
await taskCreate({ type: "refactor-module-b", payload: {...} });
await taskCreate({ type: "test", payload: {...} });

// 3. 内置 Cron 自动领取并执行
// cronIntervalMs = 60000 (每分钟检查一次)
```

## 架构

### 为什么用 SQLite?

- **无外部依赖** - 不需要 Redis、PostgreSQL 等
- **单文件** - 易于备份、迁移和调试
- **WAL 模式** - 更好的并发读写性能
- **原子操作** - CAS 防止竞态条件

### 原子任务领取

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

这个语句原子地:
1. 找到最高优先级的待处理任务
2. 仅在仍为 PENDING 时领取 (防止竞态)
3. 返回被领取的任务

### 数据库表结构

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'PENDING',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  claimed_at DATETIME,
  claimed_by TEXT,
  timeout_seconds INTEGER DEFAULT 300,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  scheduled_at DATETIME,
  
  result TEXT,
  error TEXT,
  
  -- 任务拆分字段
  depends_on TEXT,        -- JSON 数组: ["task-1", "task-2"]
  order_index INTEGER,   -- 执行顺序
  archived_at DATETIME,  -- 归档时间戳
  
  source_channel TEXT,
  source_conversation TEXT,
  source_message TEXT
);
```

## 对比

| 特性 | 本项目 | 文件方式 | Redis (BullMQ) |
|------|--------|---------|-----------------|
| 并发安全 | ✅ | ❌ | ✅ |
| 无外部依赖 | ✅ | ✅ | ❌ |
| 易备份 | ✅ | ✅ | ❌ |
| 原子操作 | ✅ | ❌ | ✅ |
| 查询任务 | ✅ | ❌ | ⚠️ |
| OpenClaw 原生 | ✅ | ⚠️ | ❌ |
| 内置 Cron | ✅ | ❌ | ❌ |

## 开发

```bash
npm install
npm run build
npm test
npm run test:watch
```

## 许可证

MIT
