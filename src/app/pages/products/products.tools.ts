import { inject } from '@angular/core';

import { ProductsFilterService } from './products-filter.service';
import { err, type StructuredResponse } from '../../core/webmcp/structured-response';
import type { JsonSchema } from '../../core/webmcp/tool-descriptor';
import { validate } from '../../core/webmcp/validate';

const FILTER_PRODUCTS_SCHEMA = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      enum: ['audio', 'wearable', 'home', 'office'],
    },
    maxPrice: {
      type: 'number',
      minimum: 0,
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

interface FilterProductsArgs {
  readonly category?: 'audio' | 'wearable' | 'home' | 'office';
  readonly maxPrice?: number;
}

/**
 * The `filterProducts` Route_Scoped_Tool descriptor. Wired into the
 * `/products` route's `providers` array via
 * `provideExperimentalWebMcpTools`, so its lifetime is tied to the route
 * injector and `withExperimentalAutoCleanupInjectors()` unregisters it
 * on navigation away.
 */
export const filterProductsTool = {
  name: 'filterProducts',
  description:
    'Filter the product catalog by optional category and maximum price.',
  inputSchema: FILTER_PRODUCTS_SCHEMA,
  execute: (args: FilterProductsArgs): StructuredResponse => {
    const result = validate(args, FILTER_PRODUCTS_SCHEMA);
    if (!result.ok) {
      return err('validation', result.message, result.details);
    }
    const filterService = inject(ProductsFilterService);
    return filterService.applyFilter({
      category: args.category ?? null,
      maxPrice: args.maxPrice ?? null,
    });
  },
} as const;
