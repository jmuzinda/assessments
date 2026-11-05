import type { MembershipStore, OrganizationStore, UserStore } from '../application/ports';
import type { IdentityRepository } from './identity-repository';

export function asOrganizationStore(repository: IdentityRepository): OrganizationStore {
  return {
    insert: (organization) => repository.insertOrganization(organization),
    findById: (id) => repository.findOrganizationById(id),
    findBySlug: (slug) => repository.findOrganizationBySlug(slug),
  };
}

export function asUserStore(repository: IdentityRepository): UserStore {
  return {
    insert: (user) => repository.insertUser(user),
    findById: (id) => repository.findUserById(id),
    findByEmail: (email) => repository.findUserByEmail(email),
  };
}

export function asMembershipStore(repository: IdentityRepository): MembershipStore {
  return {
    insert: (membership) => repository.insertMembership(membership),
    find: (organizationId, userId) => repository.findMembership(organizationId, userId),
    listByUser: (userId) => repository.listMembershipsByUser(userId),
    listByOrganization: (organizationId) => repository.listMembershipsByOrganization(organizationId),
    count: (organizationId) => repository.countMemberships(organizationId),
  };
}
