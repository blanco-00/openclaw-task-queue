## 1. 诊断问题

- [x] 1.1 分析错误信息，找出 API 不兼容的根本原因
- [x] 1.2 查看 OpenClaw 插件框架期望的 registerTool 格式

## 2. 修复插件代码

- [x] 2.1 调整 inputSchema 格式
- [x] 2.2 修复 registerTool 调用参数
- [x] 2.3 重新构建插件

## 3. 验证修复

- [x] 3.1 删除旧数据库，从零开始
- [x] 3.2 重启 Gateway 加载新插件
- [x] 3.3 通过 agent 调用 task_create 测试

## 4. 清理旧方式

- [x] 4.1 检查 TASKS.md 是否还在被使用
- [x] 4.2 确认 cron 任务不再读取 TASKS.md
- [x] 4.3 确保新插件是唯一方式

## 5. 完整流程验证

- [x] 5.1 创建任务 → task_create
- [x] 5.2 查询状态 → task_status
- [x] 5.3 列出任务 → task_list
- [x] 5.4 取消任务 → task_cancel
- [x] 5.5 获取统计 → task_stats
