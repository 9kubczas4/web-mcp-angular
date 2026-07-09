import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import {
  DEMO_ORIGIN,
  DEMO_ROUTES,
  demoUrl,
  routeForTool,
  type DemoRoute,
} from './demo-site.js';
import { webMcpSession } from './webmcp-session.js';

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) {
    return {};
  }

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`arguments must be a JSON object, got string: ${raw}`);
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  throw new Error('arguments must be a JSON object');
}

async function openDemoRoute(route: DemoRoute): Promise<string> {
  const url = demoUrl(route);
  await webMcpSession.ensureOpen(url);
  return url;
}

export const listWebMcpToolsTool = new FunctionTool({
  name: 'list_webmcp_tools',
  description: `List WebMCP tools on ${DEMO_ORIGIN} with name, description, and inputSchema.`,
  parameters: z.object({
    route: z
      .enum(DEMO_ROUTES)
      .optional()
      .describe('Demo route: home, products, dashboard, cart, contact. Default home.'),
  }),
  execute: async ({ route = 'home' }) => {
    const url = await openDemoRoute(route);

    return {
      site: DEMO_ORIGIN,
      route,
      url,
      count: webMcpSession.listTools().length,
      tools: webMcpSession.listTools(),
    };
  },
});

export const invokeWebMcpToolTool = new FunctionTool({
  name: 'invoke_webmcp_tool',
  description: `Invoke a WebMCP tool on ${DEMO_ORIGIN}. Use list_webmcp_tools first for tool_name and inputSchema.`,
  parameters: z.object({
    tool_name: z.string().describe('Exact tool name from list_webmcp_tools'),
    arguments: z
      .record(z.string(), z.unknown())
      .describe('Arguments matching inputSchema (e.g. filterProducts: maxPrice, category)'),
  }),
  execute: async ({ tool_name, arguments: args }) => {
    const url = await openDemoRoute(routeForTool(tool_name));
    const parsedArgs = parseToolArguments(args);
    const result = await webMcpSession.invokeTool(tool_name, parsedArgs);

    return {
      site: DEMO_ORIGIN,
      url,
      ...result,
    };
  },
});

export const closeBrowserTool = new FunctionTool({
  name: 'close_browser',
  description: 'Close the demo browser session when finished.',
  parameters: z.object({}),
  execute: async () => {
    await webMcpSession.close();
    return { status: 'closed' };
  },
});

export const webMcpTools = [listWebMcpToolsTool, invokeWebMcpToolTool, closeBrowserTool] as const;
