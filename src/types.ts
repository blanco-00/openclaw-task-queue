/**
 * Task status enumeration
 */
export enum TaskStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  DEAD = "DEAD",  // Exceeded max retries
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 0,
  MEDIUM = 5,
  HIGH = 10,
}

/**
 * Task record as stored in database
 */
export interface TaskRecord {
  id: string;
  type: string;
  payload: string; // JSON string
  priority: number;
  
  status: string;
  retry_count: number;
  max_retries: number;
  
  claimed_at: string | null;
  claimed_by: string | null;
  timeout_seconds: number;
  
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  scheduled_at: string | null;
  
  result: string | null; // JSON string
  error: string | null;
  
  // Decomposition fields
  depends_on: string | null;  // JSON array of task IDs
  order_index: number;
  archived_at: string | null;
  
  source_channel: string | null;
  source_conversation: string | null;
  source_message: string | null;
}

/**
 * Task with parsed payload
 */
export interface Task extends Omit<TaskRecord, 'payload' | 'result' | 'depends_on'> {
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  dependsOn?: string[];
}

/**
 * Options for creating a new task
 */
export interface CreateTaskOptions {
  type: string;
  payload: Record<string, unknown>;
  priority?: TaskPriority | number;
  maxRetries?: number;
  timeoutSeconds?: number;
  scheduledAt?: Date;
  dependsOn?: string[];
  orderIndex?: number;
  source?: {
    channel: string;
    conversation: string;
    message: string;
  };
}

/**
 * Options for listing tasks
 */
export interface ListTasksOptions {
  status?: TaskStatus | string;
  type?: string;
  limit?: number;
  offset?: number;
}

/**
 * Task queue configuration
 */
export interface TaskQueueConfig {
  dbPath: string;
  maxRetries?: number;
  timeoutSeconds?: number;
  concurrency?: number;
  pollIntervalMs?: number;
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  concurrency: number;
  pollIntervalMs: number;
  processor?: TaskProcessor;
}

/**
 * Task processor function
 */
export type TaskProcessor = (task: Task) => Promise<Record<string, unknown> | void>;

/**
 * Task status for API responses
 */
export interface TaskStatusResponse {
  id: string;
  status: TaskStatus;
  retryCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

/**
 * Plugin API types (optional dependency)
 */
export interface PluginApi {
  config: {
    plugins?: {
      entries?: Record<string, {
        enabled?: boolean;
        config?: Record<string, unknown>;
      }>;
    };
  };
  registerTool(tool: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (id: string, params: Record<string, unknown>) => Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;
  }): void;
  registerTool(tool: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (id: string, params: Record<string, unknown>) => Promise<{
      content: Array<{ type: string; text: string }>;
    }>;
  }, options?: { optional?: boolean }): void;
  registerService(service: {
    id: string;
    start: () => Promise<void>;
    stop: () => Promise<void>;
  }): void;
}
