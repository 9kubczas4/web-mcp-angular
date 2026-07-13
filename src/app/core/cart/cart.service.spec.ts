// The polyfill must load before any code reads `navigator.modelContext`.
import '@mcp-b/webmcp-polyfill';

import { EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ModelContextCore } from '@mcp-b/webmcp-types';

import fc from 'fast-check';

import { SEED_PRODUCTS } from '../catalog/product';
import { isStructuredResponse } from '../webmcp/structured-response';

import { CartService } from './cart.service';
import type { CartSummary } from './cart-line';

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
 * Build a `CartService` instance whose lifetime is tied to a fresh child
 * environment injector. Destroying the injector fires the AbortSignal
 * that `declareExperimentalWebMcpTool` uses to unregister tools — the
 * exact lifecycle Property 3 measures.
 */
function createScopedCartService(): {
  cart: CartService;
  injector: EnvironmentInjector;
} {
  const parent = TestBed.inject(EnvironmentInjector);
  const injector = createEnvironmentInjector([CartService], parent);
  const cart = injector.get(CartService);
  return { cart, injector };
}

const CART_TOOL_NAMES = ['getCartSummary', 'addToCart'] as const;

function hasTool(name: string): boolean {
  return getModelContext()
    .getTools()
    .some((t) => t.name === name);
}

/**
 * Defensively unregister both cart tools if they're still in the
 * polyfill's registry. The registry is module-global, so a leftover
 * registration would conflict with the next test's child-injector
 * registration.
 */
function clearCartToolsFromRegistry(): void {
  const ctx = getModelContext();
  for (const name of CART_TOOL_NAMES) {
    if (hasTool(name)) {
      ctx.unregisterTool(name);
    }
  }
}

describe('CartService — Property 5: addToCart mutates state only on valid input', () => {
  let scoped: { cart: CartService; injector: EnvironmentInjector };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    clearCartToolsFromRegistry();
    scoped = createScopedCartService();
  });

  afterEach(() => {
    scoped.injector.destroy();
    clearCartToolsFromRegistry();
  });

  it('changes state iff productId is in the catalog AND quantity is a positive integer', () => {
    const catalogIds = SEED_PRODUCTS.map((p) => p.id);

    const productIdArb = fc.oneof(fc.constantFrom(...catalogIds), fc.string());

    const quantityArb = fc.oneof(
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ max: 0 }),
      fc.double({ noNaN: false }),
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
      fc.string(),
      fc.constantFrom(null, true, false),
    );

    fc.assert(
      fc.property(productIdArb, quantityArb, (productId, quantity) => {
        const before = JSON.stringify(scoped.cart.snapshot());
        const response = scoped.cart.addToCartHandler({ productId, quantity });
        const after = JSON.stringify(scoped.cart.snapshot());

        const productExists = catalogIds.includes(productId);
        const quantityIsPositiveInteger =
          typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 1;
        const expectSuccess = productExists && quantityIsPositiveInteger;

        if (expectSuccess) {
          expect(response.status).toBe('success');
        } else {
          expect(response.status).toBe('error');
          expect(after).toBe(before);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('persists every successful add: snapshot encodes the running totals', () => {
    interface Add {
      readonly productId: string;
      readonly quantity: number;
    }

    const validAdd: fc.Arbitrary<Add> = fc.record({
      productId: fc.constantFrom(...SEED_PRODUCTS.map((p) => p.id)),
      quantity: fc.integer({ min: 1, max: 4 }),
    });

    const sequence = fc.array(validAdd, { minLength: 0, maxLength: 10 });

    fc.assert(
      fc.property(sequence, (adds) => {
        // Always start from an empty cart so each shrunken sequence is
        // self-contained.
        scoped.injector.destroy();
        clearCartToolsFromRegistry();
        scoped = createScopedCartService();

        const reference = new Map<string, { quantity: number; price: number; name: string }>();
        for (const add of adds) {
          const product = SEED_PRODUCTS.find((p) => p.id === add.productId)!;
          const existing = reference.get(add.productId);
          reference.set(add.productId, {
            name: product.name,
            price: product.price,
            quantity: (existing?.quantity ?? 0) + add.quantity,
          });

          const response = scoped.cart.addToCartHandler(add);
          expect(response.status).toBe('success');
        }

        const snapshot = scoped.cart.snapshot();
        const expectedItemCount = [...reference.values()].reduce((n, line) => n + line.quantity, 0);
        const expectedTotal = [...reference.values()].reduce(
          (n, line) => n + line.quantity * line.price,
          0,
        );
        expect(snapshot.itemCount).toBe(expectedItemCount);
        expect(snapshot.total).toBeCloseTo(expectedTotal, 6);
        expect(snapshot.items.length).toBe(reference.size);
        for (const item of snapshot.items) {
          const ref = reference.get(item.productId);
          expect(ref).toBeDefined();
          expect(item.quantity).toBe(ref!.quantity);
          expect(item.price).toBe(ref!.price);
        }
      }),
      { numRuns: 50 },
    );
  });
});

describe('CartService — Property 1: cart tools always return a Structured_Response', () => {
  let scoped: { cart: CartService; injector: EnvironmentInjector };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    clearCartToolsFromRegistry();
    scoped = createScopedCartService();
    expect(hasTool('getCartSummary')).toBe(true);
    expect(hasTool('addToCart')).toBe(true);
  });

  afterEach(() => {
    scoped.injector.destroy();
    clearCartToolsFromRegistry();
  });

  it('getCartSummary fuzz — every call yields {status, payload} with payload defined', async () => {
    const shim = getTestingShim();

    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (input) => {
        let raw: string | null;
        try {
          raw = await shim.executeTool('getCartSummary', JSON.stringify(input));
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

  it('addToCart fuzz — every call yields {status, payload} with payload defined', async () => {
    const shim = getTestingShim();

    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (input) => {
        let raw: string | null;
        try {
          raw = await shim.executeTool('addToCart', JSON.stringify(input));
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

  it('valid addToCart args yield status="success" and a CartSummary payload', async () => {
    const shim = getTestingShim();

    const validArgs = fc.record({
      productId: fc.constantFrom(...SEED_PRODUCTS.map((p) => p.id)),
      quantity: fc.integer({ min: 1, max: 3 }),
    });

    await fc.assert(
      fc.asyncProperty(validArgs, async (args) => {
        const raw = await shim.executeTool('addToCart', JSON.stringify(args));
        expect(raw).not.toBeNull();
        const envelope = JSON.parse(raw as string) as CallToolResultEnvelope;
        expect(isStructuredResponse(envelope.structuredContent)).toBe(true);
        const response = envelope.structuredContent as {
          status: 'success' | 'error';
          payload: CartSummary;
        };
        expect(response.status).toBe('success');
        expect(typeof response.payload.itemCount).toBe('number');
        expect(typeof response.payload.total).toBe('number');
        expect(Array.isArray(response.payload.items)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});

describe('CartService — Property 3: service-injector destruction unregisters service tools', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    clearCartToolsFromRegistry();
  });

  afterEach(() => {
    clearCartToolsFromRegistry();
  });

  it('after destroy, getCartSummary and addToCart are absent from the registry', () => {
    const { injector } = createScopedCartService();
    expect(hasTool('getCartSummary')).toBe(true);
    expect(hasTool('addToCart')).toBe(true);

    injector.destroy();

    expect(hasTool('getCartSummary')).toBe(false);
    expect(hasTool('addToCart')).toBe(false);
  });

  it('repeated create-then-destroy cycles always end with the tools unregistered', () => {
    // The polyfill's registry rejects duplicate names, so each cycle MUST
    // destroy its injector before the next cycle creates one. Sequential
    // execution is what enforces that schedule.
    const cycles = fc.integer({ min: 1, max: 8 });

    fc.assert(
      fc.property(cycles, (n) => {
        for (let i = 0; i < n; i++) {
          const { injector } = createScopedCartService();
          expect(hasTool('getCartSummary')).toBe(true);
          expect(hasTool('addToCart')).toBe(true);
          injector.destroy();
          expect(hasTool('getCartSummary')).toBe(false);
          expect(hasTool('addToCart')).toBe(false);
        }
      }),
      { numRuns: 25 },
    );
  });

  it("destroying one injector leaves a sibling injector's tools intact, then both are gone", () => {
    // The polyfill rejects duplicate-name registrations, so this is the
    // *sequenced* version: destroy A, then create B, then destroy B.
    const a = createScopedCartService();
    expect(hasTool('getCartSummary')).toBe(true);
    a.injector.destroy();
    expect(hasTool('getCartSummary')).toBe(false);

    const b = createScopedCartService();
    expect(hasTool('getCartSummary')).toBe(true);
    b.injector.destroy();
    expect(hasTool('getCartSummary')).toBe(false);
  });
});
