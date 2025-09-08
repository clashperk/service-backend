import { createHash } from 'node:crypto';

export function generateHash(body: string) {
  return createHash('md5').update(body).digest('hex');
}
