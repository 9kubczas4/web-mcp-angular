# Design Document

## Overview

The WebMCP Angular Demo is a small but complete Angular 22 (next) standalone application whose purpose is to make every WebMCP integration point visible and exercisable from the browser. The application loads the `@mcp-b/webmcp-polyfill` before bootstrap so `navigator.modelContext` exists, then registers tools at four different scopes: a Global_Tool registered at the application root, Route_Scoped_Tools registered through route `providers` on `/products` and `/dashboard`, Service_Scoped_Tools registered from inside `CartService` via `declareExperimentalWebMcpTool`, and a Form_Tool produced by `form()` from `@angular/forms/signals` on `/contact`. A persistent Tool Inspector panel and a Manual Invoker UI surface the live state of `navigator.modelContext` so a viewer without an MCP-aware agent can see registration churn and invoke any tool by hand.

### Research Notes

This design relies on the experimental APIs documented in the source article and exposed in the Angular 22 next release line:

- `provideExperimentalWebMcpTools(...)` from `@angular/core` — a `Provider`-compatible factory that registers an array of tool descriptors with the active injector. When supplied to `bootstrapApplication`'s `providers`, the tools live for the application lifetime; when supplied through a `Route.providers`, the tools live for the route's injector lifetime.
- `declareExperimentalWebMcpTool(...)` from `@angular/core` — an imperative registration API meant to be called from within an injection context (typically a service constructor). The tool is registered for the lifetime of the calling injector and is unregistered when that injector is destroyed.
- `withExperimentalAutoCleanupInjectors()` from `@angular/router` — a `provideRouter` feature that ensures route injectors are torn down when their routes deactivate, which is what makes Route_Scoped_Tool unregistration automatic.
- `form()` and validators from `@angular/forms/signals` — the new signal-based forms API. Passing the `experimentalWebMcpTool: { name, description }` option causes the form to register a Form_Tool whose JSON schema is inferred from the form's signal model and whose handler runs the form's validators before submission.
- `@mcp-b/webmcp-polyfill` — a no-op import that, when loaded before any code reads `navigator.modelContext`, shims the runtime in browsers that do not yet ship a native implementation. It exposes `registerTool`, `unregisterTool`, `listTools`, `callTool`, and an event-emitter-style change subscription on `navigator.modelContext`.

The design treats `navigator.modelContext` as the single source of truth for the registry. The demo never duplicates the registry in its own data structures; instead, `ToolRegistryService` projects the runtime registry into a `Signal<ToolDescriptor[]>` for UI consumption.

## Architecture

### High-Level Approach

- **Module-free, standalone components only.** Every component declares its own imports. There are zero `NgModule` classes.
- **OnPush everywhere.** Every component sets `changeDetection: ChangeDetectionStrategy.OnPush` and uses signals for local state, so change detection is driven by signal reads inside the template.
- **Signals for state, RxJS only where it already exists.** Component and service state is held in `signal`, `computed`, and `effect`. The only stream we subscribe to is the WebMCP runtime's change notifications, which we adapt into a signal inside `ToolRegistryService`.
- **One injector per scope.** The application injector owns the Global_Tool. Each route that registers Route_Scoped_Tools relies on its route injector (kept alive only for the duration of the route, courtesy of `withExperimentalAutoCleanupInjectors()`). `CartService` is provided in the route injector for `/cart` so its lifetime is tied to that page.
- **Polyfill-first bootstrap.** The polyfill is imported at the top of `main.ts` before the dynamic `bootstrapApplication` call.

### Folder Structure

```
src/
├── main.ts                                  # imports polyfill, then bootstraps
├── index.html
├── styles.css
└── app/
    ├── app.config.ts                        # ApplicationConfig, providers, router
    ├── app.routes.ts                        # Route table with route providers
    ├── app.component.ts                     # Root shell: nav + <router-outlet> + inspector + invoker
    ├── core/
    │   ├── webmcp/
    │   │   ├── tool-descriptor.ts           # Shared TS types
    │   │   ├── structured-response.ts       # Structured_Response helpers
    │   │   ├── tool-registry.service.ts     # Signal<ToolDescriptor[]> over navigator.modelContext
    │   │   └── global-tools.ts              # searchProducts tool factory (used by app.config)
    │   └── catalog/
    │       └── product.service.ts           # In-memory product catalog
    ├── cart/
    │   └── cart.service.ts                  # declareExperimentalWebMcpTool for cart tools
    ├── pages/
    │   ├── home/home.component.ts
    │   ├── products/
    │   │   ├── products.component.ts
    │   │   └── products.tools.ts            # filterProducts factory
    │   ├── dashboard/
    │   │   ├── dashboard.component.ts
    │   │   └── dashboard.tools.ts           # exportReport factory
    │   ├── cart/cart.component.ts
    │   └── contact/contact.component.ts     # form() with experimentalWebMcpTool
    └── ui/
        ├── tool-inspector/tool-inspector.component.ts
        └── manual-invoker/manual-invoker.component.ts
```

### Component and Service Map

```mermaid
graph TD
  subgraph Browser
    NMC[navigator.modelContext - polyfilled]
  end

  subgraph App["AppComponent (root shell)"]
    Outlet[router-outlet]
    Inspector[ToolInspectorComponent]
    Invoker[ManualInvokerComponent]
  end

  subgraph Pages
    Home[HomeComponent]
    Products[ProductsComponent]
    Dashboard[DashboardComponent]
    Cart[CartComponent]
    Contact[ContactComponent]
  end

  subgraph Services
    Registry[ToolRegistryService]
    ProductSvc[ProductService]
    CartSvc[CartService]
  end

  subgraph Tools
    SearchProducts((searchProducts - global))
    FilterProducts((filterProducts - route /products))
    ExportReport((exportReport - route /dashboard))
    GetCartSummary((getCartSummary - service))
    AddToCart((addToCart - service))
    SubmitContact((submitContactForm - form))
  end

  Outlet --> Home
  Outlet --> Products
  Outlet --> Dashboard
  Outlet --> Cart
  Outlet --> Contact

  Inspector --> Registry
  Invoker --> Registry
  Registry <--> NMC

  SearchProducts -. provideExperimentalWebMcpTools at root .-> NMC
  FilterProducts -. route providers /products .-> NMC
  ExportReport -. route providers /dashboard .-> NMC
  CartSvc -- declareExperimentalWebMcpTool --> GetCartSummary
  CartSvc -- declareExperimentalWebMcpTool --> AddToCart
  GetCartSummary -. service injector .-> NMC
  AddToCart -. service injector .-> NMC
  Contact -- form() experimentalWebMcpTool --> SubmitContact
  SubmitContact -. route injector /contact .-> NMC

  Products --> ProductSvc
  Cart --> CartSvc
  CartSvc --> ProductSvc
  SearchProducts --> ProductSvc
  FilterProducts --> ProductSvc
```

### Manual Invocation Sequence

```mermaid
sequenceDiagram
  actor User
  participant UI as ManualInvokerComponent
  participant Reg as ToolRegistryService
  participant NMC as navigator.modelContext
  participant Handler as Tool Handler

  User->>UI: Selects a tool, edits JSON args, clicks Invoke
  UI->>UI: JSON.parse(args)
  alt parse fails
    UI-->>User: Show parse error, do not call
  else parse ok
    UI->>Reg: lookup descriptor by name
    alt descriptor missing (already unregistered)
      UI-->>User: Show 'tool no longer registered' error
    else descriptor present
      UI->>NMC: callTool(name, args)
      NMC->>Handler: invoke with parsed args
      Handler->>Handler: validate args, run logic
      Handler-->>NMC: Structured_Response
      NMC-->>UI: Structured_Response
      UI-->>User: Render status + payload
    end
  end
```


## Components and Interfaces

All components are standalone, OnPush, and use signals. None inject `ChangeDetectorRef`. Inputs are declared with `input()` / `input.required()`; outputs with `output()`.

### `AppComponent` (root shell)

- **Responsibility:** Render the top navigation, the `<router-outlet>`, and the persistent debug UI (Tool Inspector + Manual Invoker).
- **State:** None of its own. Reads no signals directly; the children manage their state.
- **Template:** `@for` over a static nav-link array, `<router-outlet />`, then `<app-tool-inspector />` and `<app-manual-invoker />` side by side in a sticky panel.
- **OnPush note:** No mutation happens here, so OnPush is trivially satisfied.

### `HomeComponent` (`/`)

- **Responsibility:** Render an overview describing the demo and listing what each route exposes.
- **State:** Static text only.
- **Tools:** None. The Global_Tool is registered by the application injector, not by this component.

### `ProductsComponent` (`/products`)

- **Responsibility:** Render the product catalog, expose UI filters that mirror the Filter_Products_Tool inputs.
- **Inputs/Outputs:** None.
- **Signals:**
  - `category = signal<string | null>(null)`
  - `maxPrice = signal<number | null>(null)`
  - `visibleProducts = computed(() => productService.filter({ category: category(), maxPrice: maxPrice() }))`
- **OnPush note:** All template reads go through signals; user inputs use `(input)` handlers that call `signal.set`.
- **Tool registration:** Lives in the `Route.providers` array, not in the component, so the tool exists for the duration of the route injector regardless of component instantiation.

### `DashboardComponent` (`/dashboard`)

- **Responsibility:** Render a fake analytics dashboard with a "format" picker and an "Export" button.
- **Signals:** `format = signal<'pdf' | 'csv' | 'json'>('pdf')`, `lastExport = signal<StructuredResponse | null>(null)`.
- **Behavior:** The Export button calls the same handler the Export_Report_Tool uses, sourced from a shared factory in `dashboard.tools.ts`. This keeps the UI button and the tool semantically identical.
- **Tool registration:** Route-level via `provideExperimentalWebMcpTools` in the route entry.

### `CartComponent` (`/cart`)

- **Responsibility:** Render the cart contents (from `CartService`) and provide an "Add demo item" button.
- **Signals:** Reads `cartService.items`, `cartService.itemCount`, `cartService.total` (all signals).
- **Tool registration:** None at the component or route level. `CartService` is `providedIn: 'root'` so its tools live for the application lifetime; if the design later moves it under the route, the tools will follow that injector.

### `ContactComponent` (`/contact`)

- **Responsibility:** Host the Signal Form and render success / validation error feedback.
- **Form:** Built with `form()` from `@angular/forms/signals`. The `experimentalWebMcpTool` option is set with name `submitContactForm` and a description string.
- **Signals:** `submission = signal<StructuredResponse | null>(null)`. The form itself is the source of truth for field state.
- **Submit flow:** A "Submit" button calls the same submit action the Form_Tool's handler invokes, so manual UI submission and tool-driven submission are indistinguishable.

### `ToolInspectorComponent`

- **Responsibility:** Display a live list of every tool currently registered with the WebMCP_Runtime, labeled by scope.
- **Inputs/Outputs:** None.
- **Signals:**
  - `tools = inject(ToolRegistryService).tools` — `Signal<ToolDescriptor[]>`.
  - `selectedName = signal<string | null>(null)` (used for highlight + propagated to the invoker via a shared service or output if desired).
- **Template:** A `@for` loop over `tools()` rendering name, scope badge, description, and a collapsible `<pre>` for the JSON schema.
- **Scope label:** Each `ToolDescriptor` carries a `scope: 'global' | 'route' | 'service' | 'form'` field populated when the tool is registered (see "Scope tagging" under Tool Definitions).
- **Latency requirement:** Updates within 500 ms because the registry signal is updated synchronously in the runtime's change callback (see `ToolRegistryService`).

### `ManualInvokerComponent`

- **Responsibility:** Let the user pick a tool, edit JSON args, invoke it through `navigator.modelContext`, and see the response.
- **Inputs:** `selectedName = input<string | null>(null)` (optional pre-selection from the inspector).
- **Outputs:** `invoked = output<{ name: string; response: StructuredResponse }>()` (for future logging; not required by the spec).
- **Signals:**
  - `tools = inject(ToolRegistryService).tools`
  - `chosenName = signal<string | null>(null)`
  - `argsText = signal<string>('{}')`
  - `lastResponse = signal<StructuredResponse | null>(null)`
  - `error = signal<string | null>(null)`
  - `template = computed(() => buildArgsTemplate(this.tools().find(t => t.name === this.chosenName())?.inputSchema))`
- **Behavior on tool change:** An `effect` writes `JSON.stringify(template(), null, 2)` into `argsText` whenever `chosenName` changes.
- **Behavior on submit:** Parses `argsText`. If parse fails, set `error`. If the chosen tool is no longer in `tools()`, set `error` and abort. Otherwise call `navigator.modelContext.callTool(name, args)` and store the response.

## Services

### `ToolRegistryService` (`providedIn: 'root'`)

The single bridge between `navigator.modelContext` and the UI.

```ts
@Injectable({ providedIn: 'root' })
export class ToolRegistryService {
  private readonly _tools = signal<ToolDescriptor[]>([]);
  readonly tools: Signal<ToolDescriptor[]> = this._tools.asReadonly();

  constructor() {
    const ctx = navigator.modelContext;
    const refresh = () => this._tools.set(snapshotRegistry(ctx));
    refresh();
    const off = ctx.addEventListener?.('change', refresh)
             ?? ctx.subscribe?.(refresh); // polyfill compatibility
    inject(DestroyRef).onDestroy(() => {
      ctx.removeEventListener?.('change', refresh);
      off?.();
    });
  }
}
```

`snapshotRegistry` reads `ctx.listTools()`, normalizes each entry into a `ToolDescriptor`, and attaches the scope label that was recorded at registration time (see "Scope tagging" below). The service holds no state besides the signal, so the UI never disagrees with the runtime.

### `ProductService` (`providedIn: 'root'`)

In-memory catalog used by the Search_Products_Tool, the Filter_Products_Tool, and `CartService`.

```ts
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly _products = signal<readonly Product[]>(SEED_PRODUCTS);
  readonly products: Signal<readonly Product[]> = this._products.asReadonly();

  search(query: string): Product[] { /* case-insensitive name/description match */ }
  filter(opts: { category?: string | null; maxPrice?: number | null }): Product[] { /* ... */ }
  findById(id: string): Product | undefined { /* ... */ }
}
```

The catalog is seeded from a constant `SEED_PRODUCTS` array; the service exposes signals so consumers stay OnPush-friendly.

### `CartService` (`providedIn: 'root'`)

Owns cart state and registers Service_Scoped_Tools from its constructor.

```ts
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly products = inject(ProductService);
  private readonly _items = signal<CartLine[]>([]);
  readonly items: Signal<readonly CartLine[]> = this._items.asReadonly();
  readonly itemCount = computed(() => this._items().reduce((n, l) => n + l.quantity, 0));
  readonly total = computed(() => this._items().reduce((n, l) => n + l.quantity * l.price, 0));

  constructor() {
    declareExperimentalWebMcpTool({
      name: 'getCartSummary',
      description: 'Return the current cart line items, item count, and total price.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: () => ok(this.snapshot()),
      // scope tag attached by helper:
      meta: { scope: 'service' },
    });

    declareExperimentalWebMcpTool({
      name: 'addToCart',
      description: 'Add a product to the cart by id and quantity.',
      inputSchema: ADD_TO_CART_SCHEMA,
      handler: (args) => this.addToCartHandler(args),
      meta: { scope: 'service' },
    });
  }

  addToCartHandler(args: unknown): StructuredResponse { /* validate, mutate, return */ }
  snapshot() { return { items: this._items(), itemCount: this.itemCount(), total: this.total() }; }
}
```

Because `declareExperimentalWebMcpTool` is called inside the service constructor inside an injection context, the tools are bound to the service's injector and will be unregistered when that injector is destroyed (validated by Property 3).

## Data Models

```ts
// core/webmcp/structured-response.ts
export type StructuredResponseStatus = 'success' | 'error';

export interface StructuredResponse<T = unknown> {
  status: StructuredResponseStatus;
  payload: T;
}

export const ok = <T>(payload: T): StructuredResponse<T> => ({ status: 'success', payload });
export const err = (code: string, message: string, details?: unknown): StructuredResponse =>
  ({ status: 'error', payload: { code, message, details } });
```

```ts
// core/webmcp/tool-descriptor.ts
export type ToolScope = 'global' | 'route' | 'service' | 'form';

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: JsonSchema;        // structural type from the runtime
  scope: ToolScope;               // attached by registration helpers
}
```

```ts
// core/catalog/product.ts
export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: 'audio' | 'wearable' | 'home' | 'office';
  readonly price: number;         // non-negative
}
```

```ts
// cart/cart-line.ts
export interface CartLine {
  readonly productId: string;
  readonly name: string;
  readonly price: number;         // unit price snapshot at add-time
  readonly quantity: number;      // positive integer
}

export interface CartSummary {
  readonly items: readonly CartLine[];
  readonly itemCount: number;
  readonly total: number;
}
```

```ts
// pages/contact/contact-form.model.ts
export interface ContactFormModel {
  name: string;        // required, min length 1
  email: string;       // required, email pattern
  topic: 'support' | 'sales' | 'feedback';
  message: string;     // required, min length 10
}
```

The contact form's signal model is `signal<ContactFormModel>({...})` and the validators are wired through `form()`'s validator API (`required`, `email`, `minLength`, `pattern` from `@angular/forms/signals`).

## Tool Definitions

Every tool produces a `StructuredResponse` and validates its arguments against an explicit JSON schema before any side effect. Every name is a verb-phrase in lowerCamelCase. The `meta.scope` field is attached at registration so the inspector can label entries.

| Name | Scope | Registered via | Input schema (summary) | Handler responsibility |
| --- | --- | --- | --- | --- |
| `searchProducts` | global | `provideExperimentalWebMcpTools` in `ApplicationConfig.providers` | `{ query: string }` (required, non-empty string) | Validate `query`, call `ProductService.search`, return `ok({ matches: Product[] })`; on missing/non-string `query` return `err('validation', ...)`. |
| `filterProducts` | route (`/products`) | `provideExperimentalWebMcpTools` in `Route.providers` | `{ category?: 'audio'\|'wearable'\|'home'\|'office', maxPrice?: number >= 0 }` | Validate, call `ProductService.filter`, return `ok({ matches })`; on out-of-schema args return `err('validation', ...)`. |
| `exportReport` | route (`/dashboard`) | `provideExperimentalWebMcpTools` in `Route.providers` | `{ format: 'pdf' \| 'csv' \| 'json' }` | Validate `format`, build a stub report payload (e.g. `{ format, generatedAt, rows: 42 }`), return `ok(...)`. Out-of-enum returns `err('validation', ...)`. |
| `getCartSummary` | service (`CartService`) | `declareExperimentalWebMcpTool` in `CartService` ctor | `{}` (no fields) | Return `ok(CartSummary)` from the current signals. |
| `addToCart` | service (`CartService`) | `declareExperimentalWebMcpTool` in `CartService` ctor | `{ productId: string, quantity: integer >= 1 }` | Validate schema; if `productId` not in catalog return `err('not_found', ...)`; if `quantity` invalid return `err('validation', ...)`; otherwise mutate `_items` and return `ok(CartSummary)`. |
| `submitContactForm` | form (`/contact`) | `form()`'s `experimentalWebMcpTool` option | Inferred from `ContactFormModel` plus validators | Run all form validators; if any fail, return `err('validation', { fieldErrors })` and do not submit; if all pass, run the submit action and return `ok({ submitted: true, ticketId })`. |

### Scope Tagging

`provideExperimentalWebMcpTools` accepts a `meta` field on each descriptor. We use it to record `scope` so the Tool Inspector can display a label. For the Form_Tool, the descriptor that `form()` emits will be wrapped at the route level so the same `meta.scope = 'form'` field is attached.

## Routing Configuration

`app.routes.ts` declares the route table and binds Route_Scoped_Tools through each route's `providers`. The route injector is what `withExperimentalAutoCleanupInjectors()` cleans up on deactivation, which is what makes the tools disappear.

```ts
// app.routes.ts
import { Routes } from '@angular/router';
import { provideExperimentalWebMcpTools } from '@angular/core';
import { filterProductsTool } from './pages/products/products.tools';
import { exportReportTool } from './pages/dashboard/dashboard.tools';

export const APP_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/products.component').then(m => m.ProductsComponent),
    providers: [provideExperimentalWebMcpTools([filterProductsTool])],
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    providers: [provideExperimentalWebMcpTools([exportReportTool])],
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart.component').then(m => m.CartComponent),
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent),
  },
  { path: '**', redirectTo: '' },
];
```

```ts
// app.config.ts
import { ApplicationConfig, provideExperimentalWebMcpTools } from '@angular/core';
import { provideRouter, withExperimentalAutoCleanupInjectors } from '@angular/router';
import { APP_ROUTES } from './app.routes';
import { searchProductsTool } from './core/webmcp/global-tools';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(APP_ROUTES, withExperimentalAutoCleanupInjectors()),
    provideExperimentalWebMcpTools([searchProductsTool]),
  ],
};
```

The Form_Tool for `/contact` is registered through `form()`'s own `experimentalWebMcpTool` option inside `ContactComponent`. Because that registration happens in the component's injection context, and the component is created inside the `/contact` route injector, navigating away tears the component down and unregisters the tool — which is exactly what `withExperimentalAutoCleanupInjectors()` enables.

## Bootstrap Sequence

`main.ts` imports the polyfill before any code touches `navigator.modelContext`. The polyfill mutates the `navigator` global on import, so subsequent `inject(ToolRegistryService)` calls see a populated runtime.

```ts
// main.ts
import '@mcp-b/webmcp-polyfill';                 // 1. Polyfill installs navigator.modelContext
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)    // 2. Angular boots, providers run, global tool registers
  .catch((err) => console.error(err));
```

Order matters:

1. The polyfill runs at import time and installs `navigator.modelContext` if it is missing.
2. `bootstrapApplication` evaluates `appConfig.providers`, which calls `provideExperimentalWebMcpTools([searchProductsTool])`. The Global_Tool is now registered.
3. The router is constructed with `withExperimentalAutoCleanupInjectors()` so route injectors are torn down on deactivation.
4. `ToolRegistryService` (lazily instantiated by the inspector) reads the current registry and subscribes to change notifications.
5. Subsequent navigation registers/unregisters Route_Scoped_Tools and Form_Tools; `CartService`'s constructor registers Service_Scoped_Tools the first time it is injected.

## Acceptance Criteria Testing Prework

The full prework analysis was performed using the `prework` tool. The summary below records the classification of each acceptance criterion; the per-criterion reasoning is stored in the prework context and informs the property set in the next section.

| Criterion | Classification | Rationale (one line) |
| --- | --- | --- |
| 1.1 polyfill loaded before bootstrap | SMOKE | One-time import-order check. |
| 1.2 searchProducts registered as global | EXAMPLE | Single bootstrap-time check. |
| 1.3 searchProducts returns Structured_Response with matches | PROPERTY | Universal over catalogs and queries. |
| 1.4 invalid query yields validation error | PROPERTY | Universal over non-string inputs. |
| 1.5 router uses `withExperimentalAutoCleanupInjectors()` | SMOKE | Configuration check. |
| 2.1–2.4 route-scoped tools register/unregister with navigation | PROPERTY | Captured by the registry-parity property. |
| 2.5 exportReport accepts pdf/csv/json | PROPERTY | Universal over enum membership. |
| 2.6 filterProducts returns filtered list | PROPERTY | Universal over catalogs and filter args. |
| 2.7 invalid args produce validation errors | PROPERTY | Subsumed by the response-shape property. |
| 3.1 cart tools registered from constructor | EXAMPLE | One-time post-instantiation check. |
| 3.2 getCartSummary returns correct totals | PROPERTY | Cart invariant. |
| 3.3 / 3.4 / 3.5 addToCart valid/invalid behavior | PROPERTY | Combined into the addToCart invariant. |
| 3.6 destroying service injector unregisters tools | PROPERTY | Scope-lifecycle property. |
| 4.1 contact form built with `experimentalWebMcpTool` option | SMOKE | Configuration check. |
| 4.2 / 4.5 form tool present iff on /contact | PROPERTY | Subsumed by registry parity. |
| 4.3 / 4.4 valid/invalid form input behavior | PROPERTY | Validator-gating property. |
| 5.1 inspector visible everywhere | EXAMPLE | Layout placement check. |
| 5.2 / 5.3 / 5.4 inspector reflects registry with scope labels | PROPERTY | Subsumed by inspector-equality property. |
| 6.1 invoker selectable set equals registry | PROPERTY | Subsumed by inspector-equality property. |
| 6.2 schema-derived template covers required fields | PROPERTY | Universal over schemas. |
| 6.3 invocation result is displayed | PROPERTY (transparency) | Universal: rendered response equals runtime response. |
| 6.4 stale tool selection: no call, show error | PROPERTY | Universal over (was-listed, now-unlisted) sequences. |
| 6.5 invalid JSON: no call, show error | PROPERTY | Universal over malformed JSON inputs. |
| 7.1 / 7.2 / 7.3 well-formed descriptors | PROPERTY | Combined into descriptor-shape property. |
| 7.4 schema validation before side effect | PROPERTY | Combined into addToCart and form-validator gating. |
| 7.5 every handler returns Structured_Response | PROPERTY | Response-shape property over the entire registry. |
| 8.1 dependencies on `@next` | SMOKE | package.json check. |
| 8.2–8.6 stack and convention rules | SMOKE | Static AST/template checks. |

After redundancy reflection (full reasoning in the prework context), we keep seven properties below: the universal response-shape property; registry parity over navigation; the scope-lifecycle property for `CartService`; the inspector-equality property; the `addToCart` invariant; the contact-form validator-gating property; and the descriptor well-formedness property.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Every tool handler returns a Structured_Response

*For any* tool currently registered with the WebMCP_Runtime and *for any* JSON-serializable input, invoking the tool through `navigator.modelContext.callTool(name, input)` returns an object whose `status` field is exactly `'success'` or `'error'` and which has a defined `payload` field.

**Validates: Requirements 1.3, 1.4, 2.5, 2.6, 2.7, 3.2, 3.3, 3.4, 3.5, 4.3, 4.4, 7.5**

### Property 2: Registry parity with navigation

*For any* sequence of router navigations across the routes `/`, `/products`, `/dashboard`, `/cart`, and `/contact`, after each navigation completes the set of tool names returned by `navigator.modelContext.listTools()` is exactly the union of (a) the Global_Tool names, (b) the Route_Scoped_Tool names declared on the active route's `providers`, (c) any Service_Scoped_Tool names whose owning service injector is still alive, and (d) the Form_Tool name(s) attached to components currently mounted on the active route.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 4.2, 4.5**

### Property 3: Service-injector destruction unregisters service tools

*For any* injector hosting a `CartService` instance, after that injector is destroyed the names `getCartSummary` and `addToCart` are no longer present in `navigator.modelContext.listTools()`.

**Validates: Requirements 3.6**

### Property 4: Tool Inspector equals the runtime registry

*For any* state of the WebMCP_Runtime, the list rendered by `ToolInspectorComponent` contains exactly one entry per name returned by `navigator.modelContext.listTools()`, and each rendered entry's name, description, JSON schema, and scope label are equal to the corresponding fields on the runtime descriptor.

**Validates: Requirements 5.2, 5.3, 5.4, 6.1**

### Property 5: `addToCart` mutates state only on valid input

*For any* `CartService` state and *for any* candidate args `{ productId, quantity }`, after invoking `addToCart(args)` the cart state is changed *if and only if* `productId` is the id of a product in the catalog AND `quantity` is a positive integer; in every other case the cart state is byte-for-byte unchanged and the response has `status === 'error'`.

**Validates: Requirements 3.3, 3.4, 3.5, 7.4**

### Property 6: Contact form rejects invalid input without submitting

*For any* `ContactFormModel` value that fails one or more of the form's declared validators, invoking `submitContactForm` returns a Structured_Response with `status === 'error'` and the form's submit action is not invoked. Conversely, *for any* value satisfying every validator, the submit action is invoked exactly once and the response has `status === 'success'`.

**Validates: Requirements 4.3, 4.4, 7.4**

### Property 7: Every registered descriptor is well-formed

*For any* descriptor returned by `navigator.modelContext.listTools()`, the descriptor's `name` matches `/^[a-z][a-zA-Z0-9]*$/` (lowerCamelCase), its `description` is a non-empty string, and its `inputSchema` is an object with an explicit `type` field.

**Validates: Requirements 7.1, 7.2, 7.3**

## Error Handling

### Tool Handlers

Every tool handler follows the same shape:

```ts
function handler(rawArgs: unknown): StructuredResponse {
  const parsed = validate(rawArgs, SCHEMA);     // structural + type check
  if (!parsed.ok) return err('validation', parsed.message, parsed.details);
  try {
    const payload = doWork(parsed.value);       // pure or signal-mutating
    return ok(payload);
  } catch (e) {
    return err('internal', (e as Error).message);
  }
}
```

Validation runs before any side effect (Property 5 and Property 6 depend on this ordering). The `err` helper always returns the `StructuredResponse` shape so Property 1 holds for every code path. We use a small hand-rolled `validate` over JSON Schema rather than pulling in Ajv for the demo; the schemas are tiny.

### Polyfill Caveats

- The polyfill is a runtime shim. If a browser ships a native `navigator.modelContext`, the polyfill should detect it and no-op; we treat both cases identically. `ToolRegistryService` calls `addEventListener?.('change', ...)` with optional chaining and falls back to a `subscribe?.(...)` style if the polyfill exposes that API instead.
- Some polyfill versions may invoke change callbacks asynchronously. `ToolRegistryService` always reads `listTools()` inside the callback rather than trusting an event payload, so the inspector signal can never lag the runtime.
- If `navigator.modelContext` is unexpectedly missing at startup (e.g. the polyfill import was tree-shaken), the application logs an error and renders an inline banner in `AppComponent`. The Tool Inspector then renders an empty list rather than crashing.

### Routing

- Route guards are not used. If they are added later, the route injector is still created before the guard resolves, so Route_Scoped_Tools registered through `Route.providers` will appear briefly even if the guard later denies activation. The design assumes no guards in this demo.
- Lazy-loaded routes mean the route's `providers` array is evaluated on first navigation. The auto-cleanup feature still tears the injector down on deactivation, so subsequent navigations re-register from scratch.

### Manual Invoker

- JSON parse errors and "tool no longer registered" cases are surfaced inline; `navigator.modelContext.callTool` is never called for them.
- A handler that throws synchronously is caught by the runtime; the invoker treats anything other than a `StructuredResponse` shape as an error and renders a normalized error message.

## Testing Strategy

### Property-Based Tests (PBT applies)

PBT applies to the parts of this demo that have meaningful input variation: tool handlers, the registry parity invariant, the cart invariant, the form validator gating, and descriptor well-formedness. We pick **fast-check** as the property-based testing library for the target language (TypeScript) and run each property test for a minimum of 100 iterations. Each PBT is tagged with a comment in the form `// Feature: webmcp-angular-demo, Property N: <property text>` for traceability.

PBT targets, mapped to the seven properties:

1. **Property 1 (response shape).** For each registered tool, generate arbitrary JSON inputs with `fc.anything()` and assert `response.status` is `'success'` or `'error'` and `response.payload !== undefined`.
2. **Property 2 (registry parity).** Generate random navigation sequences with `fc.array(fc.constantFrom('/', '/products', '/dashboard', '/cart', '/contact'))`, drive the router through them, and after each step assert set equality between `listTools()` and the expected union of (global, active-route, alive-service, active-form) tool names.
3. **Property 3 (service teardown).** Generate random create/destroy sequences for child injectors hosting `CartService` and assert that after each destroy the cart tool names are absent.
4. **Property 4 (inspector equality).** Generate random registry states (by registering and unregistering test tools) and assert the rendered inspector list equals `listTools()` field-by-field.
5. **Property 5 (`addToCart` invariant).** Generate random `(productId, quantity)` tuples mixing valid and invalid values; assert state changes iff inputs are valid and that response status reflects validity.
6. **Property 6 (form validator gating).** Generate random `ContactFormModel` values that systematically pass or violate each validator; assert that the submit action (a `vi.fn()`) is called exactly when all validators pass and the response status matches.
7. **Property 7 (descriptor shape).** Walk `listTools()` after navigating to each route and assert every descriptor satisfies the lowerCamelCase + non-empty description + explicit-`type` schema constraint.

Configuration:

- Each `fc.assert` runs with `{ numRuns: 100 }` minimum.
- Generators for "JSON-serializable input" use `fc.jsonValue()`.
- For tests that need a router and a real injector, we use Angular's `TestBed` with the same `provideRouter(APP_ROUTES, withExperimentalAutoCleanupInjectors())` configuration.

### Example-Based Tests (sufficient on their own)

These cases either don't vary meaningfully with input or are configuration checks:

- **Bootstrap order (1.1, 1.5, 8.1):** Static checks on `main.ts` and `package.json`.
- **Initial registration (1.2, 3.1, 4.1):** TestBed-style integration tests that bootstrap the app (or instantiate `CartService`) and assert specific tool names are listed.
- **UI placement (5.1):** Render `AppComponent` and assert `<app-tool-inspector>` and `<app-manual-invoker>` are present in the DOM regardless of route.
- **Static stack rules (8.2–8.6):** A small AST/grep-style test that scans `src/app/**` for `@NgModule`, missing `standalone: true`, missing `OnPush`, and uses of `*ngIf`/`*ngFor`/`*ngSwitch`. Failing matches fail the test.
- **Smoke render of each page:** A single Karma/Vitest example test per page route that the component renders without throwing.

### Test Boundaries

- Tool handlers are tested directly (pure functions over their args plus injected services), separately from `navigator.modelContext`. A thin integration test then asserts that `callTool('searchProducts', ...)` reaches the same handler.
- The polyfill is treated as an external dependency; we do not test its internals. We do verify that after import `navigator.modelContext.listTools` is a function.
- The signal-forms `experimentalWebMcpTool` integration is tested at the boundary: we assert the registered tool exists and that calling it routes through the form's validators (Property 6 covers the behavior).

---

**Phase complete.** The design covers architecture, components, services, data models, tool definitions, routing, bootstrap, correctness properties, error handling, and testing strategy for the WebMCP Angular Demo. Please review `.kiro/specs/webmcp-angular-demo/design.md` and let me know if anything should change before we move on to the tasks phase.
