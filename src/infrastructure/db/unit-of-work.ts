import { AsyncLocalStorage } from 'node:async_hooks';
import type { UnitOfWork } from '../../shared/application/ports';
import type { Db } from './connection';

const depth = new AsyncLocalStorage<number>();

export class SqliteUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(work: () => T): T {
    if ((depth.getStore() ?? 0) > 0) {
      return work();
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = depth.run(1, work);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async runAsync<T>(work: () => Promise<T>): Promise<T> {
    if ((depth.getStore() ?? 0) > 0) {
      return work();
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = await depth.run(1, work);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
