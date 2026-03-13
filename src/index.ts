import type { PluginApi } from "./types";
import { TaskQueue } from "./queue";
import { registerTools } from "./tools";
import type { TaskQueueConfig } from "./types";

export type { Task, TaskStatus, TaskPriority, CreateTaskOptions, TaskQueueConfig, TaskProcessor } from "./types";
export { TaskQueue } from "./queue";
export { TaskWorker, startWorker } from "./worker";

export default function register(api: PluginApi) {
  const pluginConfig = api.config.plugins?.entries?.["task-queue"]?.config ?? {};

  const config: TaskQueueConfig = {
    dbPath: String(pluginConfig.dbPath ?? "~/.openclaw/task-queue.db"),
    maxRetries: (pluginConfig.maxRetries as number) ?? 3,
    timeoutSeconds: (pluginConfig.timeoutSeconds as number) ?? 300,
    concurrency: (pluginConfig.concurrency as number) ?? 1,
    pollIntervalMs: (pluginConfig.pollIntervalMs as number) ?? 5000,
  };

  const queue = new TaskQueue(config);

  // Register the task queue tools
  registerTools(api, queue);

  // Register the cron service if enabled
  const cronEnabled = (pluginConfig.cronEnabled as boolean) ?? true;
  const cronIntervalMs = (pluginConfig.cronIntervalMs as number) ?? 60000;

  if (cronEnabled) {
    let intervalId: NodeJS.Timeout | null = null;
    let isRunning = false;

    api.registerService({
      id: "task-queue-cron",
      start: async () => {
        console.log("[task-queue] Cron service starting, interval:", cronIntervalMs, "ms");
        
        // Run immediately on start
        await processQueue(queue, config.concurrency ?? 1);
        
        // Then run at interval
        intervalId = setInterval(async () => {
          if (isRunning) {
            console.log("[task-queue] Cron already running, skipping this cycle");
            return;
          }
          
          try {
            isRunning = true;
        await processQueue(queue, config.concurrency ?? 1);
          } catch (error) {
            console.error("[task-queue] Cron error:", error);
          } finally {
            isRunning = false;
          }
        }, cronIntervalMs);
        
        console.log("[task-queue] Cron service started");
      },
      stop: async () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
          console.log("[task-queue] Cron service stopped");
        }
      },
    });
  }

  process.on("SIGTERM", () => {
    queue.close();
  });

  process.on("SIGINT", () => {
    queue.close();
  });
}

async function processQueue(queue: TaskQueue, concurrency: number) {
  const stats = await queue.getTaskCounts();
  if (stats.PENDING > 0 && stats.RUNNING < concurrency) {
    const availableSlots = concurrency - stats.RUNNING;
    for (let i = 0; i < availableSlots; i++) {
      const claimed = await queue.claimTask("cron-worker");
      if (claimed) {
        console.log(`[task-queue] Claimed task: ${claimed.id}`);
      }
    }
  }
}

export function createQueue(config?: Partial<TaskQueueConfig>): TaskQueue {
  return new TaskQueue({
    dbPath: config?.dbPath ?? "~/.openclaw/task-queue.db",
    maxRetries: config?.maxRetries,
    timeoutSeconds: config?.timeoutSeconds,
  });
}
