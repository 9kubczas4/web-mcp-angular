import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

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
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
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
