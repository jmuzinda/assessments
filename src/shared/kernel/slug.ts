import { Errors } from './errors';

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (slug.length < 2) {
    throw Errors.validation('Organization name must contain at least two letters or numbers');
  }
  return slug;
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
