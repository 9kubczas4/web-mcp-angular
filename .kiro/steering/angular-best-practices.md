---
inclusion: always
---

# Angular Best Practices (Angular 22 next)

These rules come from the official Angular CLI MCP `get_best_practices` tool for the workspace's installed framework version (22-next). They MUST be followed for any Angular code in this repository.

## TypeScript

- Use strict type checking.
- Prefer type inference when the type is obvious.
- Avoid the `any` type. Use `unknown` when a type is genuinely uncertain, then narrow.

## Angular

- Always use standalone components over `NgModule`s.
- Do NOT set `standalone: true` inside Angular decorators. It is the default in Angular v20+.
- Use signals (`signal`, `computed`, `effect`) for state management.
- Implement lazy loading for feature routes (`loadComponent`).
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead.
- Use `NgOptimizedImage` for all static images. (`NgOptimizedImage` does not work for inline base64 images.)

## Components

- Keep components small and focused on a single responsibility.
- Use `input()` and `output()` functions instead of decorators.
- Use `computed()` for derived state.
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in every `@Component` decorator.
- Prefer inline templates for small components.
- Prefer Reactive forms over Template-driven ones.
- Do NOT use `ngClass`; use `class` bindings instead.
- Do NOT use `ngStyle`; use `style` bindings instead.
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state.
- Use `computed()` for derived state.
- Keep state transformations pure and predictable.
- Do NOT use `mutate` on signals; use `update` or `set` instead.

## Templates

- Keep templates simple. Avoid complex logic.
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`.
- Use the `async` pipe for observables.
- Do not assume globals like `new Date()` are available.

## Services

- Design services around a single responsibility.
- Use `providedIn: 'root'` for singleton services.
- Use the `inject()` function instead of constructor injection.

## Accessibility

- Code MUST pass all AXE checks.
- Code MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## When in doubt

Use the `angular-cli` MCP server's `search_documentation` tool to look up the version-aligned official answer before writing code, and `get_best_practices` to refresh this guide for the current installed version.
