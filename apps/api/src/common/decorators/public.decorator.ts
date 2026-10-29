import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/auth.constants.js';

export { IS_PUBLIC_KEY };

/**
 * Marks an endpoint or controller as publicly accessible without session authentication.
 */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);

