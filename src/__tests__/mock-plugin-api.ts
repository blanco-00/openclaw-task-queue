import { PluginApi } from "../types";

type ToolExecutor = (id: string, params: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

type MockService = {
  id: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export function createMockPluginApi(): PluginApi & {
  getRegisteredTools: () => Map<string, { executor: ToolExecutor; description: string }>;
  getRegisteredServices: () => MockService[];
} {
  const tools = new Map<string, { executor: ToolExecutor; description: string }>();
  const services: MockService[] = [];

  return {
    config: {
      plugins: {
        entries: {
          "task-queue": {
            enabled: true,
            config: {
              dbPath: ":memory:",
              concurrency: 1,
              pollIntervalMs: 5000,
              maxRetries: 3,
              timeoutSeconds: 300,
              enableWorker: false,
            },
          },
        },
      },
    },

    registerTool: (tool: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
      execute: ToolExecutor;
    }) => {
      tools.set(tool.name, { executor: tool.execute, description: tool.description });
    },

    registerService: (service: MockService) => {
      services.push(service);
    },

    getRegisteredTools: () => tools,
    getRegisteredServices: () => services,
  };
}

export async function callTool(
  mockApi: ReturnType<typeof createMockPluginApi>,
  toolName: string,
  params: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const tools = mockApi.getRegisteredTools();
  const tool = tools.get(toolName);
  
  if (!tool) {
    throw new Error(`Tool "${toolName}" not registered. Available: ${Array.from(tools.keys()).join(", ")}`);
  }
  
  return tool.executor("test-id", params);
}

export function parseToolResponse<T = unknown>(response: { content: Array<{ type: string; text: string }> }): T {
  const text = response.content[0]?.text;
  if (!text) {
    throw new Error("Empty response content");
  }
  return JSON.parse(text) as T;
}
