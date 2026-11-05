import type { SQLInputValue } from 'node:sqlite';
import type { Db } from './connection';

export type SqlParams = SQLInputValue[];

export function queryAll(db: Db, sql: string, params: SqlParams = []): Record<string, unknown>[] {
  return db.prepare(sql).all(...params) as Record<string, unknown>[];
}

export function queryOne(db: Db, sql: string, params: SqlParams = []): Record<string, unknown> | undefined {
  const row = db.prepare(sql).get(...params);
  return row as Record<string, unknown> | undefined;
}

export function execute(db: Db, sql: string, params: SqlParams = []): number {
  return Number(db.prepare(sql).run(...params).changes);
}

export function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new Error(`Expected ${key} to be a string`);
  }
  return value;
}

export function readNullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`Expected ${key} to be a string or null`);
  }
  return value;
}

export function readNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  throw new Error(`Expected ${key} to be a number`);
}

export function readBoolean(row: Record<string, unknown>, key: string): boolean {
  return readNumber(row, key) === 1;
}

export function readDate(row: Record<string, unknown>, key: string): Date {
  return new Date(readString(row, key));
}

export function readNullableDate(row: Record<string, unknown>, key: string): Date | null {
  const value = readNullableString(row, key);
  return value ? new Date(value) : null;
}

export function iso(value: Date): string {
  return value.toISOString();
}
