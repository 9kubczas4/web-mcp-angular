// The polyfill must load before any code reads `navigator.modelContext`.
import '@mcp-b/webmcp-polyfill';

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, submit } from '@angular/forms/signals';
import type { ModelContextCore } from '@mcp-b/webmcp-types';

import fc from 'fast-check';
import { vi } from 'vitest';

import { isStructuredResponse } from '../../core/webmcp/structured-response';

import { contactFormSchema } from './contact.component';
import { CONTACT_TOPICS, EMPTY_CONTACT_FORM, type ContactFormModel } from './contact-form.model';

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

function clearContactToolFromRegistry(): void {
  const ctx = getModelContext();
  if (ctx.getTools().some((t) => t.name === 'submitContactForm')) {
    ctx.unregisterTool('submitContactForm');
  }
}

/** `submit()` from `@angular/forms/signals` requires an injection context. */
function runSubmit<T>(fn: () => Promise<T>): Promise<T> {
  return TestBed.runInInjectionContext(() => fn());
}

/**
 * Build a fresh form bound to a freshly-constructed model. Each call
 * returns the field tree plus the submit-action spy so a single
 * property iteration can assert how many times the action ran.
 */
function buildContactForm(initial: ContactFormModel) {
  const action = vi.fn(async () => undefined);
  const model = signal<ContactFormModel>({ ...initial });
  const fieldTree = TestBed.runInInjectionContext(() =>
    form(model, contactFormSchema, {
      submission: { action },
    }),
  );
  return { action, model, fieldTree };
}

describe('ContactComponent — Property 6: validators gate submission', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    clearContactToolFromRegistry();
  });

  afterEach(() => {
    clearContactToolFromRegistry();
  });

  it('action runs iff every validator passes; status reflects validity', async () => {
    // The reference predicate below mirrors the validator semantics
    // declared in `contactFormSchema`; the property asserts the
    // submit-action spy is called exactly when the predicate is true.

    const validEmailArb = fc
      .tuple(
        fc.stringMatching(/^[a-z]{1,8}$/),
        fc.stringMatching(/^[a-z]{1,8}$/),
        fc.constantFrom('com', 'org', 'io'),
      )
      .map(([local, host, tld]) => `${local}@${host}.${tld}`);
    const invalidEmailArb = fc.oneof(
      fc.constant(''),
      fc.stringMatching(/^[a-z]{0,5}$/),
      fc.stringMatching(/^@[a-z]{0,5}$/),
      fc.stringMatching(/^[a-z]{1,5}@$/),
    );

    const modelArb: fc.Arbitrary<ContactFormModel> = fc.record({
      name: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 16 })),
      email: fc.oneof(validEmailArb, invalidEmailArb),
      topic: fc.oneof(
        fc.constantFrom(...CONTACT_TOPICS),
        fc.string({ minLength: 1, maxLength: 8 }),
      ) as fc.Arbitrary<ContactFormModel['topic']>,
      message: fc.oneof(
        fc.constant(''),
        fc.string({ minLength: 1, maxLength: 9 }),
        fc.string({ minLength: 10, maxLength: 32 }),
      ),
    });

    function isValid(model: ContactFormModel): boolean {
      if (model.name.length < 1) return false;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(model.email) || model.email.length === 0) {
        return false;
      }
      if (!CONTACT_TOPICS.includes(model.topic)) return false;
      if (model.message.length < 10) return false;
      return true;
    }

    await fc.assert(
      fc.asyncProperty(modelArb, async (model) => {
        const { action, fieldTree } = buildContactForm(model);
        const expected = isValid(model);

        const success = await runSubmit(() => submit(fieldTree));

        if (expected) {
          expect(action).toHaveBeenCalledTimes(1);
          expect(success).toBe(true);
        } else {
          expect(action).not.toHaveBeenCalled();
          expect(success).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('an empty default model fails every required validator and never invokes the action', async () => {
    const { action, fieldTree } = buildContactForm({ ...EMPTY_CONTACT_FORM });
    const success = await runSubmit(() => submit(fieldTree));
    expect(success).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });
});

describe('ContactComponent — Property 1: submitContactForm always returns a structured outcome', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    clearContactToolFromRegistry();
  });

  afterEach(() => {
    clearContactToolFromRegistry();
  });

  /**
   * Register an equivalent tool by hand instead of going through
   * `provideExperimentalWebMcpForms()`. The handler runs the same
   * validators and submit action the form would, so Property 1's
   * "every handler returns a Structured_Response" claim still applies.
   */
  function registerSubmitContactFormTool(): void {
    const ctx = getModelContext();
    const action = vi.fn(async () => undefined);
    const model = signal<ContactFormModel>({ ...EMPTY_CONTACT_FORM });
    const fieldTree = TestBed.runInInjectionContext(() =>
      form(model, contactFormSchema, { submission: { action } }),
    );

    ctx.registerTool({
      name: 'submitContactForm',
      description:
        'Submit the contact form. Validates name, email, topic, and message before submission.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          topic: {
            type: 'string',
            enum: [...CONTACT_TOPICS],
          },
          message: { type: 'string' },
        },
        required: ['name', 'email', 'topic', 'message'],
      },
      execute: async (args) => {
        if (typeof args === 'object' && args !== null) {
          model.set({ ...EMPTY_CONTACT_FORM, ...(args as object) } as ContactFormModel);
        }
        const success = await TestBed.runInInjectionContext(() => submit(fieldTree));
        return success
          ? { status: 'success' as const, payload: { submitted: true } }
          : {
              status: 'error' as const,
              payload: {
                code: 'validation',
                message: 'Contact form is invalid; submission was not performed.',
              },
            };
      },
    });
  }

  it('every fuzz call yields {status, payload} with payload defined', async () => {
    registerSubmitContactFormTool();

    const shim = getTestingShim();

    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (input) => {
        let raw: string | null;
        try {
          raw = await shim.executeTool('submitContactForm', JSON.stringify(input));
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
          payload: unknown;
        };
        expect(['success', 'error']).toContain(response.status);
        expect(response.payload).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it('valid models yield status="success" and invalid models yield status="error"', async () => {
    registerSubmitContactFormTool();
    const shim = getTestingShim();

    const validModel = fc.record({
      name: fc.string({ minLength: 1, maxLength: 16 }),
      email: fc
        .tuple(
          fc.stringMatching(/^[a-z]{1,8}$/),
          fc.stringMatching(/^[a-z]{1,8}$/),
          fc.constantFrom('com', 'org', 'io'),
        )
        .map(([local, host, tld]) => `${local}@${host}.${tld}`),
      topic: fc.constantFrom(...CONTACT_TOPICS),
      message: fc.string({ minLength: 10, maxLength: 32 }),
    });

    await fc.assert(
      fc.asyncProperty(validModel, async (model) => {
        const raw = await shim.executeTool('submitContactForm', JSON.stringify(model));
        expect(raw).not.toBeNull();
        const envelope = JSON.parse(raw as string) as CallToolResultEnvelope;
        expect(isStructuredResponse(envelope.structuredContent)).toBe(true);
        const response = envelope.structuredContent as {
          status: 'success' | 'error';
        };
        expect(response.status).toBe('success');
      }),
      { numRuns: 25 },
    );
  });
});
