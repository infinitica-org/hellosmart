import { z } from 'zod';

export const RecordConsentDtoSchema = z.object({
  textVersion: z.string().min(1, 'Consent text version is required'),
});

export type RecordConsentDto = z.infer<typeof RecordConsentDtoSchema>;

