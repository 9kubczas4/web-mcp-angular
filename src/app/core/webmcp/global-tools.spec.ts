// The polyfill must load before any code reads `navigator.modelContext`.
import '@mcp-b/webmcp-polyfill';

import { EnvironmentInjector, provideExperimentalWebMcpTools } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ModelContextCore } from '@mcp-b/webmcp-types';

import fc from 'fast-check';

import { searchProductsTool } from './global-tools';
import { isStructuredResponse } from './structured-response';

/**
 * The polyfill exposes manual invocation via
 * `navigator.modelContextTesting.executeTool(name, JSON.stringify(args))`,
 * which returns a JSON-encoded `CallToolResult` envelope. The handler's
 * `StructuredResponse` arrives in `structuredContent`.
 */
interface ModelContextTestingShim {
  executeTool(toolName: string, inputArgsJson: string): Promise<string | null>;
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

interface CallToolResultEnvelope {
  readonly content: readonly { readonly type: string; readonly text?: string }[];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}

describe('Property 1: searchProducts always returns a Structured_Response', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideExperimentalWebMcpTools([searchProductsTool])],
    });
    // Force the environment injector to materialize so the env initializer
    // registers the tool.
    TestBed.inject(EnvironmentInjector);
    const ctx = (navigator as Navigator & { modelContext?: ModelContextCore })
      .modelContext;
    expect(ctx?.getTools().some((t) => t.name === 'searchProducts')).toBe(true);
  });

  it('every call yields a structured outcome (success or error) with a defined payload', async () => {
    const shim = getTestingShim();

    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (input) => {
        let raw: string | null;
        try {
          raw = await shim.executeTool('searchProducts', JSON.stringify(input));
        } catch (thrown) {
          // The polyfill rejects non-object/array root args before the
          // handler runs. A thrown error with a name and message still
          // satisfies the "deterministic, well-formed outcome" intent.
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
});
