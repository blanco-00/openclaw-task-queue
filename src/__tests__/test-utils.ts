import { TaskQueue } from "../queue";
import { TaskQueueConfig } from "../types";

export function createTestQueue(overrides: Partial<TaskQueueConfig> = {}): TaskQueue {
  return new TaskQueue({
    dbPath: ":memory:",
    maxRetries: 3,
    timeoutSeconds: 300,
    ...overrides,
  });
}

export function createFileTestQueue(overrides: Partial<TaskQueueConfig> = {}): { queue: TaskQueue; cleanup: () => void } {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "task-queue-test-"));
  const dbPath = path.join(tempDir, "test.db");
  
  const queue = new TaskQueue({
    dbPath,
    maxRetries: 3,
    timeoutSeconds: 300,
    ...overrides,
  });
  
  return {
    queue,
    cleanup: () => {
      queue.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 50
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
}

export function createMockPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: "test",
    data: { value: 1 },
    ...overrides,
  };
}
