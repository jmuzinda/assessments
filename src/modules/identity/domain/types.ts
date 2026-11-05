import type { PlanName } from '../../../config/constants';
import type { Role } from '../../../shared/auth/permissions';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: PlanName;
  status: 'active' | 'suspended';
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  status: 'active' | 'suspended';
  createdAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'suspended';
  createdAt: Date;
}

export interface Membership {
  organizationId: string;
  userId: string;
  role: Role;
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    createdAt: user.createdAt,
  };
}
