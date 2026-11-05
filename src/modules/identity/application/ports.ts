import type { Membership, Organization, User } from '../domain/types';

export interface OrganizationStore {
  insert(organization: Organization): void;
  findById(id: string): Organization | undefined;
  findBySlug(slug: string): Organization | undefined;
}

export interface UserStore {
  insert(user: User): void;
  findById(id: string): User | undefined;
  findByEmail(email: string): User | undefined;
}

export interface MembershipStore {
  insert(membership: Membership): void;
  find(organizationId: string, userId: string): Membership | undefined;
  listByUser(userId: string): Membership[];
  listByOrganization(organizationId: string): Membership[];
  count(organizationId: string): number;
}
