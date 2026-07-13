// The polyfill must load before any code reads `navigator.modelContext`.
import '@mcp-b/webmcp-polyfill';

import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withExperimentalAutoCleanupInjectors } from '@angular/router';
import type { ModelContextCore } from '@mcp-b/webmcp-types';

import fc from 'fast-check';

import { APP_ROUTES } from '../../app.routes';
import { isStructuredResponse } from '../../core/webmcp/structured-response';

interface ModelContextTestingShim {
  executeTool(toolName: string, inputArgsJson: string): Promise<string | null>;
}

interface CallToolResultEnvelope {
  readonly content: readonly { readonly type: string; readonly text?: string }[];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}

function getTestingShim(): ModelContextTestingShim {
  const shim = (navigator as Navigator & { modelContextTesting?: ModelContextTestingShim })
    .modelContextTesting;
  if (!shim) {
    throw new Error('navigator.modelContextTesting was not installed by @mcp-b/webmcp-polyfill');
  }
  return shim;
}

function getModelContext(): ModelContextCore {
  const ctx = (navigator as Navigator & { modelContext?: ModelContextCore }).modelContext;
  if (!ctx) {
    throw new Error('navigator.modelContext is missing');
  }
  return ctx;
}

describe('Property 1: exportReport always returns a Structured_Response', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(APP_ROUTES, withExperimentalAutoCleanupInjectors()),
        provideLocationMocks(),
      ],
    });

    const ctx = getModelContext();
    if (ctx.getTools().some((t) => t.name === 'exportReport')) {
      ctx.unregisterTool('exportReport');
    }

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');

    expect(ctx.getTools().some((t) => t.name === 'exportReport')).toBe(true);
  });

  afterEach(async () => {
    try {
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/');
    } catch {
      const ctx = (navigator as Navigator & { modelContext?: ModelContextCore }).modelContext;
      if (ctx?.getTools().some((t) => t.name === 'exportReport')) {
        ctx.unregisterTool('exportReport');
      }
    }
  });

  it('every call yields a structured outcome (success or error) with a defined payload', async () => {
    const shim = getTestingShim();

    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (input) => {
        let raw: string | null;
        try {
          raw = await shim.executeTool('exportReport', JSON.stringify(input));
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

  it('rejects non-enum / missing / out-of-shape inputs without success', async () => {
    const shim = getTestingShim();

    const invalidArgs = fc.oneof(
      fc.record({}),
      fc.record({
        format: fc.string().filter((s) => !['pdf', 'csv', 'json'].includes(s)),
      }),
      fc.record({ format: fc.integer() }),
      fc.record({
        format: fc.constantFrom('pdf', 'csv', 'json'),
        extra: fc.jsonValue(),
      }),
    );

    await fc.assert(
      fc.asyncProperty(invalidArgs, async (args) => {
        let raw: string | null;
        try {
          raw = await shim.executeTool('exportReport', JSON.stringify(args));
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

  it('accepts every valid enum member with status="success" and the documented payload shape', async () => {
    const shim = getTestingShim();

    const validArgs = fc.record({
      format: fc.constantFrom('pdf', 'csv', 'json'),
    });

    await fc.assert(
      fc.asyncProperty(validArgs, async (args) => {
        const raw = await shim.executeTool('exportReport', JSON.stringify(args));
        expect(raw).not.toBeNull();
        const envelope = JSON.parse(raw as string) as CallToolResultEnvelope;
        expect(isStructuredResponse(envelope.structuredContent)).toBe(true);
        const response = envelope.structuredContent as {
          status: 'success' | 'error';
          payload: {
            format?: unknown;
            rows?: unknown;
            generatedAt?: unknown;
            code?: unknown;
            message?: unknown;
          };
        };
        expect(response.status).toBe('success');
        expect(response.payload.format).toBe(args.format);
        expect(response.payload.rows).toBe(42);
        expect(typeof response.payload.generatedAt).toBe('string');
        expect(Number.isFinite(Date.parse(response.payload.generatedAt as string))).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
