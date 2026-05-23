import { err, ok, type StructuredResponse } from '../../core/webmcp/structured-response';
import type { JsonSchema } from '../../core/webmcp/tool-descriptor';
import { validate } from '../../core/webmcp/validate';

/**
 * Supported report formats. Kept as a `readonly` tuple so the schema's
 * `enum` and the {@link ExportFormat} union stay in lockstep — adding a
 * format is a single edit here.
 */
export const EXPORT_FORMATS = ['pdf', 'csv', 'json'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

const EXPORT_REPORT_SCHEMA = {
  type: 'object',
  required: ['format'],
  properties: {
    format: {
      type: 'string',
      enum: EXPORT_FORMATS,
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

interface ExportReportArgs {
  readonly format: ExportFormat;
}

/**
 * Shared "do the export" worker. Pure aside from the timestamp it stamps
 * onto the response. Both the tool's `execute` handler and the
 * `DashboardComponent`'s Export button delegate here so manual UI
 * invocation and tool invocation produce identical responses.
 *
 * Callers MUST have already produced a valid {@link ExportFormat}; no
 * re-validation happens here.
 */
export const runExport = (format: ExportFormat): StructuredResponse =>
  ok({
    format,
    generatedAt: new Date().toISOString(),
    rows: 42,
  });

/**
 * The `exportReport` Route_Scoped_Tool descriptor. Wired into the
 * `/dashboard` route's `providers` array via
 * `provideExperimentalWebMcpTools`.
 */
export const exportReportTool = {
  name: 'exportReport',
  description: 'Export a stub analytics report in pdf, csv, or json format.',
  inputSchema: EXPORT_REPORT_SCHEMA,
  execute: (args: ExportReportArgs): StructuredResponse => {
    const result = validate(args, EXPORT_REPORT_SCHEMA);
    if (!result.ok) {
      return err('validation', result.message, result.details);
    }
    return runExport(args.format);
  },
} as const;
