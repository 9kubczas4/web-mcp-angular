/** Cart line and summary types owned by `CartService`. */
export interface CartLine {
  readonly productId: string;
  readonly name: string;
  readonly price: number;
  readonly quantity: number;
}

export interface CartSummary {
  readonly items: readonly CartLine[];
  readonly itemCount: number;
  readonly total: number;
}
