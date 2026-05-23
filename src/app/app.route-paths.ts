/**
 * Single source of truth for the demo's routing surface, imported by the
 * route table, the top nav, and any test that needs to refer to a route
 * by name. Using a frozen const lookup lets TypeScript surface typos at
 * compile time instead of at first navigation.
 */
export const ROUTE_PATH = Object.freeze({
  home: '/',
  products: '/products',
  dashboard: '/dashboard',
  cart: '/cart',
  contact: '/contact',
} as const);

export type RouteKey = keyof typeof ROUTE_PATH;
export type RoutePath = (typeof ROUTE_PATH)[RouteKey];

/**
 * Stripped form of `ROUTE_PATH` for places that take Angular `Route.path`
 * values (no leading slash); the router's matcher expects e.g.
 * `'products'`, while `RouterLink` and humans prefer the leading slash.
 */
export const ROUTE_SEGMENT: Readonly<Record<RouteKey, string>> = Object.freeze({
  home: '',
  products: ROUTE_PATH.products.slice(1),
  dashboard: ROUTE_PATH.dashboard.slice(1),
  cart: ROUTE_PATH.cart.slice(1),
  contact: ROUTE_PATH.contact.slice(1),
});
