---
inclusion: always
---

# WebMCP Angular Demo — Stack and Conventions

This workspace builds a single Angular 22 (next) application demonstrating the experimental WebMCP integration. Spec: `.kiro/specs/webmcp-angular-demo/`.

## Required stack

- Angular 22 (next): `@angular/core@next`, `@angular/router@next`, `@angular/forms@next`, `@angular/common@next`, `@angular/platform-browser@next`, `@angular/compiler@next`, `@angular/compiler-cli@next`.
- `@mcp-b/webmcp-polyfill` — imported as the very first statement in `src/main.ts`, before any other imports and before `bootstrapApplication`.
- `fast-check` for property-based tests (the spec's correctness contract).
- Standalone components only — zero `NgModule` classes anywhere.
- `OnPush` change detection on every component.
- Signals for state; `@if` / `@for` / `@switch` for control flow.

## Node toolchain

- Node `>=22.22.3` is required by `@angular/cli@22.0.0-rc.1`.
- An nvm install of `22.22.3` lives at `$HOME/.nvm/versions/node/v22.22.3`. Prepend its `bin/` to `PATH` for any `npm`, `npx`, or `ng` command, or run `nvm use 22.22.3` first.

## WebMCP scopes

- **Global tool**: registered via `provideExperimentalWebMcpTools` in `appConfig.providers`.
- **Route-scoped tool**: registered via `provideExperimentalWebMcpTools` inside a `Route.providers` array. Lifetime is the route injector.
- **Service-scoped tool**: registered via `declareExperimentalWebMcpTool` inside a service constructor. Lifetime is the owning injector.
- **Form tool**: produced by `form()` from `@angular/forms/signals` with the `experimentalWebMcpTool: { name, description }` option.

The router MUST be configured with `withExperimentalAutoCleanupInjectors()` so route-scoped tools unregister automatically on deactivation.

## Tool handler contract

Every handler:

1. Validates input against an explicit JSON schema before any side effect.
2. Returns a `StructuredResponse` with `status: 'success' | 'error'` and a `payload` field.
3. Has a name in lowerCamelCase and a non-empty description.

Helpers `ok(payload)` and `err(code, message, details?)` live in `src/app/core/webmcp/structured-response.ts`.

## Folder layout

```
src/
├── main.ts                                  # imports polyfill, then bootstraps
└── app/
    ├── app.config.ts
    ├── app.routes.ts
    ├── app.ts                               # root shell (App component)
    ├── core/
    │   ├── webmcp/                          # tool-descriptor, structured-response, registry, validate, global-tools
    │   └── catalog/                         # product types and ProductService
    ├── cart/                                # CartService and cart-line types
    └── pages/
        ├── home/, products/, dashboard/, cart/, contact/
```

The demo intentionally has no in-app Tool Inspector or Manual Invoker — Chrome's WebMCP devtools extension already provides both surfaces against `navigator.modelContext`.

## Skills and references

- `.kiro/skills/angular-*` — official Angular skill packs (component, di, directives, forms, http, routing, signals, ssr, testing, tooling). Use them whenever the task touches the matching topic.
- `.kiro/skills/modern-web-guidance` — Chrome/web platform guidance from `GoogleChrome/modern-web-guidance`.
- The `angular-cli` MCP server is configured in `.kiro/settings/mcp.json`. Prefer its `search_documentation`, `get_best_practices`, and `list_projects` tools over guessing.
