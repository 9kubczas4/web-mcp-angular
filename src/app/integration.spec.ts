// The polyfill must load before any code reads `navigator.modelContext`.
import '@mcp-b/webmcp-polyfill';

import { provideLocationMocks } from '@angular/common/testing';
import {
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  provideExperimentalWebMcpTools,
} from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideExperimentalWebMcpForms } from '@angular/forms/signals';
import {
  Router,
  RouterOutlet,
  provideRouter,
  withExperimentalAutoCleanupInjectors,
} from '@angular/router';
import type { ModelContextCore } from '@mcp-b/webmcp-types';

import { APP_ROUTES } from './app.routes';
import { CartService } from './core/cart/cart.service';
import { searchProductsTool } from './core/webmcp/global-tools';
import { isStructuredResponse } from './core/webmcp/structured-response';

// End-to-end integration smoke counterpart to the property test in
// `registry-parity.spec.ts`. Where that file deliberately *avoids* mounting
// components in order to keep the property hermetic, this file mounts the
// active route's component on every navigation so the `submitContactForm`
// Form_Tool — which only registers when `ContactComponent` is instantiated
// — actually appears in `navigator.modelContext` while `/contact` is active.

interface ModelContextTestingShim {
  executeTool(toolName: string, inputArgsJson: string): Promise<string | null>;
}

interface CallToolResultEnvelope {
  readonly content: readonly { readonly type: string; readonly text?: string }[];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}

function getModelContext(): ModelContextCore {
  const ctx = (navigator as Navigator & { modelContext?: ModelContextCore }).modelContext;
  if (!ctx) {
    throw new Error('navigator.modelContext is missing');
  }
  return ctx;
}

function getTestingShim(): ModelContextTestingShim {
  const shim = (navigator as Navigator & { modelContextTesting?: ModelContextTestingShim })
    .modelContextTesting;
  if (!shim) {
    throw new Error('navigator.modelContextTesting was not installed by @mcp-b/webmcp-polyfill');
  }
  return shim;
}

/**
 * Invoke a tool through the polyfill's testing shim and return the
 * `StructuredResponse` carried in the envelope's `structuredContent`.
 */
async function invokeTool(
  name: string,
  args: unknown,
): Promise<{
  readonly status: 'success' | 'error';
  readonly payload: unknown;
}> {
  const raw = await getTestingShim().executeTool(name, JSON.stringify(args));
  expect(raw).not.toBeNull();
  const envelope = JSON.parse(raw as string) as CallToolResultEnvelope;
  expect(Array.isArray(envelope.content)).toBe(true);
  expect(isStructuredResponse(envelope.structuredContent)).toBe(true);
  return envelope.structuredContent as { status: 'success' | 'error'; payload: unknown };
}

function actualToolNames(): ReadonlySet<string> {
  return new Set(
    getModelContext()
      .getTools()
      .map((t) => t.name),
  );
}

function setEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

/**
 * Hosted root harness component. Renders a `<router-outlet />` so router
 * navigation actually instantiates the lazy-loaded page components —
 * including `ContactComponent`, whose `form()` call is what registers
 * `submitContactForm` with `navigator.modelContext`.
 */
@Component({
  selector: 'app-test-router-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
class RouterShellHost {}

const ALWAYS_ON_NAMES: readonly string[] = ['searchProducts', 'getCartSummary', 'addToCart'];

/**
 * Tools whose presence depends on the active route. `/contact` includes
 * `submitContactForm` because this test mounts components on every
 * navigation, which triggers the form-tool registration.
 */
const ROUTE_OWNED_NAMES: Readonly<Record<string, readonly string[]>> = {
  '/': [],
  '/products': ['filterProducts'],
  '/dashboard': ['exportReport'],
  '/cart': [],
  '/contact': ['submitContactForm'],
};

function defensivelyClearRouteOwnedTools(): void {
  const ctx = (navigator as Navigator & { modelContext?: ModelContextCore }).modelContext;
  if (!ctx) {
    return;
  }
  for (const name of ['filterProducts', 'exportReport', 'submitContactForm']) {
    if (ctx.getTools().some((t) => t.name === name)) {
      ctx.unregisterTool(name);
    }
  }
}

describe('Integration — full WebMCP tool surface across navigation', () => {
  /** Snapshot of names registered by other spec files; unioned into every expected set. */
  let baselineNames: ReadonlySet<string>;
  let fixture: ComponentFixture<RouterShellHost>;

  beforeEach(async () => {
    baselineNames = new Set(
      getModelContext()
        .getTools()
        .map((t) => t.name),
    );

    TestBed.configureTestingModule({
      providers: [
        provideRouter(APP_ROUTES, withExperimentalAutoCleanupInjectors()),
        provideLocationMocks(),
        provideExperimentalWebMcpTools([searchProductsTool]),
        provideExperimentalWebMcpForms(),
      ],
    });

    TestBed.inject(EnvironmentInjector);
    TestBed.inject(CartService);

    fixture = TestBed.createComponent(RouterShellHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(async () => {
    try {
      await TestBed.inject(Router).navigateByUrl('/');
      fixture.detectChanges();
      await fixture.whenStable();
    } catch {
      // TestBed may already be torn down; fall through to manual cleanup.
    }
    defensivelyClearRouteOwnedTools();
  });

  /**
   * Drive a navigation, then push the harness fixture through change
   * detection and wait for the lazy load + component mount to settle.
   * A second pass picks up effects scheduled during the first stabilization
   * window without depending on `flush()`/fake-async semantics.
   */
  async function navigateAndStabilize(path: string): Promise<void> {
    await TestBed.inject(Router).navigateByUrl(path);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function expectedToolsFor(path: string): ReadonlySet<string> {
    const set = new Set<string>(baselineNames);
    for (const name of ALWAYS_ON_NAMES) {
      set.add(name);
    }
    for (const name of ROUTE_OWNED_NAMES[path] ?? []) {
      set.add(name);
    }
    return set;
  }

  function assertRegistryAt(path: string): void {
    const actual = actualToolNames();
    const expected = expectedToolsFor(path);
    if (!setEqual(actual, expected)) {
      throw new Error(
        `Registry parity violation at ${path}. ` +
          `Expected ${JSON.stringify([...expected].sort())}, ` +
          `got ${JSON.stringify([...actual].sort())}.`,
      );
    }
  }

  it('exercises the navigation churn / → /products → /dashboard → /cart → /contact → / and asserts registry parity at every step', async () => {
    const churn: readonly string[] = ['/', '/products', '/dashboard', '/cart', '/contact', '/'];
    for (const target of churn) {
      await navigateAndStabilize(target);
      assertRegistryAt(target);
    }
  });

  it('searchProducts (global) is callable on every route in the churn', async () => {
    const churn = ['/', '/products', '/dashboard', '/cart', '/contact'];
    for (const target of churn) {
      await navigateAndStabilize(target);
      const response = await invokeTool('searchProducts', { query: 'audio' });
      expect(response.status).toBe('success');
      const payload = response.payload as { matches: readonly unknown[] };
      expect(Array.isArray(payload.matches)).toBe(true);
    }
  });

  it('getCartSummary and addToCart (service-scoped) are callable on every route in the churn', async () => {
    const churn = ['/', '/products', '/dashboard', '/cart', '/contact'];
    for (const target of churn) {
      await navigateAndStabilize(target);

      const summary = await invokeTool('getCartSummary', {});
      expect(summary.status).toBe('success');
      const summaryPayload = summary.payload as {
        items: readonly unknown[];
        itemCount: number;
        total: number;
      };
      expect(Array.isArray(summaryPayload.items)).toBe(true);
      expect(typeof summaryPayload.itemCount).toBe('number');
      expect(typeof summaryPayload.total).toBe('number');

      const add = await invokeTool('addToCart', { productId: 'aud-001', quantity: 1 });
      expect(add.status).toBe('success');
    }
  });

  it('filterProducts (route-scoped) is callable on /products and absent off-route', async () => {
    await navigateAndStabilize('/products');
    expect(actualToolNames().has('filterProducts')).toBe(true);
    const response = await invokeTool('filterProducts', { category: 'audio' });
    expect(response.status).toBe('success');
    const payload = response.payload as { matches: readonly unknown[] };
    expect(Array.isArray(payload.matches)).toBe(true);

    await navigateAndStabilize('/');
    expect(actualToolNames().has('filterProducts')).toBe(false);
  });

  it('exportReport (route-scoped) is callable on /dashboard and absent off-route', async () => {
    await navigateAndStabilize('/dashboard');
    expect(actualToolNames().has('exportReport')).toBe(true);
    const response = await invokeTool('exportReport', { format: 'pdf' });
    expect(response.status).toBe('success');
    const payload = response.payload as { format: string; rows: number };
    expect(payload.format).toBe('pdf');
    expect(payload.rows).toBe(42);

    await navigateAndStabilize('/');
    expect(actualToolNames().has('exportReport')).toBe(false);
  });

  it('submitContactForm (form-scoped) is registered on /contact, accepts valid input, and unregisters on navigation away', async () => {
    await navigateAndStabilize('/contact');
    expect(actualToolNames().has('submitContactForm')).toBe(true);

    // The Signal Forms runtime doesn't wrap the submit-action result in
    // our local `StructuredResponse` envelope; the unit-level gating
    // between valid and invalid input is covered by the contact-form
    // property tests. Here we only assert (a) the tool is registered
    // while `/contact` is active, (b) invoking it with valid input
    // produces a non-error envelope, and (c) it disappears on
    // navigation away.
    const raw = await getTestingShim().executeTool(
      'submitContactForm',
      JSON.stringify({
        name: 'Alice',
        email: 'a@b.co',
        topic: 'support',
        message: 'Hello world ten chars',
      }),
    );
    expect(raw).not.toBeNull();
    const envelope = JSON.parse(raw as string) as CallToolResultEnvelope;
    expect(Array.isArray(envelope.content)).toBe(true);
    expect(envelope.isError ?? false).toBe(false);

    await navigateAndStabilize('/');
    expect(actualToolNames().has('submitContactForm')).toBe(false);
  });
});
