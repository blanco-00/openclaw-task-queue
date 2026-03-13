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
    maxRetries: pluginConfig.maxRetries as number | undefined ?? 3,
    timeoutSeconds: pluginConfig.timeoutSeconds as number | undefined ?? 300,
  };

  const queue = new TaskQueue(config);

  registerTools(api, queue);

  process.on("SIGTERM", () => {
    queue.close();
  });

  process.on("SIGINT", () => {
    queue.close();
  });
}

export function createQueue(config?: Partial<TaskQueueConfig>): TaskQueue {
  return new TaskQueue({
    dbPath: config?.dbPath ?? "~/.openclaw/task-queue.db",
    maxRetries: config?.maxRetries,
    timeoutSeconds: config?.timeoutSeconds,
  });
}
