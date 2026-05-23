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
  styles: `
    .hero {
      position: relative;
      padding: var(--space-7) var(--space-6) var(--space-6);
      border-radius: var(--radius-xl);
      background:
        radial-gradient(80% 120% at 0% 0%, rgba(99, 102, 241, 0.18), transparent 60%),
        radial-gradient(60% 100% at 100% 0%, rgba(236, 72, 153, 0.12), transparent 60%),
        linear-gradient(180deg, var(--color-bg-elevated), var(--color-bg-subtle));
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }

    .hero__eyebrow {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
      background: var(--color-accent-soft);
      color: var(--color-accent);
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: var(--space-4);
    }

    .hero p {
      max-width: 70ch;
      font-size: 1.05rem;
    }

    .hero__cta {
      display: inline-flex;
      gap: var(--space-3);
      flex-wrap: wrap;
      margin-top: var(--space-4);
    }

    .hero__cta a.button {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      font-weight: 600;
      transition: background-color 0.15s ease, transform 0.05s ease;
    }

    .hero__cta a.button.primary {
      background: var(--color-accent);
      color: var(--color-accent-fg);
    }
    .hero__cta a.button.primary:hover {
      background: var(--color-accent-hover);
      text-decoration: none;
    }
    .hero__cta a.button.ghost {
      background: var(--color-bg-elevated);
      color: var(--color-fg);
      border: 1px solid var(--color-border-strong);
    }
    .hero__cta a.button.ghost:hover {
      background: var(--color-bg-subtle);
      text-decoration: none;
    }

    .hero__byline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-5);
      padding-top: var(--space-4);
      border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
      color: var(--color-fg-muted);
      font-size: 0.95rem;
    }

    .hero__byline strong {
      color: var(--color-fg);
    }

    .hero__byline a {
      font-weight: 600;
    }

    .hero__byline-divider {
      color: var(--color-fg-subtle);
    }

    .section-heading {
      margin-top: var(--space-7);
      margin-bottom: var(--space-2);
    }

    .grid {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      margin-top: var(--space-4);
      list-style: none;
      padding: 0;
    }

    .grid > li {
      display: flex;
      list-style: none;
    }

    .route-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-5);
      width: 100%;
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      transition:
        transform 0.15s ease,
        box-shadow 0.2s ease,
        border-color 0.2s ease;
      color: var(--color-fg);
    }

    .route-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--color-border-strong);
      text-decoration: none;
    }

    .route-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .route-card__path {
      font-family: var(--font-mono);
      font-size: 0.875rem;
      color: var(--color-fg-muted);
    }

    .route-card__title {
      font-size: 1.1rem;
      font-weight: 650;
      margin: 0;
      color: var(--color-fg);
    }

    .route-card__summary {
      color: var(--color-fg-muted);
      margin: 0;
      flex: 1;
    }

    .route-card__tool {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-2);
      margin-top: auto;
    }

    .route-card__tool code {
      background: var(--color-accent-soft);
      color: var(--color-accent);
      border-color: transparent;
    }

    .global-tools {
      display: grid;
      gap: var(--space-3);
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      list-style: none;
      padding: 0;
    }

    .global-tools li {
      list-style: none;
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-sm);
    }

    .global-tools li > .global-tools__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .global-tools li code {
      background: var(--color-accent-soft);
      color: var(--color-accent);
      border-color: transparent;
    }

    .global-tools li p {
      margin: var(--space-2) 0 0;
      font-size: 0.95rem;
    }
  `,
  template: `
    <section class="hero" aria-labelledby="home-title">
      <span class="hero__eyebrow">Angular 22 · WebMCP</span>
      <h1 id="home-title">WebMCP Angular Demo</h1>
      <p>
        Every page registers a tool with <code>navigator.modelContext</code> at a different scope.
        Open Chrome's WebMCP devtools extension to watch the registry change as you navigate, and
        invoke any tool by hand.
      </p>
      <p class="hero__cta">
        <a class="button primary" routerLink="/products">Browse products</a>
        <a class="button ghost" routerLink="/contact">Try the contact form</a>
      </p>
      <p class="hero__byline">
        <span
          >Built by
          <a href="https://pawelkubiak.dev" target="_blank" rel="noopener noreferrer"
            ><strong>Paweł Kubiak</strong></a
          ></span
        >
        <span class="hero__byline-divider" aria-hidden="true">·</span>
        <a
          href="https://pawelkubiak.dev/blog/webmcp-teaching-ai-agents-to-interact-with-your-web-app"
          target="_blank"
          rel="noopener noreferrer"
          >WebMCP: teaching AI agents</a
        >
        <span class="hero__byline-divider" aria-hidden="true">·</span>
        <a
          href="https://pawelkubiak.dev/blog/webmcp-in-angular-framework-level-support-for-ai-agents"
          target="_blank"
          rel="noopener noreferrer"
          >WebMCP in Angular</a
        >
      </p>
    </section>

    <h2 class="section-heading">Routes and tools</h2>
    <ul class="grid" role="list">
      @for (route of routes; track route.path) {
        <li>
          <a class="route-card" [routerLink]="route.path">
            <div class="route-card__head">
              <h3 class="route-card__title">{{ route.title }}</h3>
              <span class="route-card__path">{{ route.path }}</span>
            </div>
            <p class="route-card__summary">{{ route.summary }}</p>
            @if (route.tool; as tool) {
              <div class="route-card__tool">
                <code>{{ tool.name }}</code>
                <span class="badge">{{ tool.scope }}</span>
              </div>
            }
          </a>
        </li>
      }
    </ul>

    <h2 class="section-heading">Always available</h2>
    <ul class="global-tools" role="list">
      <li>
        <div class="global-tools__head">
          <code>searchProducts</code>
          <span class="badge badge--accent">global</span>
        </div>
        <p>Registered at application bootstrap. Available on every route.</p>
      </li>
      <li>
        <div class="global-tools__head">
          <code>getCartSummary</code>
          <span aria-hidden="true">/</span>
          <code>addToCart</code>
          <span class="badge badge--accent">service-scoped</span>
        </div>
        <p>Registered by <code>CartService</code>'s constructor; alive for the app's lifetime.</p>
      </li>
    </ul>
  `,
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
