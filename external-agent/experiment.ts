import puppeteer from 'puppeteer';

import { resolveSiteUrl } from './site-url.js';

const browser = await puppeteer.launch({
  channel: 'chrome-canary',
  args: ['--enable-features=WebMCP'],
});

const page = await browser.newPage();
const url = resolveSiteUrl();
await page.goto(url);

console.log(`Open: ${url}`);

const tools = page.webmcp.tools();

for (const tool of tools) {
  console.log(tool.name, tool.description, tool.inputSchema);
}

await browser.close();
