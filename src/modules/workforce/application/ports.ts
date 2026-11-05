import type { TechnicianProfile, TechnicianView } from '../domain/types';

export interface TechnicianStore {
  insert(profile: TechnicianProfile): void;
  findById(organizationId: string, id: string): TechnicianProfile | undefined;
  findByUser(organizationId: string, userId: string): TechnicianProfile | undefined;
  list(organizationId: string): TechnicianView[];
}
