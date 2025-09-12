import { createHash } from 'node:crypto';

export function generateHash(body: string) {
  return createHash('md5').update(body).digest('hex');
}

export function codeBlock(str: string) {
  return `\n\`\`\`\n${str}\n\`\`\``;
}
