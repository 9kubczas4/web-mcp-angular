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
  styles: `
    :host {
      display: block;
    }

    .products-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-bottom: var(--space-5);
    }

    .filter-bar {
      display: grid;
      gap: var(--space-3);
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      align-items: end;
      padding: var(--space-4);
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      margin-bottom: var(--space-5);
    }

    .filter-bar__actions {
      display: flex;
      justify-content: flex-end;
    }

    .empty-state {
      display: grid;
      place-items: center;
      gap: var(--space-2);
      padding: var(--space-7) var(--space-5);
      border-radius: var(--radius-lg);
      background: var(--color-bg-elevated);
      border: 1px dashed var(--color-border-strong);
      color: var(--color-fg-muted);
    }

    .empty-state__icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: var(--color-bg-subtle);
      display: grid;
      place-items: center;
      font-size: 1.5rem;
      color: var(--color-fg-subtle);
    }

    .product-grid {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      list-style: none;
    }

    .product-card {
      display: flex;
      flex-direction: column;
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      transition:
        transform 0.18s ease,
        box-shadow 0.2s ease,
        border-color 0.2s ease;
    }

    .product-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-lg);
      border-color: var(--color-border-strong);
    }

    /* Skeleton "image" — a category-tinted gradient with a soft shimmer
       sweep, plus an SVG glyph that hints at the category.            */
    .product-card__media {
      aspect-ratio: 4 / 3;
      position: relative;
      display: grid;
      place-items: center;
      background:
        radial-gradient(60% 80% at 30% 20%, var(--cat-accent), transparent 70%),
        linear-gradient(135deg, var(--cat-soft), var(--color-bg-subtle));
      isolation: isolate;
      overflow: hidden;
    }

    .product-card__media::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 80% 90%, rgba(255, 255, 255, 0.18), transparent 50%),
        radial-gradient(circle at 20% 80%, rgba(15, 23, 42, 0.06), transparent 50%);
      pointer-events: none;
    }

    .product-card__glyph {
      width: 64px;
      height: 64px;
      color: var(--cat-accent);
      filter: drop-shadow(0 6px 14px rgba(15, 23, 42, 0.18));
      z-index: 1;
    }

    .product-card__cat-label {
      position: absolute;
      top: var(--space-3);
      left: var(--space-3);
      z-index: 2;
      background: color-mix(in srgb, var(--color-bg-elevated) 80%, transparent);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .product-card__price-tag {
      position: absolute;
      top: var(--space-3);
      right: var(--space-3);
      z-index: 2;
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-pill);
      background: var(--color-bg-elevated);
      color: var(--color-fg);
      font-weight: 700;
      font-size: 0.85rem;
      box-shadow: var(--shadow-sm);
      letter-spacing: -0.01em;
    }

    .product-card__price-tag .price-tag__currency {
      color: var(--color-fg-subtle);
      font-weight: 500;
      margin-left: 0.15em;
    }

    .product-card__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-4);
      flex: 1;
    }

    .product-card__title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 650;
      color: var(--color-fg);
      letter-spacing: -0.01em;
    }

    .product-card__description {
      margin: 0;
      color: var(--color-fg-muted);
      font-size: 0.9rem;
      line-height: 1.5;
      flex: 1;
    }

    .product-card__id {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--color-fg-subtle);
    }

    /* Category palette mapping, applied via [attr.data-category]. */
    .product-card[data-category='audio'] {
      --cat-accent: var(--color-cat-audio);
      --cat-soft: var(--color-cat-audio-soft);
    }
    .product-card[data-category='wearable'] {
      --cat-accent: var(--color-cat-wearable);
      --cat-soft: var(--color-cat-wearable-soft);
    }
    .product-card[data-category='home'] {
      --cat-accent: var(--color-cat-home);
      --cat-soft: var(--color-cat-home-soft);
    }
    .product-card[data-category='office'] {
      --cat-accent: var(--color-cat-office);
      --cat-soft: var(--color-cat-office-soft);
    }
  `,
  template: `
    <section aria-labelledby="products-title">
      <header class="products-header">
        <h1 id="products-title">Products</h1>
        <p>
          Filters here mirror the <code>filterProducts</code> tool's input schema. The tool is
          registered on this route via <code>provideExperimentalWebMcpTools</code> and disappears
          from <code>navigator.modelContext</code> when you navigate away.
        </p>
      </header>

      <form class="filter-bar" aria-label="Catalog filters" (submit)="$event.preventDefault()">
        <label>
          Category
          <select
            name="category"
            [value]="category() ?? ''"
            (input)="onCategoryChange($any($event.target).value)"
          >
            <option value="">All categories</option>
            @for (option of categoryOptions; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>

        <label>
          Max price (USD)
          <input
            type="number"
            name="maxPrice"
            min="0"
            step="1"
            placeholder="No limit"
            [value]="maxPrice() ?? ''"
            (input)="onMaxPriceChange($any($event.target).value)"
          />
        </label>

        <div class="filter-bar__actions">
          <button type="button" class="ghost" (click)="reset()">Reset filters</button>
        </div>
      </form>

      @if (visibleProducts().length === 0) {
        <div class="empty-state" role="status">
          <span class="empty-state__icon" aria-hidden="true">∅</span>
          <strong>No products match the current filters.</strong>
          <span>Try a different category or raise the maximum price.</span>
        </div>
      } @else {
        <ul class="product-grid" role="list">
          @for (product of visibleProducts(); track product.id) {
            <li>
              <article class="product-card" [attr.data-category]="product.category">
                <div class="product-card__media shimmer" aria-hidden="true">
                  <span class="badge product-card__cat-label">{{ product.category }}</span>
                  <span class="product-card__price-tag"
                    >{{ product.price | number }}<span class="price-tag__currency">
                      USD</span
                    ></span
                  >
                  @switch (product.category) {
                    @case ('audio') {
                      <svg
                        class="product-card__glyph"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M3 14v-4a9 9 0 0 1 18 0v4" />
                        <path d="M21 14a3 3 0 0 1-3 3h-1v-6h1a3 3 0 0 1 3 3z" />
                        <path d="M3 14a3 3 0 0 0 3 3h1v-6H6a3 3 0 0 0-3 3z" />
                      </svg>
                    }
                    @case ('wearable') {
                      <svg
                        class="product-card__glyph"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <rect x="6" y="6" width="12" height="12" rx="3" />
                        <path d="M9 6V3h6v3M9 21v-3h6v3" />
                        <circle cx="12" cy="12" r="2.5" />
                      </svg>
                    }
                    @case ('home') {
                      <svg
                        class="product-card__glyph"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
                      </svg>
                    }
                    @case ('office') {
                      <svg
                        class="product-card__glyph"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 9h18M8 19v2M16 19v2" />
                      </svg>
                    }
                  }
                </div>
                <div class="product-card__body">
                  <h3 class="product-card__title">{{ product.name }}</h3>
                  <p class="product-card__description">{{ product.description }}</p>
                  <span class="product-card__id">{{ product.id }}</span>
                </div>
              </article>
            </li>
          }
        </ul>
      }
    </section>
  `,
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
