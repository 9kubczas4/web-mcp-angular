import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  ProductsFilterService,
  type ProductCategory,
} from './products-filter.service';

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
 * `filterProducts` tool's schema and share `ProductsFilterService` state
 * so tool invocations update the visible catalog and filter controls.
 */
@Component({
  selector: 'app-products',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ProductsComponent {
  private readonly filterService = inject(ProductsFilterService);

  protected readonly categoryOptions = CATEGORY_OPTIONS;

  protected readonly category = this.filterService.category;

  protected readonly maxPrice = this.filterService.maxPrice;

  protected readonly visibleProducts = this.filterService.visibleProducts;

  /**
   * `(input)` handler for the category `<select>`. Maps the empty string
   * (the "All categories" option) back to `null`.
   */
  protected onCategoryChange(raw: string): void {
    if (raw === '') {
      this.filterService.setCategory(null);
      return;
    }
    if (CATEGORY_OPTIONS.includes(raw as ProductCategory)) {
      this.filterService.setCategory(raw as ProductCategory);
    }
  }

  /**
   * `(input)` handler for the max-price input. Empty input clears the
   * filter; non-numeric or negative values are ignored.
   */
  protected onMaxPriceChange(raw: string): void {
    if (raw.trim() === '') {
      this.filterService.setMaxPrice(null);
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      this.filterService.setMaxPrice(parsed);
    }
  }

  protected reset(): void {
    this.filterService.reset();
  }
}
