import {
  Injectable,
  computed,
  declareExperimentalWebMcpTool,
  inject,
  signal,
  type Signal,
} from '@angular/core';

import { ProductService } from '../catalog/product.service';
import { err, ok, type StructuredResponse } from '../webmcp/structured-response';
import type { JsonSchema } from '../webmcp/tool-descriptor';
import { validate } from '../webmcp/validate';

import type { CartLine, CartSummary } from './cart-line';

const GET_CART_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const satisfies JsonSchema;

const ADD_TO_CART_SCHEMA = {
  type: 'object',
  required: ['productId', 'quantity'],
  properties: {
    productId: { type: 'string' },
    quantity: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

interface AddToCartArgs {
  readonly productId: string;
  readonly quantity: number;
}

/**
 * Cart owner and source of the demo's Service_Scoped_Tools.
 *
 * `providedIn: 'root'` gives the application a single instance, but the
 * tool registrations happen inside the constructor's injection context.
 * A manually created child injector
 * (`Injector.create({ providers: [CartService], parent })`) gets its own
 * instance whose tool registrations live for that injector's lifetime.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly products = inject(ProductService);

  private readonly _items = signal<readonly CartLine[]>([]);

  readonly items: Signal<readonly CartLine[]> = this._items.asReadonly();

  readonly itemCount = computed(() => this._items().reduce((n, line) => n + line.quantity, 0));

  readonly total = computed(() =>
    this._items().reduce((n, line) => n + line.quantity * line.price, 0),
  );

  constructor() {
    declareExperimentalWebMcpTool({
      name: 'getCartSummary',
      description: 'Return the current cart line items, item count, and total price.',
      inputSchema: GET_CART_SUMMARY_SCHEMA,
      execute: (): StructuredResponse => ok(this.snapshot()),
    });

    declareExperimentalWebMcpTool({
      name: 'addToCart',
      description: 'Add a product to the cart by catalog id and positive integer quantity.',
      inputSchema: ADD_TO_CART_SCHEMA,
      execute: (args): StructuredResponse => this.addToCartHandler(args),
    });
  }

  snapshot(): CartSummary {
    return {
      items: this._items(),
      itemCount: this.itemCount(),
      total: this.total(),
    };
  }

  /**
   * Validate-and-mutate handler shared by the `addToCart` tool. Accepts
   * `unknown` so property tests can drive it with arbitrary inputs.
   * Mutation only happens when the schema check passes AND the product
   * exists.
   */
  addToCartHandler(args: unknown): StructuredResponse {
    const result = validate(args, ADD_TO_CART_SCHEMA);
    if (!result.ok) {
      return err('validation', result.message, result.details);
    }

    const { productId, quantity } = args as AddToCartArgs;

    const product = this.products.findById(productId);
    if (!product) {
      return err('not_found', `Product not found: ${productId}`, { productId });
    }

    const current = this._items();
    const existingIndex = current.findIndex((line) => line.productId === productId);
    if (existingIndex >= 0) {
      const updated = current.map((line, index) =>
        index === existingIndex ? { ...line, quantity: line.quantity + quantity } : line,
      );
      this._items.set(updated);
    } else {
      const newLine: CartLine = {
        productId,
        name: product.name,
        price: product.price,
        quantity,
      };
      this._items.set([...current, newLine]);
    }

    return ok(this.snapshot());
  }
}
