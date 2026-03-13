import { TaskQueue } from "./queue";
import { Task, TaskProcessor, WorkerConfig } from "./types";
import { v4 as uuidv4 } from "uuid";

type InternalWorkerConfig = {
  concurrency: number;
  pollIntervalMs: number;
  processor?: TaskProcessor;
};

export class TaskWorker {
  private queue: TaskQueue;
  private config: InternalWorkerConfig;
  private workerId: string;
  private running: boolean = false;
  private pollTimer?: ReturnType<typeof setInterval>;
  private activeTasks: Set<string> = new Set();

  constructor(queue: TaskQueue, config: WorkerConfig) {
    this.queue = queue;
    this.config = {
      concurrency: config.concurrency ?? 1,
      pollIntervalMs: config.pollIntervalMs ?? 5000,
      processor: config.processor,
    };
    this.workerId = `worker-${uuidv4().slice(0, 8)}`;
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    console.log(`[TaskWorker] Starting worker ${this.workerId}`);

    this.pollTimer = setInterval(() => {
      this.poll();
    }, this.config.pollIntervalMs);

    await this.poll();
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    console.log(`[TaskWorker] Stopping worker ${this.workerId}`);

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    while (this.activeTasks.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async poll(): Promise<void> {
    while (this.activeTasks.size < this.config.concurrency && this.running) {
      const task = await this.queue.claimTask(this.workerId);
      if (!task) break;

      this.activeTasks.add(task.id);
      this.processTask(task).finally(() => {
        this.activeTasks.delete(task.id);
      });
    }
  }

  private async processTask(task: Task): Promise<void> {
    console.log(`[TaskWorker] Processing task ${task.id} (type: ${task.type})`);

    try {
      if (this.config.processor) {
        const result = await this.config.processor(task);
        await this.queue.completeTask(task.id, result ?? undefined);
        console.log(`[TaskWorker] Task ${task.id} completed`);
      } else {
        await this.queue.completeTask(task.id);
        console.log(`[TaskWorker] Task ${task.id} completed (no processor)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[TaskWorker] Task ${task.id} failed:`, errorMessage);
      await this.queue.failTask(task.id, errorMessage);
    }
  }

  getStatus(): {
    workerId: string;
    running: boolean;
    activeTasks: number;
    concurrency: number;
  } {
    return {
      workerId: this.workerId,
      running: this.running,
      activeTasks: this.activeTasks.size,
      concurrency: this.config.concurrency,
    };
  }
}

export function startWorker(
  queue: TaskQueue,
  processor: TaskProcessor,
  options?: Partial<WorkerConfig>
): TaskWorker {
  const worker = new TaskWorker(queue, {
    concurrency: options?.concurrency ?? 1,
    pollIntervalMs: options?.pollIntervalMs ?? 5000,
    processor,
  });

  worker.start();
  return worker;
}
