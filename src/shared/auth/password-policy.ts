import { Errors } from '../kernel/errors';

export function assertPasswordPolicy(password: string): void {
  if (password.length < 10 || password.length > 128) {
    throw Errors.validation('Password must be between 10 and 128 characters');
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw Errors.validation('Password must include at least one letter and one number');
  }
}
