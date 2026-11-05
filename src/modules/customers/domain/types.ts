export interface Address {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export type CustomerStatus = 'active' | 'inactive';
export type AssetStatus = 'active' | 'maintenance' | 'retired';

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Site {
  id: string;
  organizationId: string;
  customerId: string;
  name: string;
  address: Address;
  timezone: string;
  createdAt: Date;
}

export interface Asset {
  id: string;
  organizationId: string;
  siteId: string;
  name: string;
  serialNumber: string;
  category: string;
  status: AssetStatus;
  createdAt: Date;
  updatedAt: Date;
}
