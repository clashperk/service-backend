import moment from 'moment';
import cluster from 'node:cluster';
import { createHash } from 'node:crypto';

export function generateHash(body: string) {
  return createHash('md5').update(body).digest('hex');
}

/** Number of cluster forks the tracking worker (apps/worker) spawns. */
export const numCPUs = process.env.NODE_ENV === 'production' ? 4 : 1;

/** Shards work across cluster forks: a unit `id` belongs to the current fork. */
export const isValidWorker = (id: number) => {
  const workerId = cluster.worker?.id ?? 1;
  return id % numCPUs === workerId - 1;
};

export const getWorkerId = () => {
  return cluster.worker?.id ?? 1;
};

export const formatDuration = (ms: number) => {
  return moment.duration(ms).format('D[d] H[h] m[m] s[s]', { trim: 'both mid' });
};

export function codeBlock(...lines: string[]) {
  return `\n\`\`\`\n${lines.join('\n')}\n\`\`\``;
}

export function paragraph(...lines: string[]) {
  return lines.join('<br/>');
}

export function expandable(label: string, ...summary: string[]) {
  return `\n<details>\n<summary>\n${label}\n</summary>\n\n${summary.join('<br/>')}\n</details>`;
}

export function hyperlink(url: string) {
  return `[${url}](${url})`;
}
