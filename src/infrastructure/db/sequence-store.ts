import type { SequenceStore } from '../../shared/application/ports';
import type { Db } from './connection';
import { queryOne, readNumber } from './rows';

export class SqliteSequenceStore implements SequenceStore {
  constructor(private readonly db: Db) {}

  next(organizationId: string, name: string): number {
    const row = queryOne(
      this.db,
      `INSERT INTO sequences (organization_id, name, value)
       VALUES (?, ?, 1001)
       ON CONFLICT(organization_id, name) DO UPDATE SET value = value + 1
       RETURNING value`,
      [organizationId, name],
    );
    if (!row) {
      throw new Error('Sequence insert did not return a value');
    }
    return readNumber(row, 'value');
  }
}
