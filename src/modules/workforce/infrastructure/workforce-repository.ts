import type { Db } from '../../../infrastructure/db/connection';
import { iso, queryAll, queryOne, readBoolean, readDate, readNumber, readString } from '../../../infrastructure/db/rows';
import type { TechnicianProfile, TechnicianView } from '../domain/types';

export class WorkforceRepository {
  constructor(private readonly db: Db) {}

  insert(profile: TechnicianProfile): void {
    this.db
      .prepare(
        `INSERT INTO technician_profiles (
           id, organization_id, user_id, skills_json, hourly_rate_cents, active, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        profile.id,
        profile.organizationId,
        profile.userId,
        JSON.stringify(profile.skills),
        profile.hourlyRateCents,
        profile.active ? 1 : 0,
        iso(profile.createdAt),
      );
  }

  findById(organizationId: string, id: string): TechnicianProfile | undefined {
    const row = queryOne(this.db, 'SELECT * FROM technician_profiles WHERE organization_id = ? AND id = ?', [
      organizationId,
      id,
    ]);
    return row ? this.map(row) : undefined;
  }

  findByUser(organizationId: string, userId: string): TechnicianProfile | undefined {
    const row = queryOne(
      this.db,
      'SELECT * FROM technician_profiles WHERE organization_id = ? AND user_id = ?',
      [organizationId, userId],
    );
    return row ? this.map(row) : undefined;
  }

  list(organizationId: string): TechnicianView[] {
    return queryAll(
      this.db,
      `SELECT technician_profiles.*, users.name AS user_name, users.email AS user_email
       FROM technician_profiles
       JOIN users ON users.id = technician_profiles.user_id
       WHERE technician_profiles.organization_id = ?
       ORDER BY users.name`,
      [organizationId],
    ).map((row) => ({
      ...this.map(row),
      name: readString(row, 'user_name'),
      email: readString(row, 'user_email'),
    }));
  }

  private map(row: Record<string, unknown>): TechnicianProfile {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      userId: readString(row, 'user_id'),
      skills: JSON.parse(readString(row, 'skills_json')) as string[],
      hourlyRateCents: readNumber(row, 'hourly_rate_cents'),
      active: readBoolean(row, 'active'),
      createdAt: readDate(row, 'created_at'),
    };
  }
}
