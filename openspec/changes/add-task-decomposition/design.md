# 设计文档：智能任务拆分功能

## Context

任务拆分需要 AI 能力，当前方案：
- 使用 LLM 分析任务描述
- 拆分为结构化的子任务
- 用户确认后批量创建

## Goals / Non-Goals

**Goals:**
1. task_decompose - 智能拆分复杂任务
2. task_archive - 自动归档已完成任务
3. task_cleanup - 清理过期任务

**Non-Goals:**
- 不修改现有核心队列逻辑

## Decisions

### D1: 拆分策略
**决策**: 返回 JSON 格式的子任务列表，包含：
- `type`: 子任务类型
- `payload`: 子任务数据
- `dependsOn`: 依赖任务ID数组（可选）
- `order`: 执行顺序（数字越小越先执行）
- `estimateMinutes`: 预估时间

**示例**:
```json
{
  "subtasks": [
    {
      "id": "step-1",
      "type": "analyze",
      "description": "分析代码结构",
      "dependsOn": [],
      "order": 1,
      "estimateMinutes": 10
    },
    {
      "id": "step-2", 
      "type": "refactor-core",
      "description": "重构核心模块",
      "dependsOn": ["step-1"],
      "order": 2,
      "estimateMinutes": 30
    },
    {
      "id": "step-3",
      "type": "test",
      "description": "测试验证",
      "dependsOn": ["step-2"],
      "order": 3,
      "estimateMinutes": 15
    }
  ]
}
```

### D2: 依赖执行逻辑
**决策**: 
- 任务创建时可指定 `depends_on` 字段
- Worker 领取任务时检查依赖是否已完成
- 只有所有依赖都 COMPLETED 才能领取
- 支持 `order` 字段控制同层级执行顺序

**数据库字段**:
```sql
ALTER TABLE tasks ADD COLUMN depends_on TEXT;  -- JSON数组: ["task-1", "task-2"]
ALTER TABLE tasks ADD COLUMN order_index INTEGER;  -- 执行顺序
```

**数据库字段**:
```sql
ALTER TABLE tasks ADD COLUMN depends_on TEXT;  -- JSON数组: ["task-1", "task-2"]
ALTER TABLE tasks ADD COLUMN order_index INTEGER;  -- 执行顺序
```

### D3: 归档策略
**决策**: 
- 完成任务 N 天后自动归档（可配置）
- 归档到单独表或标记 `archived_at`
- 支持查询归档任务

### D4: 清理策略
**决策**:
- 清理 cancelled/dead 任务（可选）
- 清理 N 天前的已完成任务（默认30天）
- 支持手动触发

## Open Questions

1. **Q: 拆分粒度如何控制?**
   - 方案1: 让 LLM 自行判断
   - 方案2: 用户指定最大拆分数
   - 建议默认方案1，用户可覆盖
