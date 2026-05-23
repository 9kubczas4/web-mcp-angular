import { inject } from '@angular/core';

import { ProductService } from '../catalog/product.service';
import { err, ok, type StructuredResponse } from './structured-response';
import type { JsonSchema } from './tool-descriptor';
import { validate } from './validate';

const SEARCH_PRODUCTS_SCHEMA = {
  type: 'object',
  required: ['query'],
  properties: {
    query: { type: 'string' },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

/**
 * The `searchProducts` Global_Tool descriptor. Registered at the
 * application root via `provideExperimentalWebMcpTools` so it is alive on
 * every route. `ProductService` is resolved via `inject(...)` because the
 * runtime invokes `execute` in the registering injector's context.
 */
export const searchProductsTool = {
  name: 'searchProducts',
  description: 'Search the product catalog by name and description.',
  inputSchema: SEARCH_PRODUCTS_SCHEMA,
  execute: (args: { query: string }): StructuredResponse => {
    const result = validate(args, SEARCH_PRODUCTS_SCHEMA);
    if (!result.ok) {
      return err('validation', result.message, result.details);
    }
    const productService = inject(ProductService);
    const matches = productService.search(args.query);
    return ok({ matches });
  },
} as const;
