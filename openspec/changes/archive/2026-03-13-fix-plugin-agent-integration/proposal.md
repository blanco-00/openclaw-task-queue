# 提案：修复插件 Agent 集成并验证

## Why

当前 @openclaw-task-queue/core 插件存在以下问题：
1. 通过 OpenClaw agent 调用工具时报错: `Cannot read properties of undefined (reading 'properties')`
2. 插件 API 与 OpenClaw 框架不完全兼容
3. 需要验证从零开始的完整流程是否有效

## What Changes

1. **修复插件 API 兼容性**
   - 调整 inputSchema 格式，适配 OpenClaw 框架
   - 修复 registerTool 调用方式
   - 确保参数正确传递

2. **从零验证完整流程**
   - 删除现有测试数据库，重新初始化
   - 测试完整的任务创建 → 状态查询 → 取消流程
   - 验证一键使用是否正常

3. **清理旧方式**
   - 确认 TASKS.md 不再被自动读取
   - 清理可能影响测试的 cron 任务
   - 确保新插件是唯一的任务管理方式

## Capabilities

### New Capabilities
- `plugin-agent-integration`: 修复后的插件与 OpenClaw agent 集成

### Modified Capabilities
- 无

## Impact

- **代码影响**: 修改 `src/tools.ts` 中的 registerTool 调用
- **配置影响**: 可能需要更新 `openclaw.json` 配置
- **数据影响**: 需要重置测试数据库
