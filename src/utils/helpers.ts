import { createHash } from 'node:crypto';

export const codeBlock = (str: string) => '\n```' + str + '```';

export function generateHash(body: string) {
  return createHash('md5').update(body).digest('hex');
}
