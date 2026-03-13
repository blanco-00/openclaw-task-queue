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
    inputSchema: {
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
          type: "integer",
          description: "Maximum retry attempts (default: 3)"
        },
        timeoutSeconds: {
          type: "integer",
          description: "Task timeout in seconds (default: 300)"
        }
      },
      required: ["type", "payload"]
    },
    handler: async (params: ToolParams): Promise<ToolResult> => {
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
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID returned by task_create"
        }
      },
      required: ["taskId"]
    },
    handler: async (params: ToolParams): Promise<ToolResult> => {
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
    inputSchema: {
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
          type: "integer",
          default: 20,
          description: "Maximum number of tasks to return"
        }
      }
    },
    handler: async (params: ToolParams): Promise<ToolResult> => {
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
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID to cancel"
        }
      },
      required: ["taskId"]
    },
    handler: async (params: ToolParams): Promise<ToolResult> => {
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

        await queue.failTask(params.taskId as string, "Cancelled by user");

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
    inputSchema: {
      type: "object",
      properties: {}
    },
    handler: async (): Promise<ToolResult> => {
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
}
