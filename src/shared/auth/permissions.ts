import { Errors } from '../kernel/errors';

export const ROLES = ['owner', 'admin', 'dispatcher', 'technician', 'billing', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'members:read',
  'members:write',
  'customers:read',
  'customers:write',
  'work_orders:read',
  'work_orders:write',
  'work_orders:dispatch',
  'work_orders:execute',
  'inventory:read',
  'inventory:write',
  'billing:read',
  'billing:write',
  'reports:read',
  'audit:read',
  'notifications:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = PERMISSIONS;

const MATRIX: Record<Role, readonly Permission[]> = {
  owner: ALL,
  admin: ALL,
  dispatcher: [
    'members:read',
    'customers:read',
    'customers:write',
    'work_orders:read',
    'work_orders:write',
    'work_orders:dispatch',
    'work_orders:execute',
    'inventory:read',
    'reports:read',
    'notifications:read',
  ],
  technician: ['work_orders:read', 'work_orders:execute', 'inventory:read', 'notifications:read'],
  billing: [
    'customers:read',
    'work_orders:read',
    'inventory:read',
    'billing:read',
    'billing:write',
    'reports:read',
    'notifications:read',
  ],
  viewer: [
    'members:read',
    'customers:read',
    'work_orders:read',
    'inventory:read',
    'billing:read',
    'reports:read',
    'notifications:read',
  ],
};

export function permissionsFor(role: Role): readonly Permission[] {
  return MATRIX[role];
}

export function roleHas(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function assertRole(role: Role, permission: Permission): void {
  if (!roleHas(role, permission)) {
    throw Errors.forbidden();
  }
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
