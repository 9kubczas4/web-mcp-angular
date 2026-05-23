import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type Signal,
} from '@angular/core';

import { ProductService } from '../../core/catalog/product.service';
import type { Product } from '../../core/catalog/product';

type ProductCategory = 'audio' | 'wearable' | 'home' | 'office';

/**
 * Static option list backing the category `<select>`. Kept in lockstep
 * with the `enum` declared by the `filterProducts` tool's JSON schema.
 */
const CATEGORY_OPTIONS: readonly ProductCategory[] = [
  'audio',
  'wearable',
  'home',
  'office',
];

/**
 * Products page (`/products`). The UI filters mirror the route-scoped
 * `filterProducts` tool's schema, so both the UI and the tool drive the
 * same `ProductService.filter` call.
 */
@Component({
  selector: 'app-products',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ProductsComponent {
  private readonly productService = inject(ProductService);

  protected readonly categoryOptions = CATEGORY_OPTIONS;

  protected readonly category = signal<ProductCategory | null>(null);

  protected readonly maxPrice = signal<number | null>(null);

  protected readonly visibleProducts: Signal<readonly Product[]> = computed(() =>
    this.productService.filter({
      category: this.category(),
      maxPrice: this.maxPrice(),
    }),
  );

  /**
   * `(input)` handler for the category `<select>`. Maps the empty string
   * (the "All categories" option) back to `null`.
   */
  protected onCategoryChange(raw: string): void {
    if (raw === '') {
      this.category.set(null);
      return;
    }
    if (CATEGORY_OPTIONS.includes(raw as ProductCategory)) {
      this.category.set(raw as ProductCategory);
    }
  }

  /**
   * `(input)` handler for the max-price input. Empty input clears the
   * filter; non-numeric or negative values are ignored.
   */
  protected onMaxPriceChange(raw: string): void {
    if (raw.trim() === '') {
      this.maxPrice.set(null);
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      this.maxPrice.set(parsed);
    }
  }

  protected reset(): void {
    this.category.set(null);
    this.maxPrice.set(null);
  }
}
