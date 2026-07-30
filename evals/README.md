# WebMCP Evals

Educational evaluations for this demo’s WebMCP tools using the official
[WebMCP Evals CLI](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/evals-cli)
(`webmcp-evals`). See also [Evals for WebMCP](https://developer.chrome.com/docs/ai/webmcp/evals).

## Why evals matter

WebMCP tools are used by LLMs. Classic unit tests cover tool logic; evals check
whether a model:

- picks the **correct tool** for a user prompt
- passes **correct arguments**
- **avoids** calling tools for unrelated questions
- fails when it picks the **wrong** tool (for example `addToCart` instead of `searchProducts`)

## Prerequisites

- Node `>=22`, `npm install`
- Gemini API key as `GEMINI_API_KEY` in `.env` (same key as the external agent; `webmcp-evals` reads it natively)

## Command

```bash
npm run evals
```

Runs in order:

1. Product search/filter suite (`local`)
2. Cart suite (`local`)
3. Negative suite (`local`, `expectedCall: null`)

Official CLI shape (also available via pass-through args on `evals/run.mjs`):

```bash
npx webmcp-evals local -b gemini \
  -t evals/schemas/products-route.tools.json \
  -e evals/suites/products.evals.json

npx webmcp-evals browser -b gemini \
  -u http://localhost:4200/products \
  -e evals/suites/products.evals.json
```

Reports are written under `.evals/` (gitignored). Optional analysis:

```bash
npx webmcp-evals analyze .evals/report-*.json --open
```
