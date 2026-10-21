export class Context {
  public problems: string[] = [];

  public constructor(public readonly apply: boolean) {}

  /** Runs a write only with --apply; otherwise prints what it would do. */
  public async write(description: string, fn: () => Promise<unknown>) {
    console.log(`${this.apply ? '[apply]' : '[dry-run]'} ${description}`);
    if (this.apply) await fn();
  }

  public problem(message: string) {
    this.problems.push(message);
    console.log(`  PROBLEM: ${message}`);
  }
}

export const BACKUP_SUFFIX = '_bak_season_split';
