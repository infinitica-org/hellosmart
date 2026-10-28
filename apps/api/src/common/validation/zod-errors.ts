import type { ZodError } from 'zod';

export function flattenZodErrors(error: ZodError): { field?: string; message: string }[] {
  return error.issues.map((issue) => {
    const row: { field?: string; message: string } = { message: issue.message };
    if (issue.path.length > 0) {
      row.field = issue.path.join('.');
    }
    return row;
  });
}
