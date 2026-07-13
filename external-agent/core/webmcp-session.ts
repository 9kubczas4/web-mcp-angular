import puppeteer, { type Browser, type Page } from 'puppeteer';

import { normalizeToolArguments } from '../utils/coerce-tool-arguments.js';
import type { JsonSchemaObject, WebMcpToolDescriptor } from '../types/webmcp.js';

interface WebMcpToolHandle {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: JsonSchemaObject;
  execute(args: Record<string, unknown>): Promise<unknown>;
}

type WebMcpEnabledPage = Page & {
  readonly webmcp: {
    tools(): WebMcpToolHandle[];
  };
};

const WEBMCP_LAUNCH_OPTIONS = {
  channel: 'chrome-canary' as const,
  args: ['--enable-features=WebMCP'],
};

/**
 * Manages a single Puppeteer browser tab with WebMCP enabled. Shared by ADK
 * tools so listing and invoking page tools operate on the same session.
 */
export class WebMcpSession {
  private browser: Browser | null = null;
  private page: WebMcpEnabledPage | null = null;
  private currentUrl: string | null = null;

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  isOpen(): boolean {
    return this.page !== null;
  }

  async ensureOpen(url: string): Promise<void> {
    if (this.page && this.currentUrl === url) {
      return;
    }

    if (this.page) {
      await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
      this.currentUrl = url;
      return;
    }

    await this.open(url);
  }

  async open(url: string): Promise<{ url: string }> {
    await this.close();

    this.browser = await puppeteer.launch(WEBMCP_LAUNCH_OPTIONS);
    this.page = (await this.browser.newPage()) as WebMcpEnabledPage;
    await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
    this.currentUrl = url;

    return { url };
  }

  listTools(): WebMcpToolDescriptor[] {
    this.assertPageOpen();

    return this.page!.webmcp.tools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema ?? null,
    }));
  }

  async invokeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ tool: string; result: unknown }> {
    this.assertPageOpen();

    const tools = this.page!.webmcp.tools();
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) {
      const available = tools.map((candidate) => candidate.name).join(', ');
      throw new Error(
        `Tool "${name}" not found on the current page. Available: ${available || '(none)'}`,
      );
    }

    const normalizedArgs = normalizeToolArguments(
      args,
      tool.inputSchema ?? null,
    );
    const result = await tool.execute(normalizedArgs);
    return { tool: name, result };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }

    this.browser = null;
    this.page = null;
    this.currentUrl = null;
  }

  private assertPageOpen(): void {
    if (!this.page) {
      throw new Error('No page is open. Call list_webmcp_tools first.');
    }
  }
}

export const webMcpSession = new WebMcpSession();

process.once('SIGINT', () => {
  void webMcpSession.close();
});

process.once('SIGTERM', () => {
  void webMcpSession.close();
});
