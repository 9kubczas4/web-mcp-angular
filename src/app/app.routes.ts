import { provideExperimentalWebMcpTools } from '@angular/core';
import type { Routes } from '@angular/router';

import { ROUTE_SEGMENT } from './app.route-paths';
import { exportReportTool } from './pages/dashboard/dashboard.tools';
import { ProductsFilterService } from './pages/products/products-filter.service';
import { filterProductsTool } from './pages/products/products.tools';

/**
 * Route table for the WebMCP demo. Each feature route is loaded lazily so
 * its `Route.providers` array is only evaluated on first navigation, which
 * is also when the WebMCP runtime sees the route-scoped tool registrations.
 * The contact route's Form_Tool is registered through `form()` inside the
 * component itself.
 */
export const APP_ROUTES: Routes = [
  {
    path: ROUTE_SEGMENT.home,
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: ROUTE_SEGMENT.products,
    loadComponent: () =>
      import('./pages/products/products.component').then((m) => m.ProductsComponent),
    providers: [ProductsFilterService, provideExperimentalWebMcpTools([filterProductsTool])],
  },
  {
    path: ROUTE_SEGMENT.dashboard,
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    providers: [provideExperimentalWebMcpTools([exportReportTool])],
  },
  {
    path: ROUTE_SEGMENT.cart,
    loadComponent: () => import('./pages/cart/cart.component').then((m) => m.CartComponent),
  },
  {
    path: ROUTE_SEGMENT.contact,
    loadComponent: () =>
      import('./pages/contact/contact.component').then((m) => m.ContactComponent),
  },
  { path: '**', redirectTo: ROUTE_SEGMENT.home },
];
