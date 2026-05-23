/** Product entity exposed by the in-memory catalog. */
export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: 'audio' | 'wearable' | 'home' | 'office';
  readonly price: number;
}

/** Seed catalog used by `ProductService`, with at least one entry per category. */
export const SEED_PRODUCTS: readonly Product[] = Object.freeze([
  Object.freeze({
    id: 'aud-001',
    name: 'Studio Over-Ear Headphones',
    description: 'Closed-back wired headphones tuned for mixing.',
    category: 'audio',
    price: 199,
  }),
  Object.freeze({
    id: 'aud-002',
    name: 'Pocket Bluetooth Speaker',
    description: 'Splash-resistant portable speaker with 12-hour battery.',
    category: 'audio',
    price: 79,
  }),
  Object.freeze({
    id: 'wea-001',
    name: 'Trail Runner Smartwatch',
    description: 'GPS smartwatch with heart-rate and altimeter sensors.',
    category: 'wearable',
    price: 249,
  }),
  Object.freeze({
    id: 'wea-002',
    name: 'Sleep Tracking Ring',
    description: 'Ultralight ring that measures HRV and sleep stages.',
    category: 'wearable',
    price: 329,
  }),
  Object.freeze({
    id: 'hom-001',
    name: 'Smart Plant Sensor',
    description: 'Bluetooth soil-moisture and light sensor for houseplants.',
    category: 'home',
    price: 39,
  }),
  Object.freeze({
    id: 'hom-002',
    name: 'Mesh Wi-Fi Node',
    description: 'Add-on node for whole-home mesh coverage.',
    category: 'home',
    price: 129,
  }),
  Object.freeze({
    id: 'off-001',
    name: 'Standing Desk Converter',
    description: 'Height-adjustable converter that fits on existing desks.',
    category: 'office',
    price: 219,
  }),
  Object.freeze({
    id: 'off-002',
    name: 'USB-C Docking Station',
    description: '11-port docking station with dual 4K display output.',
    category: 'office',
    price: 169,
  }),
]) as readonly Product[];
