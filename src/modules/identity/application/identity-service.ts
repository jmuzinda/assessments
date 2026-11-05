import type { PlanLimits } from '../../../config/constants';
import { assertMemberCapacity } from '../../tenancy/domain/plan-policy';
import type { UnitOfWork } from '../../../shared/application/ports';
import { hashPassword, verifyPassword } from '../../../shared/auth/password';
import { assertPasswordPolicy } from '../../../shared/auth/password-policy';
import type { Role } from '../../../shared/auth/permissions';
import { isRole } from '../../../shared/auth/permissions';
import type { Principal } from '../../../shared/auth/principal';
import { signToken, verifyToken } from '../../../shared/auth/token';
import type { Clock } from '../../../shared/kernel/clock';
import { Errors } from '../../../shared/kernel/errors';
import type { IdGenerator } from '../../../shared/kernel/id';
import { slugify } from '../../../shared/kernel/slug';
import type { ActivityRecorder } from '../../activity/application/activity-recorder';
import { toPublicUser, type Membership, type PublicUser } from '../domain/types';
import type { MembershipStore, OrganizationStore, UserStore } from './ports';

const ASSIGNABLE_ROLES = ['admin', 'dispatcher', 'technician', 'billing', 'viewer'] as const;

export class IdentityService {
  constructor(
    private readonly organizations: OrganizationStore,
    private readonly users: UserStore,
    private readonly memberships: MembershipStore,
    private readonly activity: ActivityRecorder,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly config: {
      jwtSecret: string;
      tokenTtlSeconds: number;
      scryptCost: number;
      planLimits: PlanLimits;
    },
    private readonly limitLogin: (key: string, nowMs: number) => void,
  ) {}

  async register(input: {
    organizationName: string;
    plan: 'starter' | 'professional' | 'enterprise';
    name: string;
    email: string;
    password: string;
  }): Promise<{ token: string; user: PublicUser; organization: { id: string; name: string; slug: string; plan: string }; membership: Membership }> {
    assertPasswordPolicy(input.password);
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password, { cost: this.config.scryptCost });
    return this.unitOfWork.run(() => {
      if (this.users.findByEmail(email)) {
        throw Errors.conflict('Email is already registered');
      }
      const now = this.clock.now();
      const organization = {
        id: this.ids.next(),
        name: input.organizationName.trim(),
        slug: this.uniqueSlug(input.organizationName),
        plan: input.plan,
        status: 'active' as const,
        createdAt: now,
      };
      const user = {
        id: this.ids.next(),
        email,
        name: input.name.trim(),
        passwordHash,
        status: 'active' as const,
        createdAt: now,
      };
      const membership: Membership = {
        organizationId: organization.id,
        userId: user.id,
        role: 'owner',
        createdAt: now,
      };
      this.organizations.insert(organization);
      this.users.insert(user);
      this.memberships.insert(membership);
      this.activity.record({
        organizationId: organization.id,
        actorId: user.id,
        action: 'organization.registered',
        entityType: 'organization',
        entityId: organization.id,
        eventType: 'organization.registered',
        payload: { organizationId: organization.id, slug: organization.slug },
      });
      return {
        token: this.issueToken(user.id, organization.id, now),
        user: toPublicUser(user),
        organization: { id: organization.id, name: organization.name, slug: organization.slug, plan: organization.plan },
        membership,
      };
    });
  }

  async login(input: { email: string; password: string; organizationSlug?: string; ip: string }): Promise<{
    token: string;
    user: PublicUser;
    organization: { id: string; name: string; slug: string; plan: string };
    membership: Membership;
  }> {
    this.limitLogin(`login:${input.ip}`, this.clock.now().getTime());
    const email = normalizeEmail(input.email);
    const user = this.users.findByEmail(email);
    const passwordOk = user ? await verifyPassword(input.password, user.passwordHash) : await this.fakeVerify(input.password);
    if (!user || user.status !== 'active' || !passwordOk) {
      throw Errors.unauthenticated('Invalid email or password');
    }
    const membership = this.resolveMembership(user.id, input.organizationSlug);
    const organization = this.organizations.findById(membership.organizationId);
    if (!organization || organization.status !== 'active') {
      throw Errors.unauthenticated('Invalid email or password');
    }
    return {
      token: this.issueToken(user.id, organization.id, this.clock.now()),
      user: toPublicUser(user),
      organization: { id: organization.id, name: organization.name, slug: organization.slug, plan: organization.plan },
      membership,
    };
  }

  authenticate(token: string): Principal {
    const claims = verifyToken(token, this.config.jwtSecret, this.clock.now());
    const user = this.users.findById(claims.sub);
    const membership = user ? this.memberships.find(claims.org, user.id) : undefined;
    if (!user || user.status !== 'active' || !membership) {
      throw Errors.unauthenticated('Invalid access token');
    }
    const organization = this.organizations.findById(membership.organizationId);
    if (!organization || organization.status !== 'active') {
      throw Errors.unauthenticated('Invalid access token');
    }
    return {
      userId: user.id,
      organizationId: organization.id,
      role: membership.role,
      email: user.email,
      name: user.name,
    };
  }

  async addMember(
    principal: Principal,
    input: { name: string; email: string; password: string; role: string },
  ): Promise<{ user: PublicUser; membership: Membership }> {
    if (!isRole(input.role) || !(ASSIGNABLE_ROLES as readonly string[]).includes(input.role)) {
      throw Errors.validation('Role must be admin, dispatcher, technician, billing, or viewer');
    }
    assertPasswordPolicy(input.password);
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password, { cost: this.config.scryptCost });
    return this.unitOfWork.run(() => {
      const organization = this.requireOrganization(principal.organizationId);
      const current = this.memberships.count(organization.id);
      assertMemberCapacity(organization.plan, current, this.config.planLimits[organization.plan]);
      if (this.users.findByEmail(email)) {
        throw Errors.conflict('Email is already registered');
      }
      const now = this.clock.now();
      const user = {
        id: this.ids.next(),
        email,
        name: input.name.trim(),
        passwordHash,
        status: 'active' as const,
        createdAt: now,
      };
      const membership: Membership = {
        organizationId: organization.id,
        userId: user.id,
        role: input.role as Role,
        createdAt: now,
      };
      this.users.insert(user);
      this.memberships.insert(membership);
      this.activity.record({
        organizationId: organization.id,
        actorId: principal.userId,
        action: 'member.added',
        entityType: 'user',
        entityId: user.id,
        eventType: 'member.added',
        payload: { userId: user.id, role: membership.role },
      });
      return { user: toPublicUser(user), membership };
    });
  }

  listMembers(principal: Principal): Array<{ user: PublicUser; membership: Membership }> {
    return this.memberships.listByOrganization(principal.organizationId).map((membership) => {
      const user = this.users.findById(membership.userId);
      if (!user) {
        throw Errors.notFound('User');
      }
      return { user: toPublicUser(user), membership };
    });
  }

  private resolveMembership(userId: string, organizationSlug?: string): Membership {
    const memberships = this.memberships.listByUser(userId);
    if (organizationSlug) {
      const organization = this.organizations.findBySlug(organizationSlug);
      const membership = organization ? memberships.find((item) => item.organizationId === organization.id) : undefined;
      if (!membership) {
        throw Errors.unauthenticated('Invalid email or password');
      }
      return membership;
    }
    if (memberships.length !== 1) {
      throw Errors.validation('organizationSlug is required when the user belongs to multiple organizations');
    }
    const only = memberships[0];
    if (!only) {
      throw Errors.unauthenticated('Invalid email or password');
    }
    return only;
  }

  private uniqueSlug(name: string): string {
    const base = slugify(name);
    let slug = base;
    let suffix = 2;
    while (this.organizations.findBySlug(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }

  private requireOrganization(id: string) {
    const organization = this.organizations.findById(id);
    if (!organization) {
      throw Errors.notFound('Organization');
    }
    return organization;
  }

  private issueToken(userId: string, organizationId: string, now: Date): string {
    return signToken({
      userId,
      organizationId,
      secret: this.config.jwtSecret,
      ttlSeconds: this.config.tokenTtlSeconds,
      now,
    });
  }

  private async fakeVerify(password: string): Promise<boolean> {
    await hashPassword(password, { cost: this.config.scryptCost });
    return false;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
