# webmcp-angular-demo

A small Angular 22 (next) application that demonstrates every WebMCP integration scope the Angular framework currently exposes: a global tool registered at the application root, route-scoped tools registered through `Route.providers`, service-scoped tools registered from inside a service constructor, and a form-scoped tool produced by the new Signal Forms `form()` API. The demo intentionally has no in-app inspector or manual invoker — Chrome's WebMCP devtools extension already provides both surfaces against `navigator.modelContext`.

## Prerequisites

- Node `>=22`. The workspace is pinned to `22.22.3` via [nvm](https://github.com/nvm-sh/nvm); run `nvm use 22.22.3` (or `nvm install 22.22.3` first time) before any npm command.
- Angular CLI v22 next. Installed locally as a devDependency, no global install required — every command below uses `npm`/`npx`.

## Setup

```bash
npm install
```

## Development server

```bash
npm start
```

Runs `ng serve` and opens the app at `http://localhost:4200/`.

## Tests

```bash
npm test
```

Runs `ng test`, which uses [Vitest](https://vitest.dev/) under the `@angular/build:unit-test` builder. The suite includes unit tests, end-to-end integration tests, and property-based tests (via `fast-check`) covering the six correctness properties from the design document.

## Lint and format

```bash
npm run lint           # ESLint with angular-eslint, max-warnings 0
npm run lint:fix       # auto-fix what's safe
npm run format         # Prettier write
npm run format:check   # Prettier verify
```

## Demo tour

Each route registers tools at a different scope. Open Chrome's WebMCP devtools extension and watch `navigator.modelContext` change as you navigate.

| Route        | Tool(s)                       | Scope                                                  |
| ------------ | ----------------------------- | ------------------------------------------------------ |
| `/`          | (none)                        | overview page                                          |
| `/products`  | `filterProducts`              | route-scoped (`Route.providers`)                       |
| `/dashboard` | `exportReport`                | route-scoped (`Route.providers`)                       |
| `/cart`      | `getCartSummary`, `addToCart` | service-scoped (`CartService` constructor)             |
| `/contact`   | `submitContactForm`           | form-scoped (`form()` `experimentalWebMcpTool` option) |

The `searchProducts` tool is registered globally in `app.config.ts` and is therefore available on every route.

`CartService` is `providedIn: 'root'` and is materialized eagerly via `provideAppInitializer` in `app.config.ts`, so its two service-scoped tools are also alive on every route — destruction-driven unregistration is exercised in the property tests by creating short-lived child injectors that own their own `CartService` instances.

## Inspecting and invoking tools

Install Chrome's WebMCP devtools extension and open it on any route. The extension reads `navigator.modelContext` directly, so you can:

- Watch the tool list change as you navigate between routes.
- Inspect each tool's input schema and description.
- Invoke tools by hand with arbitrary arguments.

The demo does not duplicate this UI inside the application.

## Polyfill caveat

`@mcp-b/webmcp-polyfill` is imported as the very first statement in `src/main.ts`, before `bootstrapApplication`. This guarantees `navigator.modelContext` exists before any provider runs in browsers that do not yet ship a native WebMCP runtime. If a browser later ships a native implementation, the polyfill detects it and no-ops, so the import remains safe.

## Project layout

```
src/
├── main.ts                                  # imports polyfill, then bootstraps
└── app/
    ├── app.config.ts                        # ApplicationConfig: router, global tool, forms
    ├── app.routes.ts                        # Route table with route-level tool providers
    ├── app.ts                               # Root shell with <router-outlet />
    ├── core/
    │   ├── webmcp/                          # tool descriptor types, validate, structured-response, global-tools
    │   └── catalog/                         # Product types and ProductService
    ├── cart/                                # CartService and cart-line types
    └── pages/
        ├── home/, products/, dashboard/, cart/, contact/
```
