import Database from "better-sqlite3";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import {
  Task,
  TaskRecord,
  TaskStatus,
  TaskPriority,
  CreateTaskOptions,
  ListTasksOptions,
  TaskQueueConfig,
  TaskStatusResponse,
} from "./types";

type InternalConfig = {
  dbPath: string;
  maxRetries: number;
  timeoutSeconds: number;
  concurrency: number;
  pollIntervalMs: number;
};

export class TaskQueue {
  private db: Database.Database;
  private config: InternalConfig;

  constructor(config: TaskQueueConfig) {
    this.config = {
      dbPath: config.dbPath ?? path.join(os.homedir(), ".openclaw/task-queue.db"),
      maxRetries: config.maxRetries ?? 3,
      timeoutSeconds: config.timeoutSeconds ?? 300,
      concurrency: config.concurrency ?? 1,
      pollIntervalMs: config.pollIntervalMs ?? 5000,
    };

    if (this.config.dbPath !== ":memory:") {
      const dbDir = path.dirname(this.config.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    }

    this.db = new Database(this.config.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        
        status TEXT DEFAULT 'PENDING',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        
        claimed_at DATETIME,
        claimed_by TEXT,
        timeout_seconds INTEGER DEFAULT 300,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        scheduled_at DATETIME,
        
        result TEXT,
        error TEXT,
        
        depends_on TEXT,
        order_index INTEGER DEFAULT 0,
        archived_at DATETIME,
        
        source_channel TEXT,
        source_conversation TEXT,
        source_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_claimable 
      ON tasks(status, priority DESC, created_at ASC)
      WHERE status IN ('PENDING', 'RUNNING');

      CREATE INDEX IF NOT EXISTS idx_tasks_scheduled 
      ON tasks(scheduled_at, status)
      WHERE status = 'PENDING' AND scheduled_at IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_tasks_status 
      ON tasks(status, created_at DESC);
    `);
  }

  async createTask(options: CreateTaskOptions): Promise<string> {
    const id = `task-${Date.now()}-${uuidv4().slice(0, 8)}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, type, payload, priority, max_retries, timeout_seconds,
        scheduled_at, depends_on, order_index,
        source_channel, source_conversation, source_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      options.type,
      JSON.stringify(options.payload),
      options.priority ?? TaskPriority.MEDIUM,
      options.maxRetries ?? this.config.maxRetries,
      options.timeoutSeconds ?? this.config.timeoutSeconds,
      options.scheduledAt?.toISOString() ?? null,
      options.dependsOn ? JSON.stringify(options.dependsOn) : null,
      options.orderIndex ?? 0,
      options.source?.channel ?? null,
      options.source?.conversation ?? null,
      options.source?.message ?? null
    );

    return id;
  }

  async claimTask(workerId: string): Promise<Task | null> {
    // First, find a task whose dependencies are met
    const pendingTasks = this.db.prepare(`
      SELECT id, depends_on FROM tasks
      WHERE status = 'PENDING'
        AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
      ORDER BY priority DESC, order_index ASC, created_at ASC
    `).all() as Array<{ id: string; depends_on: string | null }>;

    for (const task of pendingTasks) {
      if (task.depends_on) {
        const deps = JSON.parse(task.depends_on) as string[];
        let allDone = true;
        for (const depId of deps) {
          const depTask = this.db.prepare(`SELECT status FROM tasks WHERE id = ?`).get(depId) as { status: string } | undefined;
          if (!depTask || depTask.status !== 'COMPLETED') {
            allDone = false;
            break;
          }
        }
        if (!allDone) continue;
      }

      // Try to atomically claim this task
      const claimStmt = this.db.prepare(`
        UPDATE tasks
        SET status = 'RUNNING',
            claimed_at = CURRENT_TIMESTAMP,
            claimed_by = ?,
            started_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'PENDING'
          AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
        RETURNING *
      `);

      const result = claimStmt.get(workerId, task.id) as TaskRecord | undefined;
      if (result) {
        return this.parseTask(result);
      }
    }

    return null;
  }

  async completeTask(taskId: string, result?: Record<string, unknown>): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'COMPLETED',
          completed_at = CURRENT_TIMESTAMP,
          result = ?
      WHERE id = ? AND status = 'RUNNING'
    `);

    const changes = stmt.run(JSON.stringify(result ?? {}), taskId);

    if (changes.changes === 0) {
      throw new Error(`Task ${taskId} not found or not in RUNNING state`);
    }
  }

  async failTask(taskId: string, error: string, retryable: boolean = true): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (!retryable) {
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET status = 'FAILED',
            error = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(error, taskId);
    } else if (task.retry_count >= task.max_retries) {
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET status = 'DEAD',
            error = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(error, taskId);
    } else {
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET status = 'PENDING',
            retry_count = retry_count + 1,
            claimed_at = NULL,
            claimed_by = NULL,
            started_at = NULL,
            error = ?
        WHERE id = ?
      `);
      stmt.run(error, taskId);
    }
  }

  async reclaimTimeoutTasks(): Promise<number> {
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'PENDING',
          claimed_at = NULL,
          claimed_by = NULL,
          started_at = NULL,
          retry_count = retry_count + 1
      WHERE status = 'RUNNING'
        AND started_at < datetime('now', '-' || timeout_seconds || ' seconds')
        AND retry_count < max_retries
    `);

    const result = stmt.run();
    return result.changes;
  }

  async getTask(taskId: string): Promise<Task | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE id = ?
    `);

    const result = stmt.get(taskId) as TaskRecord | undefined;
    return result ? this.parseTask(result) : null;
  }

  async getTaskStatus(taskId: string): Promise<TaskStatusResponse | null> {
    const stmt = this.db.prepare(`
      SELECT id, status, retry_count as retryCount, created_at as createdAt, started_at as startedAt, completed_at as completedAt, error
      FROM tasks
      WHERE id = ?
    `);

    const result = stmt.get(taskId) as TaskStatusResponse | undefined;
    return result ?? null;
  }

  async listTasks(options: ListTasksOptions = {}): Promise<Task[]> {
    let sql = "SELECT * FROM tasks WHERE 1=1";
    const params: unknown[] = [];

    if (options.status) {
      sql += " AND status = ?";
      params.push(options.status);
    }

    if (options.type) {
      sql += " AND type = ?";
      params.push(options.type);
    }

    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(options.limit ?? 100);

    if (options.offset) {
      sql += " OFFSET ?";
      params.push(options.offset);
    }

    const stmt = this.db.prepare(sql);
    const results = stmt.all(...params) as TaskRecord[];

    return results.map((r) => this.parseTask(r));
  }

  async getTaskCounts(): Promise<Record<string, number>> {
    const stmt = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM tasks
      GROUP BY status
    `);

    const results = stmt.all() as Array<{ status: string; count: number }>;
    const counts: Record<string, number> = {};

    for (const { status, count } of results) {
      counts[status] = count;
    }

    return counts;
  }

  async checkDependenciesMet(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) {
      return true;
    }

    for (const depId of task.dependsOn) {
      const depTask = await this.getTask(depId);
      if (!depTask || depTask.status !== TaskStatus.COMPLETED) {
        return false;
      }
    }
    return true;
  }

  async getPendingDependencies(taskId: string): Promise<string[]> {
    const task = await this.getTask(taskId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) {
      return [];
    }

    const pending: string[] = [];
    for (const depId of task.dependsOn) {
      const depTask = await this.getTask(depId);
      if (!depTask || depTask.status !== TaskStatus.COMPLETED) {
        pending.push(depId);
      }
    }
    return pending;
  }

  async archiveTask(taskId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET archived_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(taskId);
  }

  async listArchivedTasks(olderThanDays: number = 7): Promise<Task[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE archived_at IS NOT NULL
        AND archived_at < datetime('now', '-' || ? || ' days')
      ORDER BY archived_at ASC
    `);
    const results = stmt.all(olderThanDays) as TaskRecord[];
    return results.map((r) => this.parseTask(r));
  }

  async cleanupOldTasks(olderThanDays: number = 30): Promise<number> {
    const stmt = this.db.prepare(`
      DELETE FROM tasks
      WHERE status IN ('COMPLETED', 'DEAD')
        AND completed_at < datetime('now', '-' || ? || ' days')
    `);

    const result = stmt.run(olderThanDays);
    return result.changes;
  }

  async purgeTasks(taskIds: string[]): Promise<number> {
    if (!taskIds.length) return 0;
    
    const placeholders = taskIds.map(() => "?").join(",");
    const stmt = this.db.prepare(`
      DELETE FROM tasks WHERE id IN (${placeholders})
    `);

    const result = stmt.run(...taskIds);
    return result.changes;
  }

  async findStuckTasks(): Promise<Array<{ id: string; status: string; error: string | null; created_at: string }>> {
    const stmt = this.db.prepare(`
      SELECT id, status, error, created_at FROM tasks
      WHERE status = 'PENDING' AND error IS NOT NULL
        AND (error LIKE '%Cancelled%' OR error LIKE '%timeout%')
      ORDER BY created_at ASC
    `);
    return stmt.all() as Array<{ id: string; status: string; error: string | null; created_at: string }>;
  }

  async repairCancelledTasks(): Promise<number> {
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'FAILED'
      WHERE status = 'PENDING' AND error LIKE '%Cancelled%'
    `);
    const result = stmt.run();
    return result.changes;
  }

  close(): void {
    this.db.close();
  }

  private parseTask(record: TaskRecord): Task {
    return {
      ...record,
      payload: JSON.parse(record.payload),
      result: record.result ? JSON.parse(record.result) : undefined,
      dependsOn: record.depends_on ? JSON.parse(record.depends_on) : undefined,
    } as Task;
  }
}
