## ADDED Requirements

### Requirement: 任务创建
用户或 AI 能够使用 task_create 工具创建新任务。

#### Scenario: 创建简单任务
- **WHEN** 用户调用 task_create 工具，传入任务名称 "测试任务"
- **THEN** 系统返回任务ID，任务状态为 "pending"

#### Scenario: 创建带描述的任务
- **WHEN** 用户调用 task_create 工具，传入名称和详细描述
- **THEN** 任务包含完整描述信息

#### Scenario: 创建带优先级的任务
- **WHEN** 用户指定优先级为 "high"
- **THEN** 任务的 priority 字段为 "high"

### Requirement: 任务列表查询
用户能够查询任务列表，支持过滤条件。

#### Scenario: 查询所有待处理任务
- **WHEN** 调用 task_list 工具不过滤
- **THEN** 返回所有任务

#### Scenario: 按状态过滤任务
- **WHEN** 调用 task_list 工具，设置 status="pending"
- **THEN** 只返回状态为 pending 的任务

### Requirement: 任务状态查询
用户能够查询单个任务的详细信息。

#### Scenario: 查询存在的任务
- **WHEN** 调用 task_status 工具，传入有效的任务ID
- **THEN** 返回任务完整信息，包括状态、创建时间

#### Scenario: 查询不存在的任务
- **WHEN** 调用 task_status 工具，传入无效的任务ID
- **THEN** 返回错误或 null

### Requirement: 任务取消
用户能够取消待处理的任务。

#### Scenario: 取消待处理任务
- **WHEN** 调用 task_cancel 工具，任务状态为 "pending"
- **THEN** 任务状态变为 "cancelled"

#### Scenario: 取消已完成任务
- **WHEN** 调用 task_cancel 工具，任务状态为 "completed"
- **THEN** 返回错误，任务状态不变

### Requirement: 队列统计
用户能够获取任务队列的统计信息。

#### Scenario: 获取队列统计
- **WHEN** 调用 task_stats 工具
- **THEN** 返回 pending、running、completed、cancelled 任务数量

## MODIFIED Requirements

### Requirement: 任务状态流转
**更新内容:** 使用插件的自动化状态管理替代手动 Markdown 标记

#### Scenario: 任务创建后的初始状态
- **WHEN** 任务被创建
- **THEN** 状态自动设置为 "pending"（待领取）

#### Scenario: 任务被领取后
- **WHEN** 任务从 pending 变为进行中
- **THEN** 系统记录领取时间

#### Scenario: 任务完成
- **WHEN** 任务执行完成
- **THEN** 状态自动更新为 "completed"，记录完成时间
