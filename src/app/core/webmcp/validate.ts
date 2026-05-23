import type { JsonSchema } from './tool-descriptor';

/**
 * Result of validating a value against a `JsonSchema`. On success the
 * original value is returned; on failure a human-readable `message` and
 * optional structured `details` are returned for use by `err(...)` payloads.
 */
export type ValidateResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; message: string; details?: unknown };

/**
 * Tiny, pure, dependency-free validator covering the subset of JSON Schema
 * keywords used by the demo's tool input schemas.
 */
export function validate(value: unknown, schema: JsonSchema): ValidateResult {
  return validateAt(value, schema, '');
}

function validateAt(
  value: unknown,
  schema: JsonSchema,
  path: string,
): ValidateResult {
  switch (schema.type) {
    case 'object':
      return validateObject(value, schema, path);
    case 'string':
      return validateString(value, schema, path);
    case 'integer':
      return validateInteger(value, schema, path);
    case 'number':
      return validateNumber(value, schema, path);
    default: {
      const exhaustive: never = schema.type;
      return fail(path, `unsupported schema type "${String(exhaustive)}"`, {
        schemaType: schema.type,
      });
    }
  }
}

function validateObject(
  value: unknown,
  schema: JsonSchema,
  path: string,
): ValidateResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(path, 'expected object', {
      expected: 'object',
      received: describe(value),
    });
  }
  const obj = value as Record<string, unknown>;

  if (schema.required) {
    for (const key of schema.required) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        return fail(joinPath(path, key), `missing required property "${key}"`, {
          required: key,
        });
      }
    }
  }

  if (schema.additionalProperties === false) {
    const allowed = schema.properties ? Object.keys(schema.properties) : [];
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) {
        return fail(joinPath(path, key), `unexpected property "${key}"`, {
          additional: key,
        });
      }
    }
  }

  if (schema.properties) {
    for (const [key, sub] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const result = validateAt(obj[key], sub, joinPath(path, key));
        if (!result.ok) {
          return result;
        }
      }
    }
  }

  return { ok: true, value };
}

function validateString(
  value: unknown,
  schema: JsonSchema,
  path: string,
): ValidateResult {
  if (typeof value !== 'string') {
    return fail(path, 'expected string', {
      expected: 'string',
      received: describe(value),
    });
  }
  return checkEnum(value, schema, path);
}

function validateInteger(
  value: unknown,
  schema: JsonSchema,
  path: string,
): ValidateResult {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return fail(path, 'expected integer', {
      expected: 'integer',
      received: describe(value),
    });
  }
  const minResult = checkMinimum(value, schema, path);
  if (!minResult.ok) {
    return minResult;
  }
  return checkEnum(value, schema, path);
}

function validateNumber(
  value: unknown,
  schema: JsonSchema,
  path: string,
): ValidateResult {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(path, 'expected number', {
      expected: 'number',
      received: describe(value),
    });
  }
  const minResult = checkMinimum(value, schema, path);
  if (!minResult.ok) {
    return minResult;
  }
  return checkEnum(value, schema, path);
}

function checkMinimum(
  value: number,
  schema: JsonSchema,
  path: string,
): ValidateResult {
  if (typeof schema.minimum === 'number' && value < schema.minimum) {
    return fail(path, `expected value >= ${schema.minimum}`, {
      minimum: schema.minimum,
      received: value,
    });
  }
  return { ok: true, value };
}

function checkEnum(
  value: unknown,
  schema: JsonSchema,
  path: string,
): ValidateResult {
  if (schema.enum && !schema.enum.includes(value)) {
    return fail(path, 'value not in enum', {
      enum: schema.enum,
      received: value,
    });
  }
  return { ok: true, value };
}

function fail(path: string, message: string, details?: unknown): ValidateResult {
  const where = path === '' ? '<root>' : path;
  return {
    ok: false,
    message: `${where}: ${message}`,
    details: details === undefined ? { path: where } : { path: where, ...asObject(details) },
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function describe(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

function joinPath(parent: string, key: string): string {
  return parent === '' ? key : `${parent}.${key}`;
}
