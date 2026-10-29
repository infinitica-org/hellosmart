import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skip_csrf';

/**
 * Decorator to explicitly exempt a specific route handler or controller from CSRF and Origin checks.
 * Use ONLY for server-to-server endpoints (such as external webhooks with HMAC signatures)
 * that cannot provide browser Origin/X-HS-CSRF headers.
 */
export const SkipCsrf = (): CustomDecorator<string> => SetMetadata(SKIP_CSRF_KEY, true);

