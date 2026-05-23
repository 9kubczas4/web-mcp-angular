import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ROUTE_PATH, type RoutePath } from '../../app.route-paths';

interface RouteOverview {
  readonly path: RoutePath;
  readonly title: string;
  readonly summary: string;
  readonly tool: { readonly name: string; readonly scope: string } | null;
}

/**
 * Static landing page. Summarizes every route and the tool registered
 * there so a viewer arriving at `/` can see the full surface area.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly routes: readonly RouteOverview[] = [
    {
      path: ROUTE_PATH.home,
      title: 'Home',
      summary: 'This overview page. No route-scoped tools.',
      tool: null,
    },
    {
      path: ROUTE_PATH.products,
      title: 'Products',
      summary: 'Browse and filter the catalog. Filters mirror the tool schema.',
      tool: { name: 'filterProducts', scope: 'route-scoped' },
    },
    {
      path: ROUTE_PATH.dashboard,
      title: 'Dashboard',
      summary: 'Export a stub report in pdf, csv, or json.',
      tool: { name: 'exportReport', scope: 'route-scoped' },
    },
    {
      path: ROUTE_PATH.cart,
      title: 'Cart',
      summary: 'Live cart state owned by CartService.',
      tool: { name: 'getCartSummary / addToCart', scope: 'service-scoped' },
    },
    {
      path: ROUTE_PATH.contact,
      title: 'Contact',
      summary: 'Signal Forms + experimentalWebMcpTool option.',
      tool: { name: 'submitContactForm', scope: 'form-scoped' },
    },
  ];
}
