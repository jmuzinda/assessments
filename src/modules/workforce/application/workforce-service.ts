import type { UnitOfWork } from '../../../shared/application/ports';
import type { Principal } from '../../../shared/auth/principal';
import type { Clock } from '../../../shared/kernel/clock';
import { Errors } from '../../../shared/kernel/errors';
import type { IdGenerator } from '../../../shared/kernel/id';
import { assertNonNegativeInt } from '../../../shared/kernel/money';
import type { ActivityRecorder } from '../../activity/application/activity-recorder';
import type { MembershipStore } from '../../identity/application/ports';
import type { TechnicianProfile, TechnicianView } from '../domain/types';
import type { TechnicianStore } from './ports';

export class WorkforceService {
  constructor(
    private readonly technicians: TechnicianStore,
    private readonly memberships: MembershipStore,
    private readonly activity: ActivityRecorder,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  create(
    principal: Principal,
    input: { userId: string; skills: string[]; hourlyRateCents: number },
  ): TechnicianProfile {
    assertNonNegativeInt(input.hourlyRateCents, 'hourlyRateCents');
    const skills = input.skills.map((skill) => skill.trim()).filter((skill) => skill.length > 0);
    if (skills.length === 0) {
      throw Errors.validation('A technician needs at least one skill');
    }
    return this.unitOfWork.run(() => {
      const membership = this.memberships.find(principal.organizationId, input.userId);
      if (!membership || membership.role !== 'technician') {
        throw Errors.validation('Technician profiles can only be created for members with the technician role');
      }
      if (this.technicians.findByUser(principal.organizationId, input.userId)) {
        throw Errors.conflict('This member already has a technician profile');
      }
      const profile: TechnicianProfile = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        userId: input.userId,
        skills,
        hourlyRateCents: input.hourlyRateCents,
        active: true,
        createdAt: this.clock.now(),
      };
      this.technicians.insert(profile);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'technician.created',
        entityType: 'technician',
        entityId: profile.id,
        metadata: { userId: profile.userId, hourlyRateCents: profile.hourlyRateCents },
      });
      return profile;
    });
  }

  list(principal: Principal): TechnicianView[] {
    return this.technicians.list(principal.organizationId);
  }
}
