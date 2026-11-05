import type { SQLInputValue } from 'node:sqlite';
import type { Db } from '../../../infrastructure/db/connection';
import {
  iso,
  queryAll,
  queryOne,
  readDate,
  readNullableString,
  readString,
} from '../../../infrastructure/db/rows';
import { escapeLike } from '../../../shared/kernel/slug';
import type { CustomerListFilter } from '../application/ports';
import type { Asset, Customer, Site } from '../domain/types';

export class CustomerRepository {
  constructor(private readonly db: Db) {}

  insertCustomer(customer: Customer): void {
    this.db
      .prepare(
        `INSERT INTO customers (id, organization_id, name, email, phone, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        customer.id,
        customer.organizationId,
        customer.name,
        customer.email,
        customer.phone,
        customer.status,
        iso(customer.createdAt),
        iso(customer.updatedAt),
      );
  }

  updateCustomer(customer: Customer): void {
    this.db
      .prepare(
        `UPDATE customers
         SET name = ?, email = ?, phone = ?, status = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
      )
      .run(
        customer.name,
        customer.email,
        customer.phone,
        customer.status,
        iso(customer.updatedAt),
        customer.id,
        customer.organizationId,
      );
  }

  findCustomer(organizationId: string, id: string): Customer | undefined {
    const row = queryOne(this.db, 'SELECT * FROM customers WHERE organization_id = ? AND id = ?', [
      organizationId,
      id,
    ]);
    return row ? this.mapCustomer(row) : undefined;
  }

  listCustomers(organizationId: string, filter: CustomerListFilter): { rows: Customer[]; total: number } {
    const where = ['organization_id = ?'];
    const params: SQLInputValue[] = [organizationId];
    if (filter.status) {
      where.push('status = ?');
      params.push(filter.status);
    }
    if (filter.query) {
      where.push("name LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(filter.query)}%`);
    }
    const clause = where.join(' AND ');
    const totalRow = queryOne(this.db, `SELECT COUNT(*) AS count FROM customers WHERE ${clause}`, params);
    const rows = queryAll(
      this.db,
      `SELECT * FROM customers WHERE ${clause} ORDER BY name LIMIT ? OFFSET ?`,
      [...params, filter.limit, filter.offset],
    ).map((row) => this.mapCustomer(row));
    return { rows, total: totalRow ? Number(totalRow.count) : 0 };
  }

  insertSite(site: Site): void {
    this.db
      .prepare(
        `INSERT INTO sites (
           id, organization_id, customer_id, name, line1, city, region, postal_code, country, timezone, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        site.id,
        site.organizationId,
        site.customerId,
        site.name,
        site.address.line1,
        site.address.city,
        site.address.region,
        site.address.postalCode,
        site.address.country,
        site.timezone,
        iso(site.createdAt),
      );
  }

  findSite(organizationId: string, id: string): Site | undefined {
    const row = queryOne(this.db, 'SELECT * FROM sites WHERE organization_id = ? AND id = ?', [organizationId, id]);
    return row ? this.mapSite(row) : undefined;
  }

  listSites(organizationId: string, customerId: string): Site[] {
    return queryAll(
      this.db,
      'SELECT * FROM sites WHERE organization_id = ? AND customer_id = ? ORDER BY name',
      [organizationId, customerId],
    ).map((row) => this.mapSite(row));
  }

  insertAsset(asset: Asset): void {
    this.db
      .prepare(
        `INSERT INTO assets (
           id, organization_id, site_id, name, serial_number, category, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        asset.id,
        asset.organizationId,
        asset.siteId,
        asset.name,
        asset.serialNumber,
        asset.category,
        asset.status,
        iso(asset.createdAt),
        iso(asset.updatedAt),
      );
  }

  updateAsset(asset: Asset): void {
    this.db
      .prepare(
        `UPDATE assets SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      )
      .run(asset.status, iso(asset.updatedAt), asset.id, asset.organizationId);
  }

  findAsset(organizationId: string, id: string): Asset | undefined {
    const row = queryOne(this.db, 'SELECT * FROM assets WHERE organization_id = ? AND id = ?', [organizationId, id]);
    return row ? this.mapAsset(row) : undefined;
  }

  listAssets(organizationId: string, siteId: string): Asset[] {
    return queryAll(
      this.db,
      'SELECT * FROM assets WHERE organization_id = ? AND site_id = ? ORDER BY name',
      [organizationId, siteId],
    ).map((row) => this.mapAsset(row));
  }

  private mapCustomer(row: Record<string, unknown>): Customer {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      name: readString(row, 'name'),
      email: readNullableString(row, 'email'),
      phone: readNullableString(row, 'phone'),
      status: readString(row, 'status') as Customer['status'],
      createdAt: readDate(row, 'created_at'),
      updatedAt: readDate(row, 'updated_at'),
    };
  }

  private mapSite(row: Record<string, unknown>): Site {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      customerId: readString(row, 'customer_id'),
      name: readString(row, 'name'),
      address: {
        line1: readString(row, 'line1'),
        city: readString(row, 'city'),
        region: readString(row, 'region'),
        postalCode: readString(row, 'postal_code'),
        country: readString(row, 'country'),
      },
      timezone: readString(row, 'timezone'),
      createdAt: readDate(row, 'created_at'),
    };
  }

  private mapAsset(row: Record<string, unknown>): Asset {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      siteId: readString(row, 'site_id'),
      name: readString(row, 'name'),
      serialNumber: readString(row, 'serial_number'),
      category: readString(row, 'category'),
      status: readString(row, 'status') as Asset['status'],
      createdAt: readDate(row, 'created_at'),
      updatedAt: readDate(row, 'updated_at'),
    };
  }
}
