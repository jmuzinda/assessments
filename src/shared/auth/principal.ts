import type { Role } from './permissions';

export interface Principal {
  userId: string;
  organizationId: string;
  role: Role;
  email: string;
  name: string;
}
