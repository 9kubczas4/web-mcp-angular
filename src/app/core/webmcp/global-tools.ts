import { inject } from '@angular/core';

import { ProductService } from '../catalog/product.service';
import { err, ok, type StructuredResponse } from './structured-response';
import type { JsonSchema } from './tool-descriptor';
import { validate } from './validate';

const SEARCH_PRODUCTS_SCHEMA = {
  type: 'object',
  required: ['query'],
  properties: {
    query: {
      type: 'string',
      description:
        'Text to match against store product names/descriptions (for example headphones, keyboard, speaker). Not for general-knowledge questions.',
    },
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
  description:
    'Search this store\'s product catalog (audio, wearable, home, and office items) by name or description. Use only when the user wants to find products to browse or buy. Do not use for general knowledge, news, or other non-catalog questions.',
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
