import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TaskQueue } from "../queue";
import { TaskPriority, TaskStatus } from "../types";
import { createTestQueue, createMockPayload } from "./test-utils";

describe("TaskQueue", () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = createTestQueue();
  });

  afterEach(() => {
    queue.close();
  });

  describe("createTask", () => {
    it("creates task with type and payload, returns unique ID with PENDING status", async () => {
      const id1 = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
      });

      const id2 = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
      });

      expect(id1).toMatch(/^task-\d+-[a-f0-9]{8}$/);
      expect(id2).toMatch(/^task-\d+-[a-f0-9]{8}$/);
      expect(id1).not.toBe(id2);

      const task = await queue.getTask(id1);
      expect(task).not.toBeNull();
      expect(task!.status).toBe(TaskStatus.PENDING);
      expect(task!.type).toBe("test-task");
    });

    it("creates task with HIGH priority (value 10)", async () => {
      const id = await queue.createTask({
        type: "high-priority-task",
        payload: createMockPayload(),
        priority: TaskPriority.HIGH,
      });

      const task = await queue.getTask(id);
      expect(task!.priority).toBe(10);
    });

    it("creates task with MEDIUM priority (value 5)", async () => {
      const id = await queue.createTask({
        type: "medium-priority-task",
        payload: createMockPayload(),
        priority: TaskPriority.MEDIUM,
      });

      const task = await queue.getTask(id);
      expect(task!.priority).toBe(5);
    });

    it("creates task with LOW priority (value 0)", async () => {
      const id = await queue.createTask({
        type: "low-priority-task",
        payload: createMockPayload(),
        priority: TaskPriority.LOW,
      });

      const task = await queue.getTask(id);
      expect(task!.priority).toBe(0);
    });

    it("creates task with scheduled time in future - not claimable until then", async () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000);
      
      await queue.createTask({
        type: "scheduled-task",
        payload: createMockPayload(),
        scheduledAt: futureTime,
      });

      const claimed = await queue.claimTask("worker-1");
      expect(claimed).toBeNull();
    });

    it("creates task with scheduled time in past - immediately claimable", async () => {
      const pastTime = new Date(Date.now() - 1000 * 60 * 1000);
      
      const id = await queue.createTask({
        type: "past-scheduled-task",
        payload: createMockPayload(),
        scheduledAt: pastTime,
      });

      const claimed = await queue.claimTask("worker-1");
      expect(claimed).not.toBeNull();
      expect(claimed!.id).toBe(id);
    });
  });

  describe("completeTask", () => {
    it("completes a RUNNING task and sets completed_at", async () => {
      const id = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
      });

      await queue.claimTask("worker-1");
      await queue.completeTask(id, { result: "success" });

      const task = await queue.getTask(id);
      expect(task!.status).toBe(TaskStatus.COMPLETED);
      expect(task!.completed_at).not.toBeNull();
      expect(task!.result).toEqual({ result: "success" });
    });

    it("throws error when completing non-RUNNING task", async () => {
      const id = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
      });

      await expect(queue.completeTask(id, {})).rejects.toThrow(
        "not found or not in RUNNING state"
      );
    });
  });

  describe("failTask", () => {
    it("resets to PENDING and increments retry_count when under limit", async () => {
      const id = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
        maxRetries: 3,
      });

      await queue.claimTask("worker-1");
      await queue.failTask(id, "Something went wrong");

      const task = await queue.getTask(id);
      expect(task!.status).toBe(TaskStatus.PENDING);
      expect(task!.retry_count).toBe(1);
      expect(task!.error).toBe("Something went wrong");
      expect(task!.claimed_at).toBeNull();
      expect(task!.claimed_by).toBeNull();
    });

    it("marks as DEAD when retry_count reaches max_retries", async () => {
      const id = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
        maxRetries: 2,
      });

      await queue.claimTask("worker-1");
      await queue.failTask(id, "First failure");

      await queue.claimTask("worker-1");
      await queue.failTask(id, "Second failure");

      await queue.claimTask("worker-1");
      await queue.failTask(id, "Third failure");

      const task = await queue.getTask(id);
      expect(task!.status).toBe(TaskStatus.DEAD);
      expect(task!.retry_count).toBe(2);
    });
  });

  describe("getTask", () => {
    it("returns full task with parsed payload", async () => {
      const payload = { foo: "bar", nested: { value: 123 } };
      const id = await queue.createTask({
        type: "test-task",
        payload,
      });

      const task = await queue.getTask(id);
      expect(task).not.toBeNull();
      expect(task!.id).toBe(id);
      expect(task!.type).toBe("test-task");
      expect(task!.payload).toEqual(payload);
    });

    it("returns null for non-existent task", async () => {
      const task = await queue.getTask("non-existent-id");
      expect(task).toBeNull();
    });
  });

  describe("listTasks", () => {
    beforeEach(async () => {
      await queue.createTask({ type: "type-a", payload: createMockPayload(), priority: TaskPriority.HIGH });
      await queue.createTask({ type: "type-b", payload: createMockPayload(), priority: TaskPriority.LOW });
      await queue.createTask({ type: "type-a", payload: createMockPayload(), priority: TaskPriority.MEDIUM });
    });

    it("lists all tasks when no filter", async () => {
      const tasks = await queue.listTasks({});
      expect(tasks).toHaveLength(3);
    });

    it("filters by status", async () => {
      await queue.claimTask("worker-1");

      const pendingTasks = await queue.listTasks({ status: TaskStatus.PENDING });
      expect(pendingTasks).toHaveLength(2);

      const runningTasks = await queue.listTasks({ status: TaskStatus.RUNNING });
      expect(runningTasks).toHaveLength(1);
    });

    it("filters by type", async () => {
      const typeATasks = await queue.listTasks({ type: "type-a" });
      expect(typeATasks).toHaveLength(2);
      expect(typeATasks.every((t) => t.type === "type-a")).toBe(true);

      const typeBTasks = await queue.listTasks({ type: "type-b" });
      expect(typeBTasks).toHaveLength(1);
    });

    it("respects limit", async () => {
      const tasks = await queue.listTasks({ limit: 2 });
      expect(tasks).toHaveLength(2);
    });
  });

  describe("getTaskCounts", () => {
    it("returns counts by status", async () => {
      await queue.createTask({ type: "task-1", payload: createMockPayload() });
      await queue.createTask({ type: "task-2", payload: createMockPayload() });
      await queue.createTask({ type: "task-3", payload: createMockPayload() });

      await queue.claimTask("worker-1");
      await queue.claimTask("worker-2");

      const counts = await queue.getTaskCounts();
      expect(counts[TaskStatus.PENDING]).toBe(1);
      expect(counts[TaskStatus.RUNNING]).toBe(2);
    });
  });

  describe("claimTask - atomic operations", () => {
    it("claims task successfully and sets worker info", async () => {
      await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
      });

      const task = await queue.claimTask("worker-1");

      expect(task).not.toBeNull();
      expect(task!.status).toBe(TaskStatus.RUNNING);
      expect(task!.claimed_by).toBe("worker-1");
      expect(task!.claimed_at).not.toBeNull();
      expect(task!.started_at).not.toBeNull();
    });

    it("returns null when no PENDING tasks", async () => {
      const task = await queue.claimTask("worker-1");
      expect(task).toBeNull();
    });

    it("concurrent claims - only one worker succeeds (CAS verification)", async () => {
      await queue.createTask({
        type: "single-task",
        payload: createMockPayload(),
      });

      const results = await Promise.all([
        queue.claimTask("worker-1"),
        queue.claimTask("worker-2"),
        queue.claimTask("worker-3"),
      ]);

      const claimed = results.filter((r) => r !== null);
      expect(claimed).toHaveLength(1);
      expect(claimed[0]!.claimed_by).toBeOneOf(["worker-1", "worker-2", "worker-3"]);
    });

    it("claims highest priority task first", async () => {
      const lowId = await queue.createTask({
        type: "low-task",
        payload: createMockPayload(),
        priority: TaskPriority.LOW,
      });
      const highId = await queue.createTask({
        type: "high-task",
        payload: createMockPayload(),
        priority: TaskPriority.HIGH,
      });
      const mediumId = await queue.createTask({
        type: "medium-task",
        payload: createMockPayload(),
        priority: TaskPriority.MEDIUM,
      });

      const firstClaimed = await queue.claimTask("worker-1");
      expect(firstClaimed!.id).toBe(highId);

      const secondClaimed = await queue.claimTask("worker-1");
      expect(secondClaimed!.id).toBe(mediumId);

      const thirdClaimed = await queue.claimTask("worker-1");
      expect(thirdClaimed!.id).toBe(lowId);
    });

    it("claims oldest task first for equal priority (FIFO)", async () => {
      const firstId = await queue.createTask({
        type: "task-1",
        payload: createMockPayload(),
        priority: TaskPriority.MEDIUM,
      });
      
      await new Promise((r) => setTimeout(r, 10));
      
      const secondId = await queue.createTask({
        type: "task-2",
        payload: createMockPayload(),
        priority: TaskPriority.MEDIUM,
      });
      
      await new Promise((r) => setTimeout(r, 10));
      
      const thirdId = await queue.createTask({
        type: "task-3",
        payload: createMockPayload(),
        priority: TaskPriority.MEDIUM,
      });

      const firstClaimed = await queue.claimTask("worker-1");
      expect(firstClaimed!.id).toBe(firstId);

      const secondClaimed = await queue.claimTask("worker-1");
      expect(secondClaimed!.id).toBe(secondId);

      const thirdClaimed = await queue.claimTask("worker-1");
      expect(thirdClaimed!.id).toBe(thirdId);
    });
  });

  describe("reclaimTimeoutTasks", () => {
    it("reclaims timed-out RUNNING task back to PENDING", async () => {
      const id = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
        timeoutSeconds: 1,
      });

      await queue.claimTask("worker-1");

      await new Promise((r) => setTimeout(r, 5100));

      const reclaimed = await queue.reclaimTimeoutTasks();
      expect(reclaimed).toBe(1);

      const task = await queue.getTask(id);
      expect(task!.status).toBe(TaskStatus.PENDING);
      expect(task!.retry_count).toBe(1);
      expect(task!.claimed_at).toBeNull();
      expect(task!.claimed_by).toBeNull();
    }, 10000);

    it("does not reclaim fresh RUNNING tasks within timeout", async () => {
      await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
        timeoutSeconds: 300,
      });

      await queue.claimTask("worker-1");

      const reclaimed = await queue.reclaimTimeoutTasks();
      expect(reclaimed).toBe(0);

      const counts = await queue.getTaskCounts();
      expect(counts[TaskStatus.RUNNING]).toBe(1);
    });

    it("does not reclaim when retry_count >= max_retries", async () => {
      const id = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
        timeoutSeconds: 1,
        maxRetries: 1,
      });

      await queue.claimTask("worker-1");
      await queue.failTask(id, "First failure");

      await queue.claimTask("worker-1");

      await new Promise((r) => setTimeout(r, 1100));

      const reclaimed = await queue.reclaimTimeoutTasks();
      expect(reclaimed).toBe(0);

      const task = await queue.getTask(id);
      expect(task!.status).toBe(TaskStatus.RUNNING);
    });
  });
});
