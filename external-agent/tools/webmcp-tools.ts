import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { webMcpSession } from '../core/webmcp-session.js';
import { normalizeSiteUrl, resolveSiteUrl } from '../utils/site-url.js';

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

function resolvePageUrl(url?: string): string {
  if (url?.trim()) {
    return normalizeSiteUrl(url);
  }

  const current = webMcpSession.getCurrentUrl();
  if (current) {
    return current;
  }

  return resolveSiteUrl();
}

async function openPage(url: string): Promise<string> {
  await webMcpSession.ensureOpen(url);
  return url;
}

const optionalUrlSchema = z
  .string()
  .optional()
  .describe(
    'Full page URL with WebMCP. Omit to use the open page or WEBMCP_URL env.',
  );

export const listWebMcpToolsTool = new FunctionTool({
  name: 'list_webmcp_tools',
  description:
    'Open a WebMCP-enabled page and list its tools with name, description, and inputSchema. Pass url when switching sites or paths.',
  parameters: z.object({
    url: optionalUrlSchema,
  }),
  execute: async ({ url }) => {
    const targetUrl = await openPage(resolvePageUrl(url));

    return {
      url: targetUrl,
      count: webMcpSession.listTools().length,
      tools: webMcpSession.listTools(),
    };
  },
});

export const invokeWebMcpToolTool = new FunctionTool({
  name: 'invoke_webmcp_tool',
  description:
    'Invoke a WebMCP tool by name. Use list_webmcp_tools first for tool_name and inputSchema.',
  parameters: z.object({
    tool_name: z.string().describe('Exact tool name from list_webmcp_tools'),
    arguments: z
      .record(z.string(), z.unknown())
      .describe('Arguments matching inputSchema'),
    url: optionalUrlSchema,
  }),
  execute: async ({ tool_name, arguments: args, url }) => {
    const targetUrl = await openPage(resolvePageUrl(url));
    const parsedArgs = parseToolArguments(args);
    const result = await webMcpSession.invokeTool(tool_name, parsedArgs);

    return {
      url: targetUrl,
      ...result,
    };
  },
});

export const closeBrowserTool = new FunctionTool({
  name: 'close_browser',
  description: 'Close the browser session when finished.',
  parameters: z.object({}),
  execute: async () => {
    await webMcpSession.close();
    return { status: 'closed' };
  },
});

export const webMcpTools = [
  listWebMcpToolsTool,
  invokeWebMcpToolTool,
  closeBrowserTool,
] as const;
