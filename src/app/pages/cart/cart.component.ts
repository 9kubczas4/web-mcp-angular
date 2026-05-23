import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import { CartService } from '../../core/cart/cart.service';
import type { StructuredResponse } from '../../core/webmcp/structured-response';

/** Stable product id used by the "Add demo item" button. */
const DEMO_PRODUCT_ID = 'aud-001';

/** Error payload shape produced by `err(...)` in `structured-response.ts`. */
interface AddToCartErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * Cart page (`/cart`). Renders the live cart state owned by `CartService`
 * and exposes an "Add demo item" button that delegates to the same
 * `addToCartHandler` the service-scoped `addToCart` tool uses, so manual
 * UI invocation and tool invocation produce identical responses.
 */
@Component({
  selector: 'app-cart',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .cart-header {
      margin-bottom: var(--space-5);
    }

    .summary-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
      padding: var(--space-5);
      background: linear-gradient(
        135deg,
        var(--color-accent-soft),
        var(--color-bg-elevated) 70%
      );
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      margin-bottom: var(--space-5);
    }

    .summary-card__metric {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .summary-card__metric-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-fg-muted);
    }

    .summary-card__metric-value {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--color-fg);
    }

    .summary-card__currency {
      font-size: 1rem;
      color: var(--color-fg-subtle);
      margin-left: 0.25em;
      font-weight: 500;
    }

    .summary-card__cta button {
      background: var(--color-fg);
      color: var(--color-bg);
    }

    .summary-card__cta button:hover:not(:disabled) {
      background: var(--color-accent);
      color: var(--color-accent-fg);
    }

    .alert {
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-danger-soft);
      color: var(--color-danger);
      border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
      margin-bottom: var(--space-4);
    }

    .empty {
      display: grid;
      place-items: center;
      gap: var(--space-2);
      padding: var(--space-7) var(--space-5);
      border-radius: var(--radius-lg);
      background: var(--color-bg-elevated);
      border: 1px dashed var(--color-border-strong);
      color: var(--color-fg-muted);
    }

    .empty__icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--color-bg-subtle);
      display: grid;
      place-items: center;
      font-size: 1.4rem;
    }

    .lines {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      list-style: none;
    }

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-4);
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .line__main {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .line__name {
      font-weight: 650;
      color: var(--color-fg);
    }

    .line__id {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--color-fg-subtle);
    }

    .line__totals {
      text-align: right;
    }

    .line__qty {
      font-size: 0.85rem;
      color: var(--color-fg-muted);
    }

    .line__amount {
      font-weight: 700;
      letter-spacing: -0.01em;
    }
  `,
  template: `
    <section aria-labelledby="cart-title">
      <header class="cart-header">
        <h1 id="cart-title">Cart</h1>
        <p>
          <code>CartService</code> registers the <code>getCartSummary</code> and
          <code>addToCart</code> tools from its constructor via
          <code>declareExperimentalWebMcpTool</code>. The "Add demo item" button calls the same
          handler the <code>addToCart</code> tool uses, so both paths stay semantically identical.
        </p>
      </header>

      <div class="summary-card" role="status" aria-live="polite">
        <div class="summary-card__metric">
          <span class="summary-card__metric-label">Items</span>
          <span class="summary-card__metric-value">{{ itemCount() }}</span>
        </div>
        <div class="summary-card__metric">
          <span class="summary-card__metric-label">Total</span>
          <span class="summary-card__metric-value"
            >{{ total() | number: '1.2-2'
            }}<span class="summary-card__currency">USD</span></span
          >
        </div>
        <div class="summary-card__cta">
          <button type="button" (click)="addDemoItem()">+ Add demo item</button>
        </div>
      </div>

      @if (lastError(); as error) {
        <p class="alert" role="alert">
          <strong>{{ error.code }}</strong>: {{ error.message }}
        </p>
      }

      @if (items().length === 0) {
        <div class="empty">
          <span class="empty__icon" aria-hidden="true">🛒</span>
          <strong>Cart is empty.</strong>
          <span>Click "Add demo item" or invoke <code>addToCart</code> via the devtools.</span>
        </div>
      } @else {
        <ul class="lines" aria-label="Cart contents" role="list">
          @for (line of items(); track line.productId) {
            <li class="line">
              <div class="line__main">
                <span class="line__name">{{ line.name }}</span>
                <span class="line__id">{{ line.productId }}</span>
              </div>
              <div class="line__totals">
                <div class="line__qty">qty {{ line.quantity }}</div>
                <div class="line__amount">{{ line.price | number: '1.2-2' }} USD</div>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class CartComponent {
  private readonly cartService = inject(CartService);

  protected readonly demoProductId = DEMO_PRODUCT_ID;

  protected readonly items = this.cartService.items;
  protected readonly itemCount = this.cartService.itemCount;
  protected readonly total = this.cartService.total;

  private readonly lastResponse = signal<StructuredResponse | null>(null);

  protected readonly lastError = computed<AddToCartErrorPayload | null>(() => {
    const response = this.lastResponse();
    if (response === null || response.status !== 'error') {
      return null;
    }
    return response.payload as AddToCartErrorPayload;
  });

  protected addDemoItem(): void {
    const response = this.cartService.addToCartHandler({
      productId: this.demoProductId,
      quantity: 1,
    });
    this.lastResponse.set(response);
  }
}
