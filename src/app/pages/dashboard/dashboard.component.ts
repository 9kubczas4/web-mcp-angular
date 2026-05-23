import { UpperCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';

import type { StructuredResponse } from '../../core/webmcp/structured-response';
import { EXPORT_FORMATS, type ExportFormat, runExport } from './dashboard.tools';

interface ExportSuccessPayload {
  readonly format: ExportFormat;
  readonly generatedAt: string;
  readonly rows: number;
}

interface ExportErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * Dashboard page (`/dashboard`). Lets a viewer pick a report format and
 * trigger a stub export, then renders the resulting `StructuredResponse`.
 * The Export button delegates to the same `runExport` helper the tool
 * uses, so manual UI and tool invocations produce identical responses.
 */
@Component({
  selector: 'app-dashboard',
  imports: [UpperCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .dashboard-header {
      margin-bottom: var(--space-5);
    }

    .panel {
      padding: var(--space-5);
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      margin-bottom: var(--space-5);
    }

    .format-picker {
      display: grid;
      gap: var(--space-3);
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      margin: 0 0 var(--space-4);
      padding: 0;
      border: 0;
    }

    .format-picker legend {
      font-weight: 600;
      margin-bottom: var(--space-2);
      color: var(--color-fg);
    }

    .format-option {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border-strong);
      background: var(--color-bg-elevated);
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background-color 0.15s ease,
        box-shadow 0.15s ease;
    }

    .format-option:hover {
      border-color: var(--color-accent);
      background: var(--color-accent-soft);
    }

    .format-option input[type='radio'] {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .format-option:has(input:checked) {
      border-color: var(--color-accent);
      background: var(--color-accent-soft);
      box-shadow: 0 0 0 2px var(--color-accent-soft);
    }

    .format-option__label {
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .format-option__hint {
      font-size: 0.85rem;
      color: var(--color-fg-muted);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .actions button.primary {
      background: var(--color-accent);
      color: var(--color-accent-fg);
    }

    .preview {
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-bg-subtle);
      color: var(--color-fg-muted);
      font-size: 0.9rem;
    }

    .result {
      display: grid;
      gap: var(--space-3);
    }

    .result__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .result dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: var(--space-1) var(--space-3);
      margin: 0;
    }

    .result dt {
      color: var(--color-fg-muted);
      font-size: 0.85rem;
    }

    .result dd {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 0.9rem;
    }

    .result--error {
      padding: var(--space-3) var(--space-4);
      background: var(--color-danger-soft);
      color: var(--color-danger);
      border-radius: var(--radius-md);
      border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
    }
  `,
  template: `
    <section aria-labelledby="dashboard-title">
      <header class="dashboard-header">
        <h1 id="dashboard-title">Dashboard</h1>
        <p>
          This route registers the <code>exportReport</code> tool via
          <code>provideExperimentalWebMcpTools</code> in its <code>providers</code> array. The
          button below calls the same <code>runExport</code> helper the tool's handler uses, so
          manual and tool-driven invocations produce identical responses.
        </p>
      </header>

      <form class="panel" aria-label="Export options" (submit)="$event.preventDefault()">
        <fieldset class="format-picker">
          <legend>Format</legend>
          @for (option of formats; track option) {
            <label class="format-option" [attr.for]="'format-' + option">
              <input
                type="radio"
                name="format"
                [id]="'format-' + option"
                [value]="option"
                [checked]="format() === option"
                (change)="onFormatChange(option)"
              />
              <span class="format-option__label">{{ option | uppercase }}</span>
              <span class="format-option__hint">
                @switch (option) {
                  @case ('pdf') {
                    Formatted document
                  }
                  @case ('csv') {
                    Comma-separated values
                  }
                  @case ('json') {
                    Structured data
                  }
                }
              </span>
            </label>
          }
        </fieldset>

        <div class="actions">
          <button type="button" class="primary" (click)="export()">Export report</button>
          <span class="preview" role="status" aria-live="polite">
            @switch (format()) {
              @case ('pdf') {
                A formatted PDF will be produced.
              }
              @case ('csv') {
                A comma-separated CSV will be produced.
              }
              @case ('json') {
                A JSON file will be produced.
              }
            }
          </span>
        </div>
      </form>

      @if (lastExport(); as response) {
        <section class="panel" aria-label="Last export result">
          <div class="result">
            <div class="result__head">
              <h2>Last export</h2>
              @if (response.status === 'success') {
                <span class="badge badge--success">Success</span>
              } @else {
                <span class="badge badge--danger">Error</span>
              }
            </div>

            @if (successPayload(); as success) {
              <dl>
                <dt>Format</dt>
                <dd>{{ success.format | uppercase }}</dd>
                <dt>Generated at</dt>
                <dd>{{ success.generatedAt }}</dd>
                <dt>Rows</dt>
                <dd>{{ success.rows }}</dd>
              </dl>
            }

            @if (errorPayload(); as error) {
              <p class="result--error" role="alert">
                <strong>{{ error.code }}</strong>: {{ error.message }}
              </p>
            }
          </div>
        </section>
      }
    </section>
  `,
})
export class DashboardComponent {
  protected readonly formats = EXPORT_FORMATS;

  protected readonly format = signal<ExportFormat>('pdf');

  protected readonly lastExport = signal<StructuredResponse | null>(null);

  protected readonly successPayload = computed<ExportSuccessPayload | null>(() => {
    const response = this.lastExport();
    if (response === null || response.status !== 'success') {
      return null;
    }
    return response.payload as ExportSuccessPayload;
  });

  protected readonly errorPayload = computed<ExportErrorPayload | null>(() => {
    const response = this.lastExport();
    if (response === null || response.status !== 'error') {
      return null;
    }
    return response.payload as ExportErrorPayload;
  });

  protected onFormatChange(raw: string): void {
    if (EXPORT_FORMATS.includes(raw as ExportFormat)) {
      this.format.set(raw as ExportFormat);
    }
  }

  protected export(): void {
    this.lastExport.set(runExport(this.format()));
  }
}
