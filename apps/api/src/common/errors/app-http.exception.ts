import { HttpException } from '@nestjs/common';
import type { ProblemDetails } from '@hs/contracts';

export function problem(
  partial: Omit<ProblemDetails, 'type'> & { type?: string },
): HttpException {
  const problemBody: ProblemDetails = {
    type: partial.type ?? `https://hellosmart.ai/problems/${partial.code.toLowerCase()}`,
    title: partial.title,
    status: partial.status,
    detail: partial.detail,
    code: partial.code,
    ...(partial.instance !== undefined ? { instance: partial.instance } : {}),
    ...(partial.errors !== undefined ? { errors: partial.errors } : {}),
    ...(partial.reasons !== undefined ? { reasons: partial.reasons } : {}),
  };
  return new HttpException(problemBody, partial.status);
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'status' in value &&
    'title' in value
  );
}
