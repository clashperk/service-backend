import { createHash } from 'node:crypto';

export function generateHash(body: string) {
  return createHash('md5').update(body).digest('hex');
}

export function codeBlock(...lines: string[]) {
  return `\n\`\`\`\n${lines.join('\n')}\n\`\`\``;
}

export function paragraph(...lines: string[]) {
  return lines.join('<br/>');
}

export function expandable(label: string, ...summary: string[]) {
  return `\n<details>\n<summary>\n${label}\n</summary>\n\n${summary.join('<br/>')}\n</details>`;
}
