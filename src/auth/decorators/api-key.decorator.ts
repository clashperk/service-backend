import { SetMetadata } from '@nestjs/common';

export const USE_API_KEY_METADATA = 'USE_API_KEY_METADATA';

export const UseApiKey = () => SetMetadata(USE_API_KEY_METADATA, true);
