export interface TechnicianProfile {
  id: string;
  organizationId: string;
  userId: string;
  skills: string[];
  hourlyRateCents: number;
  active: boolean;
  createdAt: Date;
}

export interface TechnicianView extends TechnicianProfile {
  name: string;
  email: string;
}
