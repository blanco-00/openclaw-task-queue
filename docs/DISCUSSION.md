# 项目讨论总结

## 背景

用户在使用 OpenClaw 时发现，基于文件的任务管理存在并发问题：

1. **状态管理困难** - 多个 worker 同时读写文件导致状态不一致
2. **并发问题** - 无法防止多个 worker 同时领取同一个任务
3. **重复领取** - 简单的文件锁机制无法保证原子性

## 问题分析

### 文件存储的根本问题

```
❌ 文件存储的致命问题：

Worker A: 读取 task-queue.json → 看到 job_42 状态是 pending
Worker B: 读取 task-queue.json → 也看到 job_42 状态是 pending
Worker A: 更新 job_42 为 running，写回文件
Worker B: 更新 job_42 为 running，写回文件（覆盖了 A 的更新）
→ 同一个任务被两个 worker 执行！
```

### 现有 `.task-lock.json` 的问题

```json
{
  "locked": false,
  "task": null,
  "start_time": null,
  "agent": null
}
```

这是简单的文件写入，没有原子保证。两个 worker 可以同时看到 `locked: false`，然后都认为自己获得了锁。

## 解决方案

### 核心技术：SQLite + Compare-And-Swap (CAS)

```sql
-- 原子领取任务
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
AND status = 'PENDING'  -- CAS 检查！
RETURNING *;
```

**原理**：
1. 子查询找到最高优先级的待处理任务
2. `AND status = 'PENDING'` 是 CAS 检查
3. 如果另一个 worker 已经领取了任务，这个条件就不满足
4. `changes = 1` 表示成功，`changes = 0` 表示已被其他 worker 领走

### 参考实现

| 项目 | Stars | 特点 |
|------|-------|------|
| [liteque](https://github.com/karakeep-app/liteque) | 69 | 生产验证、CAS 模式 |
| [plainjob](https://github.com/justplainstuff/plainjob) | 89 | 15k/s 性能 |

## 市场调研

### 同类产品

| 项目 | Stars | 语言 | 存储 | 目标平台 |
|------|-------|------|------|---------|
| [Maestro](https://github.com/RunMaestro/Maestro) | 2,454 | TypeScript | - | Claude Code/Codex |
| [Mission Control](https://github.com/MeisnerDan/mission-control) | 265 | TypeScript | JSON 文件 | Claude Code |
| [block/agent-task-queue](https://github.com/block/agent-task-queue) | 33 | Python | SQLite | 通用 MCP |
| [liteque](https://github.com/karakeep-app/liteque) | 69 | TypeScript | SQLite | 通用 Node.js |

### OpenClaw 生态现状

**已有的 Task Skills（都是文件基础）**：
- `task-workflow-v3` - 文件持久化任务
- `task-tracker` - 日常任务管理
- `ec-task-orchestrator` - 多Agent协调
- `autonomous-brain` - 自主监控执行

**市场空白**：OpenClaw 生态中没有 SQLite + 并发控制的任务队列插件。

## 架构决策

### 混合模式

```
项目结构：

@openclaw-task-queue/core     # npm 包（核心）
├── src/
│   ├── queue.ts         # SQLite 任务队列（可独立使用）
│   ├── worker.ts        # Worker 执行器
│   ├── types.ts         # 类型定义
│   ├── index.ts         # 插件入口
│   └── tools.ts         # OpenClaw 工具注册
└── package.json
```

**优势**：
1. 插件形式 → 无缝集成 OpenClaw
2. 独立 npm 包 → 非 OpenClaw 用户也能用
3. 分层架构 → 核心（SQLite 队列）可复用

### 任务状态机

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

### 数据库 Schema

```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    
    -- 状态
    status TEXT DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- 并发控制 (关键！)
    claimed_at DATETIME,
    claimed_by TEXT,
    timeout_seconds INTEGER DEFAULT 300,
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    scheduled_at DATETIME,
    
    -- 结果
    result TEXT,
    error TEXT,
    
    -- 来源追踪
    source_channel TEXT,
    source_conversation TEXT,
    source_message TEXT
);

-- 关键索引
CREATE INDEX idx_tasks_claimable 
ON tasks(status, priority DESC, created_at ASC);
```

## 发布策略

### 发布流程

```bash
# 1. 构建
npm run build

# 2. 登录 npm
npm login

# 3. 发布
npm publish --access public
```

### 用户安装

```bash
# OpenClaw 用户一键安装
openclaw plugins install @openclaw-task-queue/core
```

### 推广渠道

1. **OpenClaw 社区**（种子用户）
   - OpenClaw Discord
   - OpenClaw GitHub Discussions
   - 提交到 awesome-openclaw-skills

2. **Node.js 生态**（扩大影响）
   - Hacker News
   - Reddit (r/node, r/javascript)
   - 掘金、V2EX 中文社区

## MVP 功能清单

### 必须有（MVP）✅

- [x] SQLite 存储 + WAL 模式
- [x] CAS 原子领取任务
- [x] 任务状态机 (PENDING → RUNNING → COMPLETED/FAILED/DEAD)
- [x] 超时任务自动回收
- [x] 重试机制
- [x] OpenClaw 工具注册 (task_create, task_status, task_list, task_cancel, task_stats)

### 应该有（V2）

- [ ] 任务优先级（已实现）
- [ ] 定时任务（已实现 scheduled_at）
- [ ] 任务依赖 (DAG)
- [ ] Web UI 面板

### 可选（V3）

- [ ] 多 Worker 支持（已实现）
- [ ] 任务进度回调
- [ ] 失败通知

## 技术要点

### SQLite WAL 模式

```typescript
this.db.pragma("journal_mode = WAL");
this.db.pragma("synchronous = NORMAL");
```

WAL (Write-Ahead Logging) 模式提供更好的并发性能：
- 读写不互相阻塞
- 更好的崩溃恢复
- 适合并发场景

### 为什么不用 Redis？

| 因素 | SQLite | Redis |
|------|--------|-------|
| 依赖 | 无 | 需要额外服务 |
| 部署 | 单文件 | 需要配置 |
| 复杂度 | 低 | 中 |
| 性能 | 15k/s | 极高 |
| 适用场景 | 单机/小规模 | 分布式/大规模 |

对于 OpenClaw 的个人/小团队使用场景，SQLite 更合适。

## 文件清单

```
openclaw-task-queue/
├── package.json              # npm 包配置
├── openclaw.plugin.json      # OpenClaw 插件清单
├── tsconfig.json             # TypeScript 配置
├── README.md                 # 项目文档
├── src/
│   ├── index.ts              # 插件入口
│   ├── queue.ts              # 核心队列实现
│   ├── worker.ts             # Worker 执行器
│   ├── tools.ts              # OpenClaw 工具注册
│   └── types.ts              # 类型定义
└── docs/
    └── DISCUSSION.md         # 本文档
```

## 下一步

1. **测试** - 编写单元测试和集成测试
2. **发布** - 发布到 npm
3. **推广** - 在 OpenClaw 社区宣传
4. **迭代** - 根据用户反馈添加功能

---

*文档创建时间：2026-03-13*
