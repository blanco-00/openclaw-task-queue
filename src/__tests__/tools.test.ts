import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TaskQueue } from "../queue";
import { TaskStatus } from "../types";
import { registerTools } from "../tools";
import { createTestQueue, createMockPayload } from "./test-utils";
import { createMockPluginApi, callTool, parseToolResponse } from "./mock-plugin-api";

describe("OpenClaw Tools", () => {
  let queue: TaskQueue;
  let mockApi: ReturnType<typeof createMockPluginApi>;

  beforeEach(() => {
    queue = createTestQueue();
    mockApi = createMockPluginApi();
    registerTools(mockApi, queue);
  });

  afterEach(() => {
    queue.close();
  });

  describe("task_create", () => {
    it("creates task and returns taskId", async () => {
      const response = await callTool(mockApi, "task_create", {
        type: "test-task",
        payload: { data: "test" },
      });

      const result = parseToolResponse<{ success: boolean; taskId: string }>(response);
      expect(result.success).toBe(true);
      expect(result.taskId).toMatch(/^task-\d+-[a-f0-9]{8}$/);

      const task = await queue.getTask(result.taskId);
      expect(task).not.toBeNull();
      expect(task!.type).toBe("test-task");
      expect(task!.payload).toEqual({ data: "test" });
    });

    it("creates task with priority", async () => {
      const response = await callTool(mockApi, "task_create", {
        type: "high-priority",
        payload: {},
        priority: "high",
      });

      const result = parseToolResponse<{ success: boolean; taskId: string }>(response);
      expect(result.success).toBe(true);

      const task = await queue.getTask(result.taskId);
      expect(task!.priority).toBe(10);
    });
  });

  describe("task_status", () => {
    it("returns task information for valid taskId", async () => {
      const taskId = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
      });

      const response = await callTool(mockApi, "task_status", { taskId });
      const result = parseToolResponse<{ success: boolean; id: string; status: string }>(response);

      expect(result.success).toBe(true);
      expect(result.id).toBe(taskId);
      expect(result.status).toBe(TaskStatus.PENDING);
    });

    it("returns error for non-existent taskId", async () => {
      const response = await callTool(mockApi, "task_status", {
        taskId: "non-existent-id",
      });

      const result = parseToolResponse<{ success: boolean; error: string }>(response);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("task_list", () => {
    it("lists tasks with status filter", async () => {
      await queue.createTask({ type: "task-1", payload: createMockPayload() });
      await queue.createTask({ type: "task-2", payload: createMockPayload() });
      await queue.claimTask("worker-1");

      const response = await callTool(mockApi, "task_list", { status: "PENDING" });
      const result = parseToolResponse<{ success: boolean; count: number }>(response);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe("task_cancel", () => {
    it("cancels PENDING task", async () => {
      const taskId = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
      });

      const response = await callTool(mockApi, "task_cancel", { taskId });
      const result = parseToolResponse<{ success: boolean; message: string }>(response);

      expect(result.success).toBe(true);
      expect(result.message).toContain("cancelled");

      const task = await queue.getTask(taskId);
      expect(task!.status).toBe(TaskStatus.FAILED);
      expect(task!.error).toContain("Cancelled");
    });

    it("returns error when cancelling RUNNING task", async () => {
      const taskId = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
      });

      await queue.claimTask("worker-1");

      const response = await callTool(mockApi, "task_cancel", { taskId });
      const result = parseToolResponse<{ success: boolean; error: string }>(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot cancel");
    });

    it("returns error for non-existent task", async () => {
      const response = await callTool(mockApi, "task_cancel", {
        taskId: "non-existent",
      });

      const result = parseToolResponse<{ success: boolean; error: string }>(response);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("task_stats", () => {
    it("returns counts by status", async () => {
      await queue.createTask({ type: "task-1", payload: {} });
      await queue.createTask({ type: "task-2", payload: {} });
      await queue.createTask({ type: "task-3", payload: {} });

      await queue.claimTask("worker-1");
      await queue.claimTask("worker-2");

      const response = await callTool(mockApi, "task_stats", {});
      const result = parseToolResponse<{ success: boolean; counts: Record<string, number> }>(response);

      expect(result.success).toBe(true);
      expect(result.counts[TaskStatus.PENDING]).toBe(1);
      expect(result.counts[TaskStatus.RUNNING]).toBe(2);
    });

    it("returns empty counts for empty queue", async () => {
      const response = await callTool(mockApi, "task_stats", {});
      const result = parseToolResponse<{ success: boolean; counts: Record<string, number> }>(response);

      expect(result.success).toBe(true);
      expect(Object.keys(result.counts)).toHaveLength(0);
    });
  });
});
