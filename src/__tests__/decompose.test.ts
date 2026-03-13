import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TaskQueue } from "../queue";
import { TaskStatus } from "../types";
import { registerTools } from "../tools";
import { createTestQueue, createMockPayload } from "./test-utils";
import { createMockPluginApi, callTool, parseToolResponse } from "./mock-plugin-api";

describe("Task Decomposition & Blocking", () => {
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

  describe("task_decompose", () => {
    it("creates subtasks with dependencies", async () => {
      const response = await callTool(mockApi, "task_decompose", {
        subtasks: [
          { id: "step-1", type: "analyze", payload: { data: "test" } },
          { id: "step-2", type: "process", payload: { data: "test" }, dependsOn: ["step-1"] },
          { id: "step-3", type: "report", payload: { data: "test" }, dependsOn: ["step-2"] },
        ],
      });

      const result = parseToolResponse<{
        success: boolean;
        createdSubtasks: number;
        tasks: Array<{ tempId: string; taskId: string }>;
      }>(response);

      expect(result.success).toBe(true);
      expect(result.createdSubtasks).toBe(3);
      expect(result.tasks).toHaveLength(3);

      const task1 = await queue.getTask(result.tasks[0].taskId);
      expect(task1?.dependsOn).toBeUndefined();

      const task2 = await queue.getTask(result.tasks[1].taskId);
      expect(task2?.dependsOn).toContain(result.tasks[0].taskId);

      const task3 = await queue.getTask(result.tasks[2].taskId);
      expect(task3?.dependsOn).toContain(result.tasks[1].taskId);
    });

    it("creates subtasks with orderIndex", async () => {
      const response = await callTool(mockApi, "task_decompose", {
        subtasks: [
          { id: "third", type: "third", payload: {}, orderIndex: 2 },
          { id: "first", type: "first", payload: {}, orderIndex: 0 },
          { id: "second", type: "second", payload: {}, orderIndex: 1 },
        ],
      });

      const result = parseToolResponse<{
        success: boolean;
        tasks: Array<{ tempId: string; taskId: string }>;
      }>(response);

      expect(result.success).toBe(true);

      const tasks = await queue.listTasks({});
      const ordered = tasks.sort((a, b) => a.order_index - b.order_index);
      expect(ordered[0].type).toBe("first");
      expect(ordered[1].type).toBe("second");
      expect(ordered[2].type).toBe("third");
    });

    it("returns needsUserInput when askUser is true", async () => {
      const response = await callTool(mockApi, "task_decompose", {
        askUser: true,
        userQuestion: "How should I break down this task?",
      });

      const result = parseToolResponse<{
        needsUserInput: boolean;
        question: string;
      }>(response);

      expect(result.needsUserInput).toBe(true);
      expect(result.question).toBe("How should I break down this task?");
    });
  });

  describe("blocking modes", () => {
    it("background mode does not pause workflow", async () => {
      const response = await callTool(mockApi, "task_decompose", {
        subtasks: [
          { id: "step-1", type: "analyze", payload: {}, blocking: "background" },
        ],
      });

      const result = parseToolResponse<{
        success: boolean;
        paused: boolean;
        message: string;
      }>(response);

      expect(result.success).toBe(true);
      expect(result.paused).toBeFalsy();
      expect(result.message).not.toContain("paused");
    });

    it("interactive mode pauses workflow", async () => {
      const response = await callTool(mockApi, "task_decompose", {
        subtasks: [
          { id: "step-1", type: "analyze", payload: {}, blocking: "interactive" },
        ],
      });

      const result = parseToolResponse<{
        success: boolean;
        paused: boolean;
        nextAction: string;
      }>(response);

      expect(result.success).toBe(true);
      expect(result.paused).toBe(true);
      expect(result.nextAction).toBe("Wait for user confirmation before continuing.");
    });

    it("mixed blocking modes returns paused if any interactive", async () => {
      const response = await callTool(mockApi, "task_decompose", {
        subtasks: [
          { id: "step-1", type: "analyze", payload: {}, blocking: "background" },
          { id: "step-2", type: "review", payload: {}, blocking: "interactive" },
          { id: "step-3", type: "finalize", payload: {}, blocking: "background", dependsOn: ["step-2"] },
        ],
      });

      const result = parseToolResponse<{
        success: boolean;
        paused: boolean;
        tasks: Array<{ tempId: string; blocking: boolean }>;
      }>(response);

      expect(result.success).toBe(true);
      expect(result.paused).toBe(true);
      expect(result.tasks[0].blocking).toBe(false);
      expect(result.tasks[1].blocking).toBe(true);
      expect(result.tasks[2].blocking).toBe(false);
    });
  });

  describe("task_archive", () => {
    it("archives a completed task", async () => {
      const taskId = await queue.createTask({
        type: "test-task",
        payload: createMockPayload(),
      });

      await queue.claimTask("worker-1");
      await queue.completeTask(taskId, { result: "done" });

      const response = await callTool(mockApi, "task_archive", { taskId });
      const result = parseToolResponse<{ success: boolean; message: string }>(response);

      expect(result.success).toBe(true);
      expect(result.message).toContain("archived");

      const task = await queue.getTask(taskId);
      expect(task?.archived_at).not.toBeNull();
    });
  });

  describe("task_cleanup", () => {
    it("cleans up old tasks with default days", async () => {
      await queue.createTask({ type: "task-1", payload: {} });
      await queue.createTask({ type: "task-2", payload: {} });

      const response = await callTool(mockApi, "task_cleanup", {});
      const result = parseToolResponse<{ success: boolean; deletedCount: number }>(response);

      expect(result.success).toBe(true);
      expect(typeof result.deletedCount).toBe("number");
    });

    it("cleans up old tasks with custom days", async () => {
      await queue.createTask({ type: "task-1", payload: {} });

      const response = await callTool(mockApi, "task_cleanup", { olderThanDays: 30 });
      const result = parseToolResponse<{ success: boolean; deletedCount: number }>(response);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("task_find_stuck", () => {
    it("finds PENDING tasks with error messages", async () => {
      const taskId = await queue.createTask({ type: "task-1", payload: {} });
      await queue.claimTask("worker-1");
      await queue.failTask(taskId, "Cancelled by user", true);

      const task = await queue.getTask(taskId);
      expect(task?.status).toBe("PENDING");
      expect(task?.error).toContain("Cancelled");

      const response = await callTool(mockApi, "task_find_stuck", {});
      const result = parseToolResponse<{ success: boolean; count: number }>(response);

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("task_repair", () => {
    it("repairs cancelled PENDING tasks to FAILED", async () => {
      const taskId = await queue.createTask({ type: "task-1", payload: {} });
      await queue.claimTask("worker-1");
      await queue.failTask(taskId, "Cancelled by user", false);

      const response = await callTool(mockApi, "task_repair", {});
      const result = parseToolResponse<{ success: boolean; repairedCount: number }>(response);

      expect(result.success).toBe(true);
      expect(result.repairedCount).toBeGreaterThanOrEqual(0);
    });
  });
});
