# 设计文档：修复插件 Agent 集成

## Context

OpenClaw 插件系统期望的 registerTool 格式与当前实现不同。错误信息 `Cannot read properties of undefined (reading 'properties')` 表明传入的参数结构与框架期望不匹配。

## Goals / Non-Goals

**Goals:**
1. 修复插件 API 兼容性，使 agent 能正常调用工具
2. 从零验证完整流程
3. 清理旧的任务管理方式

**Non-Goals:**
- 不修改任务队列核心逻辑
- 不改变数据库结构
- 不影响现有的 standalone 使用方式

## Decisions

### D1: API 修复策略
**决策:** 检查 OpenClaw 插件框架期望的 inputSchema 格式
**理由:** 错误信息指向 properties 字段，需要确认框架期望的具体格式

### D2: 验证策略
**决策:** 删除旧数据库，从零开始测试
**理由:** 确保测试不受旧数据影响

## Open Questions

1. **Q: OpenClaw 期望的 inputSchema 格式是什么?**
   - 需要查看框架源码或文档确认
   
2. **Q: 如何确保旧 TASKS.md 不影响测试?**
   - 需要检查 cron 任务是否还在读取 TASKS.md
