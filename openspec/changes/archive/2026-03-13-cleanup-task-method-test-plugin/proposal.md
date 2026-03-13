# 提案：简化任务管理流程并测试插件

## Why

当前 OpenClaw 使用复杂的手动任务管理流程（TASKS.md + 多个文档），存在以下问题：
1. 任务创建、领取、状态更新需要手动编辑 Markdown 文件
2. 多个文档（auto-task-system.md, ai-auto-task.md, sub-agent-task-allocation.md）功能重叠
3. 缺乏自动化，容易遗漏任务状态更新
4. 没有结构化数据存储，查询统计困难

我们已开发 `@openclaw-task-queue/core` 插件，提供 5 个工具函数，可以一键创建任务、查看状态、列表查询、取消任务、统计队列。现在需要简化现有流程并验证插件可用性。

## What Changes

1. **用插件替换手动 TASKS.md 流程**
   - 使用 `task_create` 替代手动添加任务到 Markdown
   - 使用 `task_list` 替代手动搜索 TASKS.md
   - 使用 `task_status` 替代手动查看状态
   - 使用 `task_cancel` 替代手动删除任务
   - 使用 `task_stats` 获取队列统计

2. **清理重叠文档**
   - 合并 `auto-task-system.md` 和 `ai-auto-task.md` 为简单的插件使用指南
   - 更新 `sub-agent-task-allocation.md` 使用插件的队列查询功能

3. **本地测试验证**
   - 安装插件到本地 OpenClaw
   - 创建测试任务
   - 验证领取、执行、状态更新流程
   - 确认一键使用的简便性

## Capabilities

### New Capabilities
- `plugin-task-workflow`: 使用 @openclaw-task-queue/core 插件的任务工作流
  - 任务创建：使用 task_create 工具
  - 任务领取：自动/手动从队列领取
  - 状态追踪：实时查询任务状态
  - 统计报表：获取队列健康度

### Modified Capabilities
- `task-management`: 更新任务管理规范，增加插件集成说明

## Impact

- **代码影响**: 无需修改插件代码（已开发完成）
- **文档影响**: 需要更新 `~/.openclaw/workspace/docs/` 下的任务相关文档
- **依赖影响**: 需要在 OpenClaw 中安装 @openclaw-task-queue/core
- **系统影响**: 现有 TASKS.md 可以保留作为历史记录，新增任务使用插件
