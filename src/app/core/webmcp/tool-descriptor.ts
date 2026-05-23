/**
 * Minimal structural JSON Schema sufficient for every schema used in the
 * demo. Intentionally narrow: only object/string/integer/number with
 * `enum`, `minimum`, `required`, and `additionalProperties: false`.
 */
export interface JsonSchema {
  readonly type: 'object' | 'string' | 'integer' | 'number';
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
}
