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
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
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
