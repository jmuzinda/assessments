import type { Asset, Customer, Site } from '../domain/types';
import type { PageQuery } from '../../../shared/kernel/pagination';

export interface CustomerListFilter extends PageQuery {
  query?: string;
  status?: Customer['status'];
}

export interface CustomerStore {
  insertCustomer(customer: Customer): void;
  updateCustomer(customer: Customer): void;
  findCustomer(organizationId: string, id: string): Customer | undefined;
  listCustomers(organizationId: string, filter: CustomerListFilter): { rows: Customer[]; total: number };
  insertSite(site: Site): void;
  findSite(organizationId: string, id: string): Site | undefined;
  listSites(organizationId: string, customerId: string): Site[];
  insertAsset(asset: Asset): void;
  updateAsset(asset: Asset): void;
  findAsset(organizationId: string, id: string): Asset | undefined;
  listAssets(organizationId: string, siteId: string): Asset[];
}
