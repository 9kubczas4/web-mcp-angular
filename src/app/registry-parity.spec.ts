// The polyfill must load before any code reads `navigator.modelContext`.
import '@mcp-b/webmcp-polyfill';

import { provideLocationMocks } from '@angular/common/testing';
import { EnvironmentInjector, provideExperimentalWebMcpTools } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withExperimentalAutoCleanupInjectors } from '@angular/router';
import type { ModelContextCore } from '@mcp-b/webmcp-types';

import fc from 'fast-check';

import { APP_ROUTES } from './app.routes';
import { CartService } from './core/cart/cart.service';
import { searchProductsTool } from './core/webmcp/global-tools';

// Property 2: After every navigation across `/`, `/products`, `/dashboard`,
// `/cart`, and `/contact`, the set of names in `navigator.modelContext.getTools()`
// is exactly the union of (a) Global_Tool names, (b) Route_Scoped_Tool names
// declared on the active route's `providers`, (c) Service_Scoped_Tool names
// whose owning service injector is still alive, and (d) Form_Tool names
// attached to mounted components.

type DemoRoute = '/' | '/products' | '/dashboard' | '/cart' | '/contact';

const DEMO_ROUTES: readonly DemoRoute[] = [
  '/',
  '/products',
  '/dashboard',
  '/cart',
  '/contact',
] as const;

/**
 * Names contributed by Route_Scoped_Tools on each demo route.
 *
 * `CartService`'s tools (`getCartSummary`, `addToCart`) live in
 * {@link GLOBAL_TOOL_NAMES} below because the service is `providedIn: 'root'`
 * and instantiated eagerly at bootstrap.
 *
 * `submitContactForm` is correctly absent here because this property test
 * navigates the router without mounting components — the form-tool
 * registration only fires when `ContactComponent` is instantiated. The
 * end-to-end integration test mounts components and exercises that path.
 */
const ROUTE_OWNED_TOOL_NAMES: Readonly<Record<DemoRoute, readonly string[]>> = {
  '/': [],
  '/products': ['filterProducts'],
  '/dashboard': ['exportReport'],
  '/cart': [],
  '/contact': [],
};

/** Tools registered for the application's lifetime (global + service-scoped). */
const GLOBAL_TOOL_NAMES: readonly string[] = ['searchProducts', 'getCartSummary', 'addToCart'];

function getModelContext(): ModelContextCore {
  const ctx = (navigator as Navigator & { modelContext?: ModelContextCore }).modelContext;
  if (!ctx) {
    throw new Error('navigator.modelContext is missing');
  }
  return ctx;
}

function setOf(names: Iterable<string>): ReadonlySet<string> {
  return new Set(names);
}

function setEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

describe('Property 2: registry parity over router navigation', () => {
  /**
   * The polyfill's tool registry is module-global. Snapshot whatever is
   * already registered before TestBed runs and union that into every
   * expected set so this test stays hermetic regardless of test order.
   */
  let baselineNames: ReadonlySet<string>;

  beforeEach(() => {
    baselineNames = setOf(
      getModelContext()
        .getTools()
        .map((t) => t.name),
    );

    TestBed.configureTestingModule({
      providers: [
        provideRouter(APP_ROUTES, withExperimentalAutoCleanupInjectors()),
        provideLocationMocks(),
        provideExperimentalWebMcpTools([searchProductsTool]),
      ],
    });

    // Force the environment injector to materialize so the env initializer
    // installed by `provideExperimentalWebMcpTools` registers the global tool.
    TestBed.inject(EnvironmentInjector);

    // Materialize `CartService` so its constructor's
    // `declareExperimentalWebMcpTool` calls register the service-scoped
    // tools, mirroring the eager `provideAppInitializer` hook in
    // `app.config.ts`.
    TestBed.inject(CartService);

    const names = setOf(
      getModelContext()
        .getTools()
        .map((t) => t.name),
    );
    expect(names.has('searchProducts')).toBe(true);
    expect(names.has('getCartSummary')).toBe(true);
    expect(names.has('addToCart')).toBe(true);
  });

  afterEach(async () => {
    try {
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/');
    } catch {
      const ctx = (navigator as Navigator & { modelContext?: ModelContextCore }).modelContext;
      for (const name of ['filterProducts', 'exportReport']) {
        if (ctx?.getTools().some((t) => t.name === name)) {
          ctx.unregisterTool(name);
        }
      }
    }
  });

  it('after every navigation in any sequence, getTools() equals the expected union', async () => {
    const router = TestBed.inject(Router);
    const ctx = getModelContext();

    const routeArb = fc.array(fc.constantFrom(...DEMO_ROUTES), {
      minLength: 1,
      maxLength: 8,
    });

    await fc.assert(
      fc.asyncProperty(routeArb, async (sequence) => {
        for (const target of sequence) {
          await router.navigateByUrl(target);

          const actualNames = setOf(ctx.getTools().map((t) => t.name));

          const expectedNames = new Set<string>(baselineNames);
          for (const name of GLOBAL_TOOL_NAMES) expectedNames.add(name);
          for (const name of ROUTE_OWNED_TOOL_NAMES[target]) {
            expectedNames.add(name);
          }

          if (!setEqual(actualNames, expectedNames)) {
            throw new Error(
              `Registry parity violation after navigating to ${target}. ` +
                `Expected ${JSON.stringify([...expectedNames].sort())}, ` +
                `got ${JSON.stringify([...actualNames].sort())}.`,
            );
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
