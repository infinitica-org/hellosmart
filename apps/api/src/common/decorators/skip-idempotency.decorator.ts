import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const SKIP_IDEMPOTENCY_KEY = 'skip_idempotency';

export const SkipIdempotency = (): CustomDecorator<string> => SetMetadata(SKIP_IDEMPOTENCY_KEY, true);
