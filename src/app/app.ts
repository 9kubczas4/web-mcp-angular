import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ROUTE_PATH } from './app.route-paths';

interface NavLink {
  readonly path: string;
  readonly label: string;
}

/** Root application shell. Renders the top navigation and the routed view. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-shell' },
})
export class App {
  protected readonly links: readonly NavLink[] = [
    { path: ROUTE_PATH.home, label: 'Home' },
    { path: ROUTE_PATH.products, label: 'Products' },
    { path: ROUTE_PATH.dashboard, label: 'Dashboard' },
    { path: ROUTE_PATH.cart, label: 'Cart' },
    { path: ROUTE_PATH.contact, label: 'Contact' },
  ];
}
