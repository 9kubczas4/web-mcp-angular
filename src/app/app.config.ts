import {
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideExperimentalWebMcpTools,
  inject,
  type ApplicationConfig,
} from '@angular/core';
import { provideExperimentalWebMcpForms } from '@angular/forms/signals';
import { provideRouter, withExperimentalAutoCleanupInjectors } from '@angular/router';

import { CartService } from './core/cart/cart.service';
import { APP_ROUTES } from './app.routes';
import { searchProductsTool } from './core/webmcp/global-tools';

/**
 * Application bootstrap configuration.
 *
 * `provideAppInitializer` eagerly materializes `CartService` so its
 * constructor's `declareExperimentalWebMcpTool` calls register the
 * service-scoped cart tools at bootstrap. `providedIn: 'root'` alone is
 * lazy and would defer registration until the first injection.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(APP_ROUTES, withExperimentalAutoCleanupInjectors()),
    provideExperimentalWebMcpTools([searchProductsTool]),
    provideExperimentalWebMcpForms(),
    provideAppInitializer(() => {
      inject(CartService);
    }),
  ],
};
