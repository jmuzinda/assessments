import type { Db } from './connection';
import { migration001 } from './migrations/001_init';
import { migration002 } from './migrations/002_audit_index';

const migrations = [
  { id: '001_init', sql: migration001 },
  { id: '002_audit_index', sql: migration002 },
  // Candidate tasks add 003 and later here. See ASSESSMENT.md.
];

export function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  for (const migration of migrations) {
    const existing = db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get(migration.id);
    if (existing) {
      continue;
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
        migration.id,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
