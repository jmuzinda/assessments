import type { Role } from '../../../shared/auth/permissions';
import type { PlanName } from '../../../config/constants';
import type { Membership, Organization, User } from '../domain/types';
import type { Db } from '../../../infrastructure/db/connection';
import { iso, queryAll, queryOne, readDate, readString } from '../../../infrastructure/db/rows';

export class IdentityRepository {
  constructor(private readonly db: Db) {}

  insertOrganization(organization: Organization): void {
    this.db
      .prepare(
        `INSERT INTO organizations (id, name, slug, plan, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        organization.id,
        organization.name,
        organization.slug,
        organization.plan,
        organization.status,
        iso(organization.createdAt),
      );
  }

  findOrganizationById(id: string): Organization | undefined {
    const row = queryOne(this.db, 'SELECT * FROM organizations WHERE id = ?', [id]);
    return row ? this.mapOrganization(row) : undefined;
  }

  findOrganizationBySlug(slug: string): Organization | undefined {
    const row = queryOne(this.db, 'SELECT * FROM organizations WHERE slug = ?', [slug]);
    return row ? this.mapOrganization(row) : undefined;
  }

  insertUser(user: User): void {
    this.db
      .prepare(
        `INSERT INTO users (id, email, name, password_hash, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(user.id, user.email, user.name, user.passwordHash, user.status, iso(user.createdAt));
  }

  findUserById(id: string): User | undefined {
    const row = queryOne(this.db, 'SELECT * FROM users WHERE id = ?', [id]);
    return row ? this.mapUser(row) : undefined;
  }

  findUserByEmail(email: string): User | undefined {
    const row = queryOne(this.db, 'SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    return row ? this.mapUser(row) : undefined;
  }

  insertMembership(membership: Membership): void {
    this.db
      .prepare(
        `INSERT INTO memberships (organization_id, user_id, role, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(membership.organizationId, membership.userId, membership.role, iso(membership.createdAt));
  }

  findMembership(organizationId: string, userId: string): Membership | undefined {
    const row = queryOne(
      this.db,
      'SELECT * FROM memberships WHERE organization_id = ? AND user_id = ?',
      [organizationId, userId],
    );
    return row ? this.mapMembership(row) : undefined;
  }

  listMembershipsByUser(userId: string): Membership[] {
    return queryAll(this.db, 'SELECT * FROM memberships WHERE user_id = ? ORDER BY created_at', [userId]).map((row) =>
      this.mapMembership(row),
    );
  }

  listMembershipsByOrganization(organizationId: string): Membership[] {
    return queryAll(
      this.db,
      'SELECT * FROM memberships WHERE organization_id = ? ORDER BY created_at',
      [organizationId],
    ).map((row) => this.mapMembership(row));
  }

  countMemberships(organizationId: string): number {
    const row = queryOne(this.db, 'SELECT COUNT(*) AS count FROM memberships WHERE organization_id = ?', [
      organizationId,
    ]);
    return row ? Number(row.count) : 0;
  }

  private mapOrganization(row: Record<string, unknown>): Organization {
    return {
      id: readString(row, 'id'),
      name: readString(row, 'name'),
      slug: readString(row, 'slug'),
      plan: readString(row, 'plan') as PlanName,
      status: readString(row, 'status') as Organization['status'],
      createdAt: readDate(row, 'created_at'),
    };
  }

  private mapUser(row: Record<string, unknown>): User {
    return {
      id: readString(row, 'id'),
      email: readString(row, 'email'),
      name: readString(row, 'name'),
      passwordHash: readString(row, 'password_hash'),
      status: readString(row, 'status') as User['status'],
      createdAt: readDate(row, 'created_at'),
    };
  }

  private mapMembership(row: Record<string, unknown>): Membership {
    return {
      organizationId: readString(row, 'organization_id'),
      userId: readString(row, 'user_id'),
      role: readString(row, 'role') as Role,
      createdAt: readDate(row, 'created_at'),
    };
  }
}
