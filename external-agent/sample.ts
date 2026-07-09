import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  channel: 'chrome-canary',
  args: ['--enable-features=WebMCP'],
});

const page = await browser.newPage();
await page.goto('https://webmcp-angular-demo.web.app/');

const tools = page.webmcp.tools();

for (const tool of tools) {
  console.log(tool.name, tool.description);
}

const tool = tools.find(t => t.name === 'searchProducts');

const result = await tool?.execute({
  query: 'headphones',
});

console.log(result);
