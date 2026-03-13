# OpenClaw 任务队列

基于 SQLite 的 AI 代理任务队列，支持原子操作。

## 特性

- **SQLite + WAL 模式** - 单文件数据库，更好的并发性能
- **原子任务认领** - Compare-And-Swap (CAS) 防止重复处理
- **自动超时恢复** - 卡住的任务自动回收
- **失败重试** - 可配置重试次数
- **优先级队列** - 按优先级和创建时间处理任务
- **定时任务** - 延迟到指定时间执行
- **任务追踪** - 完整的任务状态和历史记录

## 安装

### 作为 OpenClaw 插件

```bash
openclaw plugins install @openclaw-task-queue/core
```

### 作为独立库

```bash
npm install @openclaw-task-queue/core better-sqlite3
```

## 快速开始

### OpenClaw 插件用法

安装后，以下工具会自动可用：

```
用户: 帮我分析这个大型数据集，但不用马上完成，后台处理就行

代理: 我来创建一个后台任务来处理这个分析。
[使用 task_create 工具]

✅ 已创建任务 task-1710123456-abc123
任务将在后台执行，预计需要 5-10 分钟。

你可以随时用 task_status 查询进度。
```

### 独立使用

```typescript
import { TaskQueue, TaskWorker } from "@openclaw-task-queue/core";

// 创建队列
const queue = new TaskQueue({
  dbPath: "./tasks.db",
  maxRetries: 3,
  timeoutSeconds: 300,
});

// 创建任务
const taskId = await queue.createTask({
  type: "data-analysis",
  payload: { dataset: "sales_2024.csv" },
  priority: "high",
});

console.log(`已创建任务: ${taskId}`);

// 启动工作器
const worker = new TaskWorker(queue, {
  concurrency: 2,
  processor: async (task) => {
    console.log(`处理 ${task.id}...`);
    
    // 你的处理逻辑
    const result = await processData(task.payload);
    
    return result;
  }
});

await worker.start();
```

## 工具

### task_create

创建新的后台任务。

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

参数：
- `type` (必填): 任务类型标识
- `payload` (必填): 任务数据
- `priority`: "high" | "medium" | "low" (默认: "medium")
- `scheduledAt`: 延迟执行的 ISO 时间
- `maxRetries`: 覆盖默认重试次数
- `timeoutSeconds`: 覆盖默认超时时间

### task_status

查询任务状态。

```json
{
  "taskId": "task-1710123456-abc123"
}
```

返回：
- `status`: PENDING | RUNNING | COMPLETED | FAILED | DEAD
- `retryCount`: 重试次数
- `error`: 错误信息（如果有）
- `result`: 任务结果（如果完成）

### task_list

列出任务。

```json
{
  "status": "PENDING",
  "limit": 20
}
```

### task_cancel

取消待执行的任务（只能取消 PENDING 状态的任务）。

```json
{
  "taskId": "task-1710123456-abc123"
}
```

### task_stats

获取队列统计信息。

返回各状态的任务数量。

## API

### TaskQueue

```typescript
const queue = new TaskQueue({
  dbPath: "./tasks.db",      // 数据库路径
  maxRetries: 3,              // 最大重试次数
  timeoutSeconds: 300,        // 超时秒数
});

// 方法
await queue.createTask(options);     // 创建任务
await queue.claimTask(workerId);     // 认领任务
await queue.completeTask(id, result); // 完成任务
await queue.failTask(id, error);      // 失败任务
await queue.getTask(id);              // 获取任务
await queue.listTasks(options);       // 列出任务
await queue.getTaskCounts();          // 统计任务
await queue.reclaimTimeoutTasks();    // 回收超时任务
queue.close();                        // 关闭连接
```

### TaskWorker

```typescript
const worker = new TaskWorker(queue, {
  concurrency: 2,           // 并发数
  pollIntervalMs: 5000,     // 轮询间隔
  processor: async (task) => {
    // 处理逻辑
    return { result: "done" };
  }
});

await worker.start();
await worker.stop();
```

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 测试
npm test
```

## 许可证

MIT
