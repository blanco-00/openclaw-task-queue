# OpenClaw 任务队列

基于 SQLite 的 AI 代理任务队列，支持原子操作。

## 核心价值

**一句话概括**: 让 AI 自己管理任务队列，实现「用户提交任务 → AI 自动拆分 → 定时领取 → 执行 → 反馈」的完全自动化。

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

### 演示 | Demo

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
