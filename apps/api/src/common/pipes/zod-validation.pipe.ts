import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { z, type ZodSchema } from 'zod';
import { problem } from '../errors/app-http.exception.js';
import { flattenZodErrors } from '../validation/zod-errors.js';

/**
 * Recursively marks ZodObject instances within a schema as strict so that
 * any unrecognized/unknown keys at any nesting level in the request payload
 * are rejected with 422, without mutating the original input schema.
 */
export function enforceStrict<T extends z.ZodTypeAny>(schema: T): T {
  if (schema instanceof z.ZodObject) {
    const rawShape = schema.shape;
    const newShape: Record<string, z.ZodTypeAny> = {};
    for (const [key, value] of Object.entries(rawShape)) {
      newShape[key] = enforceStrict(value as z.ZodTypeAny);
    }
    return new (schema.constructor as any)({
      ...schema._def,
      shape: () => newShape,
      unknownKeys: 'strict',
    }) as T;
  }

  if (schema instanceof z.ZodArray) {
    return new (schema.constructor as any)({
      ...schema._def,
      type: enforceStrict(schema.element),
    }) as T;
  }

  if (schema instanceof z.ZodOptional) {
    return new (schema.constructor as any)({
      ...schema._def,
      innerType: enforceStrict(schema.unwrap()),
    }) as T;
  }

  if (schema instanceof z.ZodNullable) {
    return new (schema.constructor as any)({
      ...schema._def,
      innerType: enforceStrict(schema.unwrap()),
    }) as T;
  }

  if (schema instanceof z.ZodEffects) {
    return new (schema.constructor as any)({
      ...schema._def,
      schema: enforceStrict(schema.innerType()),
    }) as T;
  }

  if (schema instanceof z.ZodUnion) {
    return new (schema.constructor as any)({
      ...schema._def,
      options: schema.options.map((opt: z.ZodTypeAny) => enforceStrict(opt)),
    }) as T;
  }

  if (schema instanceof z.ZodIntersection) {
    return new (schema.constructor as any)({
      ...schema._def,
      left: enforceStrict(schema._def.left),
      right: enforceStrict(schema._def.right),
    }) as T;
  }

  return schema;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  private readonly strictSchema?: ZodSchema;

  constructor(private readonly schema?: ZodSchema) {
    if (schema) {
      this.strictSchema = enforceStrict(schema);
    }
  }

  transform(value: unknown, _metadata?: ArgumentMetadata): unknown {
    const schemaToUse = this.strictSchema ?? this.schema;
    if (!schemaToUse) {
      return value;
    }

    const result = schemaToUse.safeParse(value);
    if (!result.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Validation failed for request payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(result.error),
      });
    }

    return result.data;
  }
}
