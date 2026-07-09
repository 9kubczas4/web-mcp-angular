export const DEMO_ORIGIN = 'https://webmcp-angular-demo.web.app';

export const DEMO_ROUTES = ['home', 'products', 'dashboard', 'cart', 'contact'] as const;

export type DemoRoute = (typeof DEMO_ROUTES)[number];

const ROUTE_PATHS: Record<DemoRoute, string> = {
  home: '/',
  products: '/products',
  dashboard: '/dashboard',
  cart: '/cart',
  contact: '/contact',
};

/** Route-scoped WebMCP tools and the demo page where they register. */
const TOOL_ROUTES: Partial<Record<string, DemoRoute>> = {
  filterProducts: 'products',
  exportReport: 'dashboard',
  submitContactForm: 'contact',
};

export function demoUrl(route: DemoRoute = 'home'): string {
  const path = ROUTE_PATHS[route];
  return path === '/' ? DEMO_ORIGIN : `${DEMO_ORIGIN}${path}`;
}

export function routeForTool(toolName: string): DemoRoute {
  return TOOL_ROUTES[toolName] ?? 'home';
}
