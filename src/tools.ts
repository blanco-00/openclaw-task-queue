import type { PluginApi } from "./types";
import { TaskQueue } from "./queue";
import { TaskPriority } from "./types";

type ToolParams = Record<string, unknown>;
type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

export function registerTools(api: PluginApi, queue: TaskQueue) {
  api.registerTool({
    name: "task_create",
    description: `Create a new background task that will be processed asynchronously.

Use this when:
- The user requests a complex operation that may take time
- You need to schedule work for later
- You want to track progress of a long-running operation

The task will be queued and processed by a background worker. You can check its status using task_status.`,
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Task type identifier (e.g., 'analysis', 'report', 'data-sync')"
        },
        payload: {
          type: "object",
          description: "Task data/payload (any JSON-serializable object)"
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          default: "medium",
          description: "Task priority (high=10, medium=5, low=0)"
        },
        scheduledAt: {
          type: "string",
          description: "ISO 8601 datetime for scheduled execution (optional)"
        },
        maxRetries: {
          type: "number",
          description: "Maximum retry attempts (default: 3)"
        },
        timeoutSeconds: {
          type: "number",
          description: "Task timeout in seconds (default: 300)"
        }
      },
      required: ["type", "payload"]
    },
    async execute(_id: string, params: ToolParams): Promise<ToolResult> {
      try {
        const priorityMap: Record<string, number> = {
          high: TaskPriority.HIGH,
          medium: TaskPriority.MEDIUM,
          low: TaskPriority.LOW
        };

        const taskId = await queue.createTask({
          type: params.type as string,
          payload: params.payload as Record<string, unknown>,
          priority: priorityMap[params.priority as string] ?? TaskPriority.MEDIUM,
          scheduledAt: params.scheduledAt ? new Date(params.scheduledAt as string) : undefined,
          maxRetries: params.maxRetries as number | undefined,
          timeoutSeconds: params.timeoutSeconds as number | undefined,
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              taskId,
              message: `Task created successfully. Use task_status to check progress.`
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  });

  api.registerTool({
    name: "task_status",
    description: `Check the status of a task by its ID.

Returns:
- status: PENDING, RUNNING, COMPLETED, FAILED, or DEAD
- retryCount: Number of retry attempts
- error: Error message if failed
- result: Task result if completed`,
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID returned by task_create"
        }
      },
      required: ["taskId"]
    },
    async execute(_id: string, params: ToolParams): Promise<ToolResult> {
      try {
        const status = await queue.getTaskStatus(params.taskId as string);

        if (!status) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Task not found"
              }, null, 2)
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              ...status
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  });

  api.registerTool({
    name: "task_list",
    description: `List tasks in the queue with optional filters.

Use this to see pending, running, completed, or failed tasks.`,
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED", "DEAD", "all"],
          default: "all",
          description: "Filter by task status"
        },
        type: {
          type: "string",
          description: "Filter by task type"
        },
        limit: {
          type: "number",
          default: 20,
          description: "Maximum number of tasks to return"
        }
      }
    },
    async execute(_id: string, params: ToolParams): Promise<ToolResult> {
      try {
        const tasks = await queue.listTasks({
          status: params.status === "all" ? undefined : params.status as string,
          type: params.type as string | undefined,
          limit: params.limit as number | undefined,
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: tasks.length,
              tasks: tasks.map(t => ({
                id: t.id,
                type: t.type,
                status: t.status,
                priority: t.priority,
                retryCount: t.retry_count,
                createdAt: t.created_at,
                startedAt: t.started_at,
                completedAt: t.completed_at,
                error: t.error
              }))
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  });

  api.registerTool({
    name: "task_cancel",
    description: `Cancel a pending task.

Note: Only PENDING tasks can be cancelled. Running tasks cannot be cancelled.`,
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID to cancel"
        }
      },
      required: ["taskId"]
    },
    async execute(_id: string, params: ToolParams): Promise<ToolResult> {
      try {
        const task = await queue.getTask(params.taskId as string);

        if (!task) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Task not found"
              }, null, 2)
            }],
            isError: true
          };
        }

        if (task.status !== "PENDING") {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Cannot cancel task in ${task.status} state`
              }, null, 2)
            }],
            isError: true
          };
        }

        await queue.failTask(params.taskId as string, "Cancelled by user", false);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Task cancelled"
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  });

  api.registerTool({
    name: "task_stats",
    description: `Get task queue statistics.

Returns counts of tasks by status (PENDING, RUNNING, COMPLETED, FAILED, DEAD).`,
    parameters: {
      type: "object",
      properties: {}
    },
    async execute(_id: string, params: ToolParams): Promise<ToolResult> {
      try {
        const counts = await queue.getTaskCounts();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              counts
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  });

  api.registerTool({
    name: "task_decompose",
    description: `Decompose a complex task into atomic subtasks with dependencies.

Use this when:
- User provides a complex task that needs to be split into smaller pieces
- You can identify clear subtasks with dependencies
- You need to track execution order

For each subtask, you can specify:
- blocking: "interactive" | "background" (default: "background")
  - "background" = async, 可定时自动执行
  - "interactive" = 需要用户交互确认，拆分后需暂停等待用户回复
- dependsOn: Array of subtask IDs that must complete first
- orderIndex: Execution order (lower = earlier)

IMPORTANT: If a subtask requires user input/validation/confirmation, set blocking: "interactive" and the workflow will pause until user responds.

If you CANNOT decompose the task at all, use askUser: true to ask for clarification.`,
    parameters: {
      type: "object",
      properties: {
        parentTaskId: {
          type: "string",
          description: "Optional parent task ID"
        },
        subtasks: {
          type: "array",
          description: "Array of subtask definitions",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Temporary ID for referencing in dependsOn (e.g., 'step-1')"
              },
              type: {
                type: "string",
                description: "Task type"
              },
              payload: {
                type: "object",
                description: "Task payload"
              },
              priority: {
                type: "string",
                enum: ["high", "medium", "low"],
                default: "medium"
              },
              blocking: {
                type: "string",
                enum: ["background", "interactive"],
                default: "background",
                description: "Execution mode: background=async, interactive=需要用户确认"
              },
              dependsOn: {
                type: "array",
                items: { type: "string" },
                description: "Array of subtask IDs this depends on"
              },
              orderIndex: {
                type: "number",
                description: "Execution order (0 = first)"
              }
            },
            required: ["id", "type", "payload"]
          }
        },
        askUser: {
          type: "boolean",
          description: "Set to true if you cannot figure out how to decompose - will prompt user for clarification"
        },
        userQuestion: {
          type: "string",
          description: "Question to ask user if askUser is true"
        }
      },
      required: ["subtasks"]
    },
    async execute(_id: string, params: ToolParams): Promise<ToolResult> {
      try {
        if (params.askUser) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                needsUserInput: true,
                question: params.userQuestion || "How should this task be broken down?",
                message: "I'm not sure how to decompose this task. Could you help me understand the steps involved?"
              }, null, 2)
            }]
          };
        }

        const subtasks = params.subtasks as Array<{
          id: string;
          type: string;
          payload: Record<string, unknown>;
          priority?: string;
          blocking?: "background" | "interactive";
          dependsOn?: string[];
          orderIndex?: number;
        }>;

        const priorityMap: Record<string, number> = {
          high: TaskPriority.HIGH,
          medium: TaskPriority.MEDIUM,
          low: TaskPriority.LOW
        };

        const idMap: Record<string, string> = {};
        const createdTasks: Array<{ tempId: string; taskId: string; blocking: boolean }> = [];
        let hasInteractive = false;

        for (const subtask of subtasks) {
          const isInteractive = subtask.blocking === "interactive";
          if (isInteractive) hasInteractive = true;

          const taskId = await queue.createTask({
            type: subtask.type,
            payload: {
              ...subtask.payload,
              parentTaskId: params.parentTaskId,
              _blocking: isInteractive ? "interactive" : "background"
            },
            priority: priorityMap[subtask.priority || "medium"] ?? TaskPriority.MEDIUM,
            dependsOn: subtask.dependsOn?.map((depId: string) => idMap[depId]).filter(Boolean),
            orderIndex: subtask.orderIndex ?? 0
          });

          idMap[subtask.id] = taskId;
          createdTasks.push({ tempId: subtask.id, taskId, blocking: isInteractive });
        }

        const response: Record<string, unknown> = {
          success: true,
          parentTaskId: params.parentTaskId,
          createdSubtasks: createdTasks.length,
          tasks: createdTasks,
          message: `Created ${createdTasks.length} subtasks.`
        };

        if (hasInteractive) {
          response.paused = true;
          response.message += " Workflow paused at interactive subtask(s).";
          response.nextAction = "Wait for user confirmation before continuing.";
        } else {
          response.message += " Use task_status to monitor progress.";
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  });

  api.registerTool({
    name: "task_archive",
    description: `Archive completed tasks.

Use this to mark tasks as archived. Archived tasks are kept for reference but excluded from normal queries.

Typically called after a parent task and all its subtasks are complete.`,
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID to archive"
        }
      },
      required: ["taskId"]
    },
    async execute(_id: string, params: ToolParams): Promise<ToolResult> {
      try {
        await queue.archiveTask(params.taskId as string);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Task ${params.taskId} archived`
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  });

  api.registerTool({
    name: "task_cleanup",
    description: `Clean up old archived tasks.

Removes archived tasks older than specified days. Default: 7 days.

This helps keep the database size manageable.`,
    parameters: {
      type: "object",
      properties: {
        olderThanDays: {
          type: "number",
          default: 7,
          description: "Remove archived tasks older than this many days"
        }
      }
    },
    async execute(_id: string, params: ToolParams): Promise<ToolResult> {
      try {
        const deleted = await queue.cleanupOldTasks(params.olderThanDays as number ?? 7);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              deletedCount: deleted,
              message: `Cleaned up ${deleted} old tasks`
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  });

  api.registerTool({
    name: "task_purge",
    description: `Permanently delete specific tasks by ID.

Use this to clean up stuck or unwanted tasks from the queue.
WARNING: This is a hard delete - task will be permanently removed.`,
    parameters: {
      type: "object",
      properties: {
        taskIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of task IDs to delete"
        }
      },
      required: ["taskIds"]
    },
    async execute(_id: string, params: ToolParams): Promise<ToolResult> {
      try {
        const taskIds = params.taskIds as string[];
        const deleted = await queue.purgeTasks(taskIds);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              deletedCount: deleted,
              message: `Purged ${deleted} task(s)`
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  });
}
