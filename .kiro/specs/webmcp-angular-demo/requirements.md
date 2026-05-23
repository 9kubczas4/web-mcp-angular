# Requirements Document

## Introduction

The WebMCP Angular Demo is a standalone Angular 22 (next) application that showcases the framework's experimental WebMCP (Web Model Context Protocol) support. The demo exercises every WebMCP integration point documented in the source article: application-wide tool registration, route-scoped tools with automatic cleanup, dynamic tools tied to a service lifecycle, and Signal Forms exposed as AI-callable tools. Because most browsers do not yet ship a native WebMCP runtime, the demo loads the `@mcp-b/webmcp-polyfill` package and provides an in-app Tool Inspector and manual invocation UI so that a viewer can observe the current `navigator.modelContext` state and trigger tools without an MCP-aware agent.

## Glossary

- **WebMCP_Demo_App**: The Angular 22 (next) application produced by this feature, using standalone components, OnPush change detection, signals, and modern control flow.
- **WebMCP_Runtime**: The browser-exposed `navigator.modelContext` API that registers and invokes WebMCP tools.
- **WebMCP_Polyfill**: The `@mcp-b/webmcp-polyfill` npm package, loaded before application bootstrap to populate `navigator.modelContext` in browsers that lack a native implementation.
- **Global_Tool**: A WebMCP tool registered at the application root via `provideExperimentalWebMcpTools` and available on every route.
- **Route_Scoped_Tool**: A WebMCP tool registered through a route's `providers` array via `provideExperimentalWebMcpTools` and unregistered automatically when the route is left.
- **Service_Scoped_Tool**: A WebMCP tool registered inside an injectable service constructor via `declareExperimentalWebMcpTool` and unregistered when the service is destroyed.
- **Form_Tool**: A WebMCP tool produced by the `experimentalWebMcpTool` option on `form()` from `@angular/forms/signals`.
- **Search_Products_Tool**: The `searchProducts` Global_Tool that returns a filtered product list from an in-memory catalog.
- **Export_Report_Tool**: The `exportReport` Route_Scoped_Tool registered on the `/dashboard` route.
- **Filter_Products_Tool**: The `filterProducts` Route_Scoped_Tool registered on the `/products` route.
- **Cart_Service**: An injectable service that owns cart state and registers the `Get_Cart_Summary_Tool` and `Add_To_Cart_Tool` Service_Scoped_Tools.
- **Get_Cart_Summary_Tool**: The `getCartSummary` Service_Scoped_Tool returning the current cart contents and totals.
- **Add_To_Cart_Tool**: The `addToCart` Service_Scoped_Tool that adds a product to the cart.
- **Contact_Form_Tool**: The `submitContactForm` Form_Tool produced by the contact page's Signal Form.
- **Tool_Inspector**: An in-app debug panel that lists every tool currently registered with the WebMCP_Runtime.
- **Manual_Invoker**: An in-app UI that lets a human viewer call any registered tool with arbitrary JSON arguments and view the structured response.
- **Auto_Cleanup_Router**: The Angular router configured with `withExperimentalAutoCleanupInjectors()` so Route_Scoped_Tools are released on navigation.
- **Structured_Response**: A JSON-serializable object returned from a tool call, containing at minimum a status field and a payload.

## Requirements

### Requirement 1: Application Bootstrap with WebMCP Polyfill and Global Tool

**User Story:** As a viewer running the demo in a regular browser, I want the application to bootstrap with a working WebMCP runtime, so that every demonstrated tool is callable without browser flags.

#### Acceptance Criteria

1. THE WebMCP_Demo_App SHALL load the WebMCP_Polyfill before the Angular application bootstraps.
2. WHEN bootstrap completes, THE WebMCP_Demo_App SHALL register the Search_Products_Tool as a Global_Tool via `provideExperimentalWebMcpTools` in the application providers.
3. THE Search_Products_Tool SHALL accept a `query` string argument and return a Structured_Response containing the matched product list.
4. WHEN the `query` argument is missing or not a string, THE Search_Products_Tool SHALL return a Structured_Response whose status field indicates a validation error.
5. THE WebMCP_Demo_App SHALL configure the Auto_Cleanup_Router by calling `withExperimentalAutoCleanupInjectors()` when providing the router.

### Requirement 2: Route-Scoped Tools with Automatic Cleanup

**User Story:** As a viewer navigating between pages, I want each route to expose its own context-specific tools that disappear when I leave the route, so that I can see how route-scoped registration and auto-cleanup work.

#### Acceptance Criteria

1. WHEN the user navigates to `/dashboard`, THE WebMCP_Demo_App SHALL register the Export_Report_Tool as a Route_Scoped_Tool through the route's `providers` array.
2. WHEN the user navigates away from `/dashboard`, THE Auto_Cleanup_Router SHALL unregister the Export_Report_Tool from the WebMCP_Runtime.
3. WHEN the user navigates to `/products`, THE WebMCP_Demo_App SHALL register the Filter_Products_Tool as a Route_Scoped_Tool through the route's `providers` array.
4. WHEN the user navigates away from `/products`, THE Auto_Cleanup_Router SHALL unregister the Filter_Products_Tool from the WebMCP_Runtime.
5. THE Export_Report_Tool SHALL accept a `format` argument constrained to the values `pdf`, `csv`, and `json`, and SHALL return a Structured_Response describing the generated report.
6. THE Filter_Products_Tool SHALL accept `category` and `maxPrice` arguments and SHALL return a Structured_Response containing the filtered product list.
7. IF a Route_Scoped_Tool receives an argument outside its declared schema, THEN THE Route_Scoped_Tool SHALL return a Structured_Response whose status field indicates a validation error.

### Requirement 3: Service-Lifecycle Tools via `declareExperimentalWebMcpTool`

**User Story:** As a developer studying the demo, I want to see WebMCP tools registered from inside a service constructor, so that I understand how tool lifetime can be tied to an injectable service.

#### Acceptance Criteria

1. THE Cart_Service SHALL register the Get_Cart_Summary_Tool and the Add_To_Cart_Tool by calling `declareExperimentalWebMcpTool` from the service constructor.
2. WHEN the Get_Cart_Summary_Tool is invoked, THE Cart_Service SHALL return a Structured_Response containing the current item list, item count, and total price computed from signal-based state.
3. WHEN the Add_To_Cart_Tool is invoked with a valid `productId` and `quantity`, THE Cart_Service SHALL append the item to the cart state and return a Structured_Response containing the updated cart summary.
4. IF the Add_To_Cart_Tool receives a `productId` that is not in the catalog, THEN THE Cart_Service SHALL return a Structured_Response whose status field indicates a not-found error.
5. IF the Add_To_Cart_Tool receives a non-positive integer `quantity`, THEN THE Cart_Service SHALL return a Structured_Response whose status field indicates a validation error.
6. WHEN the injector that owns the Cart_Service is destroyed, THE WebMCP_Runtime SHALL no longer list the Get_Cart_Summary_Tool or the Add_To_Cart_Tool.

### Requirement 4: Signal Forms WebMCP Integration

**User Story:** As a viewer on the contact page, I want the contact form to be callable as a WebMCP tool with automatic schema inference and validation, so that I can see Signal Forms acting as an AI-callable interface.

#### Acceptance Criteria

1. THE WebMCP_Demo_App SHALL build the contact form using `form()` from `@angular/forms/signals` with the `experimentalWebMcpTool` option populated with a tool name and description.
2. WHEN the contact page is active, THE WebMCP_Runtime SHALL list the Contact_Form_Tool with a schema inferred from the form's signal model.
3. WHEN the Contact_Form_Tool is invoked with values that satisfy every form validator, THE WebMCP_Demo_App SHALL submit the form and return a Structured_Response indicating successful submission.
4. IF the Contact_Form_Tool is invoked with values that fail one or more form validators, THEN THE WebMCP_Demo_App SHALL return a Structured_Response containing the validation errors per field and SHALL NOT submit the form.
5. WHEN the user navigates away from the contact page, THE Auto_Cleanup_Router SHALL unregister the Contact_Form_Tool from the WebMCP_Runtime.

### Requirement 5: Tool Inspector Panel

**User Story:** As a viewer of the demo, I want to see exactly which WebMCP tools are currently registered, so that I can observe how scope and navigation affect the tool registry.

#### Acceptance Criteria

1. THE Tool_Inspector SHALL be visible on every page of the WebMCP_Demo_App.
2. THE Tool_Inspector SHALL list every tool currently registered with the WebMCP_Runtime, showing each tool's name, description, and JSON schema.
3. WHEN a Route_Scoped_Tool, Service_Scoped_Tool, or Form_Tool is registered or unregistered, THE Tool_Inspector SHALL update the displayed list within 500 milliseconds.
4. THE Tool_Inspector SHALL label each tool with its scope category among Global_Tool, Route_Scoped_Tool, Service_Scoped_Tool, and Form_Tool.

### Requirement 6: Manual Tool Invocation UI

**User Story:** As a viewer without an MCP-capable agent, I want to invoke any registered tool from inside the demo with custom arguments, so that I can experience tool calls and inspect their responses.

#### Acceptance Criteria

1. THE Manual_Invoker SHALL allow the user to select any tool listed by the Tool_Inspector.
2. WHEN a tool is selected, THE Manual_Invoker SHALL display an editable JSON argument editor pre-filled with a schema-derived template.
3. WHEN the user submits a tool invocation, THE Manual_Invoker SHALL call the selected tool through `navigator.modelContext` and SHALL display the returned Structured_Response.
4. IF the selected tool is no longer registered at submission time, THEN THE Manual_Invoker SHALL display an error message and SHALL NOT attempt the call.
5. IF the submitted argument string is not valid JSON, THEN THE Manual_Invoker SHALL display a parse error and SHALL NOT attempt the call.

### Requirement 7: Tool Implementation Best Practices

**User Story:** As a developer reading the demo source, I want every tool to follow the article's stated best practices, so that the code serves as a faithful reference implementation.

#### Acceptance Criteria

1. THE WebMCP_Demo_App SHALL define every tool with a name expressed as a verb phrase in lowerCamelCase.
2. THE WebMCP_Demo_App SHALL define every tool with a non-empty human-readable description string.
3. THE WebMCP_Demo_App SHALL declare an explicit JSON schema for every tool's input arguments.
4. WHEN a tool handler receives input, THE tool handler SHALL validate the input against the declared schema before performing any side effect.
5. THE WebMCP_Demo_App SHALL return a Structured_Response from every tool handler, with a status field whose value is `success` or `error` and a payload field containing the result or error details.

### Requirement 8: Tech Stack and Coding Conventions

**User Story:** As a developer evaluating modern Angular, I want the demo to use Angular 22 (next) idioms throughout, so that the code reflects current framework guidance.

#### Acceptance Criteria

1. THE WebMCP_Demo_App SHALL depend on `@angular/core@next`, `@angular/router@next`, `@angular/forms@next`, and `@angular/common@next`.
2. THE WebMCP_Demo_App SHALL use standalone components for every component, directive, and pipe.
3. THE WebMCP_Demo_App SHALL set `changeDetection: ChangeDetectionStrategy.OnPush` on every component.
4. THE WebMCP_Demo_App SHALL express component-local mutable state using signals from `@angular/core`.
5. THE WebMCP_Demo_App SHALL use the `@if`, `@for`, and `@switch` template control flow blocks instead of the `*ngIf`, `*ngFor`, and `*ngSwitch` structural directives.
6. THE WebMCP_Demo_App SHALL declare zero `NgModule` classes.
