// The polyfill must load before any code reads `navigator.modelContext`.
import '@mcp-b/webmcp-polyfill';

import { provideLocationMocks } from '@angular/common/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter, withExperimentalAutoCleanupInjectors } from '@angular/router';
import type { ModelContextCore } from '@mcp-b/webmcp-types';

import fc from 'fast-check';

import { APP_ROUTES } from '../../app.routes';
import { isStructuredResponse } from '../../core/webmcp/structured-response';
import { ProductsFilterService } from './products-filter.service';
import { ProductsComponent } from './products.component';

@Component({
  selector: 'app-test-router-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
class RouterShellHost {}

interface ModelContextTestingShim {
  executeTool(toolName: string, inputArgsJson: string): Promise<string | null>;
}

interface CallToolResultEnvelope {
  readonly content: readonly { readonly type: string; readonly text?: string }[];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}

function getTestingShim(): ModelContextTestingShim {
  const shim = (
    navigator as Navigator & { modelContextTesting?: ModelContextTestingShim }
  ).modelContextTesting;
  if (!shim) {
    throw new Error(
      'navigator.modelContextTesting was not installed by @mcp-b/webmcp-polyfill',
    );
  }
  return shim;
}

function getModelContext(): ModelContextCore {
  const ctx = (navigator as Navigator & { modelContext?: ModelContextCore })
    .modelContext;
  if (!ctx) {
    throw new Error('navigator.modelContext is missing');
  }
  return ctx;
}

describe('Property 1: filterProducts always returns a Structured_Response', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(APP_ROUTES, withExperimentalAutoCleanupInjectors()),
        provideLocationMocks(),
      ],
    });

    // The polyfill's tool registry is module-global, so a registration
    // from a previous test that didn't deactivate cleanly can linger.
    const ctx = getModelContext();
    if (ctx.getTools().some((t) => t.name === 'filterProducts')) {
      ctx.unregisterTool('filterProducts');
    }

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/products');

    expect(ctx.getTools().some((t) => t.name === 'filterProducts')).toBe(true);
  });

  afterEach(async () => {
    try {
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/');
    } catch {
      const ctx = (navigator as Navigator & { modelContext?: ModelContextCore })
        .modelContext;
      if (ctx?.getTools().some((t) => t.name === 'filterProducts')) {
        ctx.unregisterTool('filterProducts');
      }
    }
  });

  it('every call yields a structured outcome (success or error) with a defined payload', async () => {
    const shim = getTestingShim();

    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (input) => {
        let raw: string | null;
        try {
          raw = await shim.executeTool(
            'filterProducts',
            JSON.stringify(input),
          );
        } catch (thrown) {
          const e = thrown as { name?: unknown; message?: unknown };
          expect(typeof e.name).toBe('string');
          expect(typeof e.message).toBe('string');
          return;
        }

        expect(raw).not.toBeNull();
        const envelope = JSON.parse(raw as string) as CallToolResultEnvelope;
        expect(Array.isArray(envelope.content)).toBe(true);

        expect(isStructuredResponse(envelope.structuredContent)).toBe(true);
        const response = envelope.structuredContent as {
          status: 'success' | 'error';
          payload: unknown;
        };
        expect(['success', 'error']).toContain(response.status);
        expect(response.payload).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it('rejects out-of-schema inputs (extras / wrong types / out-of-range maxPrice) without success', async () => {
    const shim = getTestingShim();

    // Every branch uses `fc.jsonValue()` or a defined primitive so the
    // schema-violating key survives `JSON.stringify`.
    const invalidArgs = fc.oneof(
      fc.record({ extra: fc.jsonValue() }),
      fc.record({
        category: fc
          .string()
          .filter(
            (s) => !['audio', 'wearable', 'home', 'office'].includes(s),
          ),
      }),
      fc.record({ category: fc.integer() }),
      fc.record({ maxPrice: fc.integer({ max: -1 }) }),
      fc.record({ maxPrice: fc.string() }),
    );

    await fc.assert(
      fc.asyncProperty(invalidArgs, async (args) => {
        // Two acceptable failure modes: the polyfill's strict mode
        // rejects the args before the handler runs and throws, or the
        // handler returns `status: 'error'`. Both satisfy
        // "validate before any side effect".
        let raw: string | null;
        try {
          raw = await shim.executeTool(
            'filterProducts',
            JSON.stringify(args),
          );
        } catch (thrown) {
          const e = thrown as { name?: unknown; message?: unknown };
          expect(typeof e.name).toBe('string');
          expect(typeof e.message).toBe('string');
          return;
        }
        expect(raw).not.toBeNull();
        const envelope = JSON.parse(raw as string) as CallToolResultEnvelope;
        expect(isStructuredResponse(envelope.structuredContent)).toBe(true);
        const response = envelope.structuredContent as {
          status: 'success' | 'error';
        };
        expect(response.status).toBe('error');
      }),
      { numRuns: 100 },
    );
  });

  it('accepts valid inputs (omitted, partial, complete) with status="success" and a matches array', async () => {
    const shim = getTestingShim();

    const validArgs = fc.record(
      {
        category: fc.constantFrom('audio', 'wearable', 'home', 'office'),
        maxPrice: fc.double({ min: 0, max: 1000, noNaN: true }),
      },
      { requiredKeys: [] },
    );

    await fc.assert(
      fc.asyncProperty(validArgs, async (args) => {
        const raw = await shim.executeTool(
          'filterProducts',
          JSON.stringify(args),
        );
        expect(raw).not.toBeNull();
        const envelope = JSON.parse(raw as string) as CallToolResultEnvelope;
        expect(isStructuredResponse(envelope.structuredContent)).toBe(true);
        const response = envelope.structuredContent as {
          status: 'success' | 'error';
          payload: { matches?: unknown };
        };
        expect(response.status).toBe('success');
        expect(Array.isArray(response.payload.matches)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('updates ProductsFilterService state so the UI reflects tool-driven filters', async () => {
    const shim = getTestingShim();
    const fixture: ComponentFixture<RouterShellHost> =
      TestBed.createComponent(RouterShellHost);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/products');
    fixture.detectChanges();
    await fixture.whenStable();

    const productsDe = fixture.debugElement.query(By.directive(ProductsComponent));
    expect(productsDe).not.toBeNull();
    const filterService = productsDe!.injector.get(ProductsFilterService);

    expect(filterService.maxPrice()).toBeNull();
    expect(filterService.visibleProducts().length).toBe(8);

    const raw = await shim.executeTool(
      'filterProducts',
      JSON.stringify({ maxPrice: 100 }),
    );
    expect(raw).not.toBeNull();
    const envelope = JSON.parse(raw as string) as CallToolResultEnvelope;
    expect(isStructuredResponse(envelope.structuredContent)).toBe(true);
    const response = envelope.structuredContent as {
      status: 'success' | 'error';
      payload: { matches?: { id: string }[] };
    };
    expect(response.status).toBe('success');
    expect(response.payload.matches?.map((p) => p.id).sort()).toEqual([
      'aud-002',
      'hom-001',
    ]);

    expect(filterService.maxPrice()).toBe(100);
    expect(filterService.category()).toBeNull();
    expect(filterService.visibleProducts().map((p) => p.id).sort()).toEqual([
      'aud-002',
      'hom-001',
    ]);
  });
});
