# Implementation Plan: WebMCP Angular Demo

## Overview

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

The plan starts with Angular 22 (next) project scaffolding, then introduces shared types and helpers, the registry bridge to `navigator.modelContext`, the global `searchProducts` tool, the route-scoped `filterProducts` and `exportReport` tools, the `CartService` with its service-scoped tools, and the contact-page Form_Tool. Each implementation cluster is followed by the property-based tests that protect the correctness properties from the design. The last task wires everything together end-to-end and adds a README that documents how to run the demo.

Property-based test sub-tasks for the six retained correctness properties are **required** (not optional) because the design treats them as the primary correctness contract. Other tests (unit, smoke, integration) are marked optional with a trailing `*`.

Implementation language: **TypeScript** (Angular 22 next, standalone components, OnPush, signals, modern control flow). The design specifies TypeScript and concrete Angular APIs throughout, so no language selection is required.

## Tasks

- [x] 1. Scaffold Angular 22 (next) project, install dependencies, and wire the WebMCP polyfill
  - [x] 1.1 Generate the Angular workspace with the v22-next CLI
    - Run `npx --yes @angular/cli@next new webmcp-angular-demo --routing --style=css --ssr=false --strict --skip-git --package-manager=npm` from the workspace root, accepting standalone-only output
    - Confirm the generated `package.json` pins `@angular/core`, `@angular/common`, `@angular/router`, `@angular/forms`, `@angular/platform-browser`, `@angular/compiler`, and `@angular/compiler-cli` to `next`
    - Set `tsconfig.json` to `"target": "ES2022"`, `"module": "ES2022"`, `"strict": true`, `"noImplicitOverride": true`, `"noFallthroughCasesInSwitch": true`, `"noPropertyAccessFromIndexSignature": true`
    - Add an `engines` field to `package.json` requiring Node `>=22`
    - _Requirements: 8.1, 8.2, 8.6_
  - [x] 1.2 Install runtime and test dependencies
    - Add `@mcp-b/webmcp-polyfill` as a runtime dependency
    - Add `fast-check` as a dev dependency for property-based tests
    - Run `npm install` and verify `node_modules/@angular/core/package.json` reports a `next`-tagged version
    - _Requirements: 1.1, 8.1_
  - [x] 1.3 Wire the polyfill before bootstrap
    - Edit `src/main.ts` to import `@mcp-b/webmcp-polyfill` as the very first import, before `bootstrapApplication`
    - Keep the existing `bootstrapApplication(AppComponent, appConfig)` call after the polyfill import
    - _Requirements: 1.1, design "Bootstrap Sequence"_
  - [x] 1.4 Establish the folder layout from the design
    - Create empty placeholder files (or `index.ts` re-export stubs) for `src/app/core/webmcp/`, `src/app/core/catalog/`, `src/app/cart/`, and `src/app/pages/{home,products,dashboard,cart,contact}/`
    - _Requirements: design "Folder Structure"_
  - [x] 1.5 Smoke-run the dev build
    - Run `npm run build` once to confirm the scaffold compiles before any feature code is added
    - _Requirements: 8.1_

- [x] 2. Define shared data types and `Structured_Response` helpers
  - [x] 2.1 Implement `core/webmcp/structured-response.ts`
    - Export `StructuredResponseStatus`, `StructuredResponse<T>`, `ok<T>(payload)`, and `err(code, message, details?)` exactly as shown in the design's "Data Models" section
    - Add a `isStructuredResponse(value): value is StructuredResponse` type guard for ad-hoc consumers
    - _Requirements: 7.5, design "Data Models"_
  - [x] 2.2 Implement `core/webmcp/tool-descriptor.ts`
    - Export `ToolScope = 'global' | 'route' | 'service' | 'form'` and the `ToolDescriptor` interface (`name`, `description`, `inputSchema`, `scope`)
    - Export a minimal structural `JsonSchema` type sufficient for the demo's schemas
    - _Requirements: 7.1, 7.2, 7.3, design "Data Models"_
  - [x] 2.3 Implement `core/webmcp/validate.ts`
    - Provide a tiny hand-rolled `validate(value, schema)` returning `{ ok: true, value } | { ok: false, message, details }` covering `type: 'object'`, `string`, `integer`, `number` (with `minimum`), enum membership, `required`, and `additionalProperties: false`
    - Keep the implementation pure and dependency-free so it can be reused by every handler
    - _Requirements: 7.3, 7.4_
  - [x] 2.4 Implement `core/catalog/product.ts` and the `SEED_PRODUCTS` constant
    - Export the `Product` interface from the design and a `SEED_PRODUCTS: readonly Product[]` array with at least 6 items spanning every `category`
    - _Requirements: design "Data Models"_
  - [x] 2.5 Implement `cart/cart-line.ts`
    - Export `CartLine` and `CartSummary` interfaces matching the design exactly
    - _Requirements: design "Data Models"_
  - [ ]* 2.6 Unit tests for `validate` and `Structured_Response` helpers
    - Verify `ok` and `err` produce the documented shape; verify `validate` accepts/rejects representative inputs for each supported keyword
    - _Requirements: 7.3, 7.4, 7.5_

- [x] 3. Implement `ProductService`
  - [x] 3.1 Implement `core/catalog/product.service.ts`
    - `@Injectable({ providedIn: 'root' })`, holds `_products = signal<readonly Product[]>(SEED_PRODUCTS)`, exposes `products`, `search(query)`, `filter({ category, maxPrice })`, `findById(id)` exactly as specified in the design
    - Search is case-insensitive over `name` and `description`; `filter` ignores `null`/`undefined` filter fields; `findById` returns `undefined` for unknown ids
    - _Requirements: 1.3, 2.6, design "ProductService"_
  - [ ]* 3.2 Unit tests for `ProductService` filtering and search
    - Cover empty query, no matches, partial match, and category/maxPrice combinations
    - _Requirements: 1.3, 2.6_

- [x] 4. Implement the global `searchProducts` tool and bootstrap configuration
  - [x] 4.1 Implement `core/webmcp/global-tools.ts`
    - Export a `searchProductsTool` factory (or constant descriptor with injection-context resolution via `inject(ProductService)`) named `searchProducts`, with description and JSON schema `{ type: 'object', required: ['query'], properties: { query: { type: 'string' } }, additionalProperties: false }`
    - Handler validates with `validate(...)`, calls `productService.search(query)`, returns `ok({ matches })`; on validation failure returns `err('validation', ...)`
    - _Requirements: 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 4.2 Configure `app.config.ts`
    - Build the `ApplicationConfig` to provide `provideRouter(APP_ROUTES, withExperimentalAutoCleanupInjectors())`, `provideExperimentalWebMcpTools([searchProductsTool])`, and `provideExperimentalWebMcpForms()` (required so `form()`'s `experimentalWebMcpTool` option registers Form_Tools at runtime)
    - _Requirements: 1.2, 1.5, 4.1_
  - [x] 4.3 Define the route table skeleton in `app.routes.ts`
    - Add lazy `loadComponent` routes for `''`, `products`, `dashboard`, `cart`, `contact`, plus the `**` redirect; leave route-level `providers` empty for now (filled in tasks 6 and 7)
    - _Requirements: 2.1, 2.3, design "Routing Configuration"_
  - [x] 4.4 Implement `AppComponent` shell
    - Standalone component with `ChangeDetectionStrategy.OnPush`, template containing a nav `@for` over a static link list and `<router-outlet />`
    - _Requirements: 8.2, 8.3, 8.5_
  - [x] 4.5 PBT — Property 1 over the global tool
    - **Property 1: Every tool handler returns a Structured_Response**
    - **Validates: Requirements 1.3, 1.4, 7.5**
    - Use `fc.anything()` (or `fc.jsonValue()`) to fuzz inputs; bootstrap the app via `TestBed`, call `navigator.modelContext.callTool('searchProducts', input)`, assert `status` ∈ `{'success','error'}` and `payload !== undefined`
    - _Requirements: 1.3, 1.4, 7.5; design Property 1_

- [x] 5. Implement `HomeComponent` and a basic navigation smoke surface
  - [x] 5.1 Implement `pages/home/home.component.ts`
    - Standalone, OnPush, static template summarizing each route and the tool exposed there
    - _Requirements: 8.2, 8.3, 8.5_
  - [x] 5.2 Smoke render test for `HomeComponent`
    - Render with `TestBed` and assert it does not throw
    - _Requirements: 8.2_

- [x] 6. Implement `ProductsComponent` and the route-scoped `filterProducts` tool
  - [x] 6.1 Implement `pages/products/products.tools.ts`
    - Export a `filterProductsTool` descriptor named `filterProducts`, schema `{ type: 'object', properties: { category: { type: 'string', enum: ['audio','wearable','home','office'] }, maxPrice: { type: 'number', minimum: 0 } }, additionalProperties: false }`
    - Handler validates and calls `inject(ProductService).filter({ category, maxPrice })`, returning `ok({ matches })` or `err('validation', ...)`
    - _Requirements: 2.6, 2.7, 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 6.2 Implement `pages/products/products.component.ts`
    - Standalone, OnPush, signals for `category` and `maxPrice`, computed `visibleProducts` driven by `ProductService.filter`
    - Template uses `@for` over `visibleProducts()` and `@if` guards; inputs use `(input)` handlers calling `signal.set`
    - _Requirements: 2.6, 8.2, 8.3, 8.4, 8.5_
  - [x] 6.3 Wire the route in `app.routes.ts`
    - Set the `/products` route's `providers` to `[provideExperimentalWebMcpTools([filterProductsTool])]`
    - _Requirements: 2.3, 2.4_
  - [x] 6.4 PBT — Property 1 covers `filterProducts`
    - **Property 1: Every tool handler returns a Structured_Response**
    - **Validates: Requirements 2.6, 2.7, 7.5**
    - Generate arbitrary inputs (valid + invalid `category`, `maxPrice`, plus extras), navigate the test router to `/products`, call `filterProducts`, assert response shape
    - _Requirements: 2.6, 2.7, 7.5; design Property 1_

- [x] 7. Implement `DashboardComponent` and the route-scoped `exportReport` tool
  - [x] 7.1 Implement `pages/dashboard/dashboard.tools.ts`
    - Export `exportReportTool` named `exportReport`, schema `{ type: 'object', required: ['format'], properties: { format: { type: 'string', enum: ['pdf','csv','json'] } }, additionalProperties: false }`
    - Handler validates `format` and returns `ok({ format, generatedAt: new Date().toISOString(), rows: 42 })`; out-of-enum returns `err('validation', ...)`
    - Export a shared `runExport(format)` helper used by both the tool and the component button so manual UI and tool invocation are semantically identical
    - _Requirements: 2.5, 2.7, 7.1, 7.2, 7.3, 7.4, 7.5, design "DashboardComponent"_
  - [x] 7.2 Implement `pages/dashboard/dashboard.component.ts`
    - Standalone, OnPush, `format = signal<'pdf'|'csv'|'json'>('pdf')`, `lastExport = signal<StructuredResponse|null>(null)`
    - Template uses `@switch` on `format()` for visual selection, an Export button, and `@if (lastExport())` to render the result
    - _Requirements: 2.5, 8.2, 8.3, 8.4, 8.5_
  - [x] 7.3 Wire the route
    - Set `/dashboard` route's `providers` to `[provideExperimentalWebMcpTools([exportReportTool])]`
    - _Requirements: 2.1, 2.2_
  - [x] 7.4 PBT — Property 1 covers `exportReport` and enum membership
    - **Property 1: Every tool handler returns a Structured_Response**
    - **Validates: Requirements 2.5, 2.7, 7.5**
    - Generate arbitrary `format` values (members + non-members + non-strings); assert valid enum members yield `success` and others yield `error('validation', ...)`, both with the response shape
    - _Requirements: 2.5, 2.7, 7.5; design Property 1_

- [x] 8. Checkpoint — global + route-scoped tools wired and tested
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. PBT — Registry parity over navigation (Property 2)
  - [x] 9.1 Build a router-driven property test
    - **Property 2: Registry parity with navigation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 4.2, 4.5**
    - Use Angular `TestBed` with `provideRouter(APP_ROUTES, withExperimentalAutoCleanupInjectors())` and `provideExperimentalWebMcpTools([searchProductsTool])`
    - Use `fc.array(fc.constantFrom('/', '/products', '/dashboard', '/cart', '/contact'))` to drive sequences of `router.navigateByUrl(...)` calls
    - After each navigation `await` stable state, then assert `setOf(navigator.modelContext.listTools().map(t => t.name))` equals the expected union: `{searchProducts}` ∪ active-route route-scoped names ∪ alive service-scoped names ∪ active form-tool names
    - _Requirements: 2.1–2.4, 4.2, 4.5; design Property 2_

- [x] 10. Implement `CartService` and the service-scoped `getCartSummary` / `addToCart` tools
  - [x] 10.1 Implement `cart/cart.service.ts`
    - `@Injectable({ providedIn: 'root' })`, signals `_items`, computed `itemCount` and `total`, `snapshot()` matching `CartSummary`
    - In the constructor call `declareExperimentalWebMcpTool` twice — once for `getCartSummary` (empty schema), once for `addToCart` (`{ type: 'object', required: ['productId','quantity'], properties: { productId: { type: 'string' }, quantity: { type: 'integer', minimum: 1 } }, additionalProperties: false }`)
    - `addToCartHandler(args)` validates, calls `productService.findById(productId)` (returns `err('not_found', ...)` when absent), and otherwise mutates `_items` (creating or incrementing the matching `CartLine`) and returns `ok(this.snapshot())`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 10.2 Implement `pages/cart/cart.component.ts`
    - Standalone, OnPush; reads `cartService.items`, `itemCount`, `total`; "Add demo item" button calls `addToCart` with a fixed `productId` from the catalog
    - Template uses `@for` and `@if` blocks
    - _Requirements: 3.1, 3.2, 8.2–8.5_
  - [x] 10.3 PBT — Property 5 (`addToCart` invariant)
    - **Property 5: `addToCart` mutates state only on valid input**
    - **Validates: Requirements 3.3, 3.4, 3.5, 7.4**
    - Generate `(productId, quantity)` tuples mixing catalog ids with random strings and valid/invalid quantities (negatives, zero, non-integers, NaN) using `fc`; clone `cartService.snapshot()` before each call
    - Assert: state changes iff `productId` ∈ catalog AND `quantity` is a positive integer; otherwise the snapshot is byte-for-byte unchanged and `response.status === 'error'`
    - _Requirements: 3.3, 3.4, 3.5, 7.4; design Property 5_
  - [x] 10.4 PBT — Property 1 covers cart tools
    - **Property 1: Every tool handler returns a Structured_Response**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 7.5**
    - Fuzz inputs into `getCartSummary` and `addToCart`; assert the response shape contract
    - _Requirements: 3.2–3.5, 7.5; design Property 1_
  - [x] 10.5 PBT — Property 3 (service-injector destruction)
    - **Property 3: Service-injector destruction unregisters service tools**
    - **Validates: Requirements 3.6**
    - Generate sequences of `Injector.create({ providers: [CartService], parent })` create/destroy events; after each destroy assert `getCartSummary` and `addToCart` are absent from `navigator.modelContext.listTools()`
    - _Requirements: 3.6; design Property 3_

- [x] 11. Implement `ContactComponent`, the contact form model, and the `submitContactForm` Form_Tool
  - [x] 11.1 Implement `pages/contact/contact-form.model.ts`
    - Export `ContactFormModel` exactly as in the design
    - _Requirements: 4.1, design "Data Models"_
  - [x] 11.2 Implement `pages/contact/contact.component.ts`
    - Standalone, OnPush; build the form with `form()` from `@angular/forms/signals`, attaching the `experimentalWebMcpTool: { name: 'submitContactForm', description: '...' }` option
    - Wire validators: `required` on `name`, `email`, `topic`, `message`; `email` validator on `email`; `minLength(1)` on `name`; `minLength(10)` on `message`; `topic` constrained to `'support' | 'sales' | 'feedback'`
    - Submit action returns `ok({ submitted: true, ticketId: <generated> })`; the component renders submission feedback from a `submission` signal
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1–7.5, 8.2–8.5_
  - [x] 11.3 PBT — Property 6 (contact-form validator gating)
    - **Property 6: Contact form rejects invalid input without submitting**
    - **Validates: Requirements 4.3, 4.4, 7.4**
    - Use `fc` to generate `ContactFormModel` values that systematically pass or violate each validator (empty `name`, malformed `email`, `topic` outside enum, `message` shorter than 10 chars)
    - Spy on the submit action with `vi.fn()` (or Jasmine equivalent matching the project's runner); assert the spy is called exactly when every validator passes, never when any fails, and that response status matches
    - _Requirements: 4.3, 4.4, 7.4; design Property 6_
  - [x] 11.4 PBT — Property 1 covers `submitContactForm`
    - **Property 1: Every tool handler returns a Structured_Response**
    - **Validates: Requirements 4.3, 4.4, 7.5**
    - Fuzz arbitrary JSON into `submitContactForm` and assert response shape
    - _Requirements: 4.3, 4.4, 7.5; design Property 1_

- [x] 12. Checkpoint — services, cart, and form complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. End-to-end integration verification and project README
  - [x] 13.1 Author a TestBed-based integration test that drives the full tool surface
    - Bootstrap the app, exercise: navigation churn `/ → /products → /dashboard → /cart → /contact → /`, calling `searchProducts`, `filterProducts`, `exportReport`, `getCartSummary`, `addToCart`, and `submitContactForm` through `navigator.modelContext.callTool` while each route is active
    - After each navigation, assert the runtime registry (`navigator.modelContext.listTools()`) matches the expected union of (global, active-route, alive-service, active-form) tool names — the same parity invariant Property 2 enforces, this time as an end-to-end smoke check rather than a property test
    - _Requirements: 1.2, 2.1–2.6, 3.1–3.5, 4.1–4.4_
  - [x] 13.2 Add a `README.md` at the project root
    - Document: prerequisites (Node 22, Angular CLI v22 next), `npm install`, `npm start`, `npm test`, the demo tour (per-route tools and where to look in `navigator.modelContext` via Chrome's WebMCP devtools extension), and the polyfill caveat
    - _Requirements: design "Bootstrap Sequence", design "Error Handling / Polyfill Caveats"_
  - [x] 13.3 Static stack-rule lint test
    - Add a test that scans `src/app/**` and fails on `@NgModule`, components missing `standalone: true`, components missing `ChangeDetectionStrategy.OnPush`, or templates using `*ngIf`/`*ngFor`/`*ngSwitch`
    - _Requirements: 8.2, 8.3, 8.5, 8.6_

- [x] 14. Final checkpoint — full suite green
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; property-based test sub-tasks (the six retained correctness properties) are **not** marked optional because the design treats them as the primary correctness contract.
- Each task references the specific requirement IDs and design sections it implements. Requirement IDs 5.x and 6.x and design Property 4 are intentionally retired together with the in-app Tool Inspector and Manual Invoker UIs (task 13). The remaining numbering is preserved so existing source-code comments and test annotations stay in sync.
- Property tests use `fast-check` with `numRuns: 100` minimum, and follow the design's testing strategy (`TestBed` plus `provideRouter(APP_ROUTES, withExperimentalAutoCleanupInjectors())` for router-driven properties).
- Checkpoints (tasks 8, 12, 17) ensure incremental validation between feature clusters.
- Implementation language is TypeScript with Angular 22 (next): standalone, OnPush, signals, `@if` / `@for` / `@switch`, no `NgModule`s.
