/**
 * Process-wide cap on concurrent Clash API requests.
 *
 * Why this exists: each tracker fork bursts to ~200 requests in flight (five
 * services, each fanning out `Promise.all` over whole clans at once). Measured
 * in-container over five runs, per-request latency scales with in-flight depth
 * in one process: ~40ms at 24, ~55ms at 48, ~95ms at 96, ~220-300ms at 200.
 * Bounding depth cuts latency by 2-4x; the burst simply queues here (cheap
 * promises) instead of at the server.
 *
 * Why it is process-wide: every tracker service builds its own ClashClient via
 * `getClient()`, so a per-instance cap would still allow 6x the intended depth.
 * All instances in a fork share this one semaphore.
 *
 * Tuning: CLASH_API_MAX_INFLIGHT (default 96). 96 is the conservative choice:
 * its worst benchmark run still sustained 248 req/s, roughly twice what a fork
 * actually consumes (~100-120 req/s), so the sweep cannot slow down, while the
 * median fetch drops from ~224ms to ~95ms. Dropping to 48 roughly halves the
 * latency again (~55ms) but its worst run was 126 req/s — too close to demand
 * to be the default; dial it via env and watch the sweep duration. Set 0 to
 * disable the cap entirely — a rollback that needs no code change.
 */

class Semaphore {
  private inflight = 0;
  private queue: (() => void)[] = [];

  public constructor(private readonly capacity: number) {}

  public get pending() {
    return this.queue.length;
  }

  public get active() {
    return this.inflight;
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.inflight < this.capacity) {
      this.inflight++;
    } else {
      // Woken by a releaser handing over its slot, so no increment here: the
      // slot was never released. Decrement-then-reacquire would open a window
      // where a new synchronous caller slips in and the cap reads N+1.
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    try {
      return await task();
    } finally {
      // FIFO, so a burst drains in arrival order and nothing starves.
      const next = this.queue.shift();
      if (next) next();
      else this.inflight--;
    }
  }
}

const DEFAULT_MAX_INFLIGHT = 96;

let shared: Semaphore | null | undefined;

/**
 * The fork's shared limiter, or null when disabled (CLASH_API_MAX_INFLIGHT=0).
 * Resolved once; the env var is read at first use, not per request.
 */
export function getInflightLimiter(): Semaphore | null {
  if (shared !== undefined) return shared;

  const raw = process.env.CLASH_API_MAX_INFLIGHT;
  const capacity = raw === undefined || raw === '' ? DEFAULT_MAX_INFLIGHT : Number(raw);

  if (!Number.isFinite(capacity) || capacity <= 0) {
    shared = null;
    return shared;
  }

  shared = new Semaphore(capacity);
  return shared;
}
