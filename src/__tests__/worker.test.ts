import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TaskQueue } from "../queue";
import { TaskWorker } from "../worker";
import { TaskPriority } from "../types";
import { createTestQueue, createMockPayload, waitFor } from "./test-utils";

describe("TaskWorker", () => {
  let queue: TaskQueue;
  let worker: TaskWorker;

  beforeEach(() => {
    queue = createTestQueue();
  });

  afterEach(async () => {
    if (worker) {
      await worker.stop();
    }
    queue.close();
  });

  it("processes tasks with processor function", async () => {
    const processedTasks: string[] = [];
    
    await queue.createTask({
      type: "test-task",
      payload: createMockPayload(),
    });

    worker = new TaskWorker(queue, {
      concurrency: 1,
      pollIntervalMs: 100,
      processor: async (task) => {
        processedTasks.push(task.id);
        return { processed: true };
      },
    });

    await worker.start();

    await waitFor(() => processedTasks.length === 1, 2000);

    expect(processedTasks).toHaveLength(1);

    const task = await queue.getTask(processedTasks[0]);
    expect(task!.status).toBe("COMPLETED");
    expect(task!.result).toEqual({ processed: true });
  });

  it("respects concurrency limit", async () => {
    let activeCount = 0;
    let maxActive = 0;
    const processedTasks: string[] = [];

    await queue.createTask({ type: "task-1", payload: createMockPayload() });
    await queue.createTask({ type: "task-2", payload: createMockPayload() });
    await queue.createTask({ type: "task-3", payload: createMockPayload() });
    await queue.createTask({ type: "task-4", payload: createMockPayload() });
    await queue.createTask({ type: "task-5", payload: createMockPayload() });

    worker = new TaskWorker(queue, {
      concurrency: 2,
      pollIntervalMs: 50,
      processor: async (task) => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        
        await new Promise((r) => setTimeout(r, 100));
        
        processedTasks.push(task.id);
        activeCount--;
        return {};
      },
    });

    await worker.start();

    await waitFor(() => processedTasks.length === 5, 3000);

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(processedTasks).toHaveLength(5);
  });

  it("stop() waits for active tasks to complete", async () => {
    let taskCompleted = false;

    await queue.createTask({
      type: "slow-task",
      payload: createMockPayload(),
    });

    worker = new TaskWorker(queue, {
      concurrency: 1,
      pollIntervalMs: 50,
      processor: async () => {
        await new Promise((r) => setTimeout(r, 200));
        taskCompleted = true;
        return {};
      },
    });

    await worker.start();

    await new Promise((r) => setTimeout(r, 100));

    await worker.stop();

    expect(taskCompleted).toBe(true);
    expect(worker.getStatus().running).toBe(false);
  });

  it("getStatus returns correct worker state", async () => {
    worker = new TaskWorker(queue, {
      concurrency: 2,
      pollIntervalMs: 100,
      processor: async () => ({}),
    });

    const statusBeforeStart = worker.getStatus();
    expect(statusBeforeStart.running).toBe(false);
    expect(statusBeforeStart.activeTasks).toBe(0);
    expect(statusBeforeStart.concurrency).toBe(2);

    await worker.start();

    const statusAfterStart = worker.getStatus();
    expect(statusAfterStart.running).toBe(true);

    await worker.stop();

    const statusAfterStop = worker.getStatus();
    expect(statusAfterStop.running).toBe(false);
  });
});
