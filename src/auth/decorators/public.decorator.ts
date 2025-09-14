import { SetMetadata } from '@nestjs/common';

export const PUBLIC_METADATA = 'PUBLIC_METADATA';

export const Public = () => SetMetadata(PUBLIC_METADATA, true);
