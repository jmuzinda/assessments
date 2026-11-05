import type { Role } from './types';

export type Permission =
  | 'members:read'
  | 'members:write'
  | 'customers:read'
  | 'customers:write'
  | 'work_orders:read'
  | 'work_orders:write'
  | 'work_orders:dispatch'
  | 'work_orders:execute'
  | 'inventory:read'
  | 'inventory:write'
  | 'billing:read'
  | 'billing:write'
  | 'reports:read'
  | 'audit:read'
  | 'notifications:read';

const ALL: readonly Permission[] = [
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
];

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

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) {
    return false;
  }
  return MATRIX[role].includes(permission);
}
