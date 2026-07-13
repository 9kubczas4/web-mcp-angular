/**
 * Structured_Response is the JSON-serializable shape every WebMCP tool
 * handler must return.
 */
export type StructuredResponseStatus = 'success' | 'error';

export interface StructuredResponse<T = unknown> {
  status: StructuredResponseStatus;
  payload: T;
}

export const ok = <T>(payload: T): StructuredResponse<T> => ({
  status: 'success',
  payload,
});

/**
 * Build an error Structured_Response. The payload carries a machine-readable
 * `code`, a human-readable `message`, and optional structured `details`.
 */
export const err = (code: string, message: string, details?: unknown): StructuredResponse => ({
  status: 'error',
  payload: { code, message, details },
});

/** Type guard for the Structured_Response contract. */
export function isStructuredResponse(value: unknown): value is StructuredResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { status?: unknown; payload?: unknown };
  if (candidate.status !== 'success' && candidate.status !== 'error') {
    return false;
  }
  return 'payload' in candidate;
}
