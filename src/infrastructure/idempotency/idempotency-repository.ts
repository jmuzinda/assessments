import type { IdempotencyRecord, IdempotencyStore } from '../../shared/application/ports';
import type { Db } from '../db/connection';
import { iso, queryOne, readDate, readNumber, readString } from '../db/rows';

export class IdempotencyRepository implements IdempotencyStore {
  constructor(private readonly db: Db) {}

  get(organizationId: string, userId: string, key: string): IdempotencyRecord | undefined {
    const row = queryOne(
      this.db,
      `SELECT * FROM idempotency_keys
       WHERE organization_id = ? AND user_id = ? AND idempotency_key = ?`,
      [organizationId, userId, key],
    );
    if (!row) {
      return undefined;
    }
    return {
      organizationId: readString(row, 'organization_id'),
      userId: readString(row, 'user_id'),
      key: readString(row, 'idempotency_key'),
      requestHash: readString(row, 'request_hash'),
      statusCode: readNumber(row, 'status_code'),
      response: JSON.parse(readString(row, 'response_json')) as unknown,
      createdAt: readDate(row, 'created_at'),
    };
  }

  put(record: IdempotencyRecord): void {
    this.db
      .prepare(
        `INSERT INTO idempotency_keys (
           organization_id, user_id, idempotency_key, request_hash, status_code, response_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.organizationId,
        record.userId,
        record.key,
        record.requestHash,
        record.statusCode,
        JSON.stringify(record.response),
        iso(record.createdAt),
      );
  }
}
