import { Injectable, computed, inject, signal, type Signal } from '@angular/core';

import { ProductService } from '../../core/catalog/product.service';
import type { Product } from '../../core/catalog/product';
import { ok, type StructuredResponse } from '../../core/webmcp/structured-response';

export type ProductCategory = 'audio' | 'wearable' | 'home' | 'office';

export interface ProductFilterState {
  readonly category: ProductCategory | null;
  readonly maxPrice: number | null;
}

/**
 * Route-scoped filter state for `/products`. Both the page UI and the
 * `filterProducts` tool read and write through this service so a tool
 * invocation updates the visible catalog and filter controls.
 */
@Injectable()
export class ProductsFilterService {
  private readonly productService = inject(ProductService);

  readonly category = signal<ProductCategory | null>(null);

  readonly maxPrice = signal<number | null>(null);

  readonly visibleProducts: Signal<readonly Product[]> = computed(() =>
    this.productService.filter({
      category: this.category(),
      maxPrice: this.maxPrice(),
    }),
  );

  /**
   * Apply filter constraints and return the matching catalog slice. Used
   * by the `filterProducts` tool after schema validation passes.
   */
  applyFilter(state: ProductFilterState): StructuredResponse {
    this.category.set(state.category);
    this.maxPrice.set(state.maxPrice);

    return ok({ matches: this.visibleProducts() });
  }

  setCategory(category: ProductCategory | null): void {
    this.category.set(category);
  }

  setMaxPrice(maxPrice: number | null): void {
    this.maxPrice.set(maxPrice);
  }

  reset(): void {
    this.category.set(null);
    this.maxPrice.set(null);
  }
}
