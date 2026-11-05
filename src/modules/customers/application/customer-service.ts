import type { UnitOfWork } from '../../../shared/application/ports';
import type { Principal } from '../../../shared/auth/principal';
import type { Clock } from '../../../shared/kernel/clock';
import { Errors } from '../../../shared/kernel/errors';
import type { IdGenerator } from '../../../shared/kernel/id';
import type { Page } from '../../../shared/kernel/pagination';
import type { ActivityRecorder } from '../../activity/application/activity-recorder';
import { assertAssetTransition } from '../domain/asset-state';
import type { Asset, AssetStatus, Customer, CustomerStatus, Site } from '../domain/types';
import type { CustomerStore } from './ports';

export class CustomerService {
  constructor(
    private readonly customers: CustomerStore,
    private readonly activity: ActivityRecorder,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  create(
    principal: Principal,
    input: { name: string; email?: string | null; phone?: string | null },
  ): Customer {
    return this.unitOfWork.run(() => {
      const now = this.clock.now();
      const customer: Customer = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        name: input.name.trim(),
        email: blankToNull(input.email),
        phone: blankToNull(input.phone),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      this.customers.insertCustomer(customer);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'customer.created',
        entityType: 'customer',
        entityId: customer.id,
        eventType: 'customer.created',
        payload: { customerId: customer.id, name: customer.name },
      });
      return customer;
    });
  }

  update(
    principal: Principal,
    id: string,
    input: { name?: string; email?: string | null; phone?: string | null; status?: CustomerStatus },
  ): Customer {
    return this.unitOfWork.run(() => {
      const existing = this.requireCustomer(principal.organizationId, id);
      const updated: Customer = {
        ...existing,
        name: input.name?.trim() || existing.name,
        email: input.email === undefined ? existing.email : blankToNull(input.email),
        phone: input.phone === undefined ? existing.phone : blankToNull(input.phone),
        status: input.status ?? existing.status,
        updatedAt: this.clock.now(),
      };
      this.customers.updateCustomer(updated);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'customer.updated',
        entityType: 'customer',
        entityId: updated.id,
        metadata: { status: updated.status },
      });
      return updated;
    });
  }

  get(principal: Principal, id: string): Customer {
    return this.requireCustomer(principal.organizationId, id);
  }

  list(principal: Principal, filter: { limit: number; offset: number; query?: string; status?: CustomerStatus }): Page<Customer> {
    const result = this.customers.listCustomers(principal.organizationId, filter);
    return { items: result.rows, total: result.total, limit: filter.limit, offset: filter.offset };
  }

  addSite(
    principal: Principal,
    customerId: string,
    input: {
      name: string;
      line1: string;
      city: string;
      region: string;
      postalCode: string;
      country: string;
      timezone: string;
    },
  ): Site {
    return this.unitOfWork.run(() => {
      this.requireCustomer(principal.organizationId, customerId);
      const site: Site = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        customerId,
        name: input.name.trim(),
        address: {
          line1: input.line1.trim(),
          city: input.city.trim(),
          region: input.region.trim(),
          postalCode: input.postalCode.trim(),
          country: input.country.trim(),
        },
        timezone: input.timezone,
        createdAt: this.clock.now(),
      };
      this.customers.insertSite(site);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'site.created',
        entityType: 'site',
        entityId: site.id,
        metadata: { customerId },
      });
      return site;
    });
  }

  listSites(principal: Principal, customerId: string): Site[] {
    this.requireCustomer(principal.organizationId, customerId);
    return this.customers.listSites(principal.organizationId, customerId);
  }

  addAsset(
    principal: Principal,
    siteId: string,
    input: { name: string; serialNumber: string; category: string },
  ): Asset {
    return this.unitOfWork.run(() => {
      const site = this.requireSite(principal.organizationId, siteId);
      const now = this.clock.now();
      const asset: Asset = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        siteId: site.id,
        name: input.name.trim(),
        serialNumber: input.serialNumber.trim(),
        category: input.category.trim(),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      this.customers.insertAsset(asset);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'asset.created',
        entityType: 'asset',
        entityId: asset.id,
        metadata: { siteId: site.id },
      });
      return asset;
    });
  }

  listAssets(principal: Principal, siteId: string): Asset[] {
    this.requireSite(principal.organizationId, siteId);
    return this.customers.listAssets(principal.organizationId, siteId);
  }

  changeAssetStatus(principal: Principal, id: string, status: AssetStatus): Asset {
    return this.unitOfWork.run(() => {
      const asset = this.customers.findAsset(principal.organizationId, id);
      if (!asset) {
        throw Errors.notFound('Asset');
      }
      assertAssetTransition(asset.status, status);
      const updated = { ...asset, status, updatedAt: this.clock.now() };
      this.customers.updateAsset(updated);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'asset.status_changed',
        entityType: 'asset',
        entityId: asset.id,
        metadata: { from: asset.status, to: status },
      });
      return updated;
    });
  }

  private requireCustomer(organizationId: string, id: string): Customer {
    const customer = this.customers.findCustomer(organizationId, id);
    if (!customer) {
      throw Errors.notFound('Customer');
    }
    return customer;
  }

  private requireSite(organizationId: string, id: string): Site {
    const site = this.customers.findSite(organizationId, id);
    if (!site) {
      throw Errors.notFound('Site');
    }
    return site;
  }
}

function blankToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
