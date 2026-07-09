import puppeteer from 'puppeteer';

import { DEMO_ORIGIN } from './demo-site.js';

const browser = await puppeteer.launch({
  channel: 'chrome-canary',
  args: ['--enable-features=WebMCP'],
});

const page = await browser.newPage();
await page.goto(DEMO_ORIGIN);

const tools = page.webmcp.tools();

for (const tool of tools) {
  console.log(tool.name, tool.description, tool.inputSchema);
}

const tool = tools.find(t => t.name === 'searchProducts');

const result = await tool?.execute({
  query: 'headphones',
});

console.log(result);
