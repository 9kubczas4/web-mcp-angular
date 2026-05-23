import { Injectable, signal, type Signal } from '@angular/core';

import { SEED_PRODUCTS, type Product } from './product';

/**
 * Filter inputs accepted by `ProductService.filter`. `null` or `undefined`
 * fields apply no constraint for that dimension, matching the
 * Filter_Products_Tool's optional schema fields.
 */
export interface ProductFilterOptions {
  readonly category?: string | null;
  readonly maxPrice?: number | null;
}

/**
 * In-memory product catalog used by `searchProducts`, `filterProducts`,
 * and `CartService`. State is held in a signal so consumers stay
 * OnPush-friendly; the catalog itself is read-only.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly _products = signal<readonly Product[]>(SEED_PRODUCTS);

  readonly products: Signal<readonly Product[]> = this._products.asReadonly();

  /**
   * Case-insensitive substring match against `name` and `description`.
   * An empty or whitespace-only query returns the full catalog.
   */
  search(query: string): Product[] {
    const needle = query.trim().toLowerCase();
    const all = this._products();
    if (needle.length === 0) {
      return [...all];
    }
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle),
    );
  }

  /**
   * Filter the catalog by optional `category` and `maxPrice`. Fields that
   * are `null` or `undefined` are ignored; when both are provided the
   * predicates are AND-ed.
   */
  filter(opts: ProductFilterOptions): Product[] {
    const { category, maxPrice } = opts;
    const hasCategory = category !== null && category !== undefined;
    const hasMaxPrice = maxPrice !== null && maxPrice !== undefined;

    return this._products().filter((p) => {
      if (hasCategory && p.category !== category) {
        return false;
      }
      if (hasMaxPrice && p.price > maxPrice) {
        return false;
      }
      return true;
    });
  }

  /** Linear lookup by id. Returns `undefined` when no product matches. */
  findById(id: string): Product | undefined {
    return this._products().find((p) => p.id === id);
  }
}
