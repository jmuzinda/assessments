export function money(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = String(absolute % 100).padStart(2, '0');
  return `${sign}$${dollars.toLocaleString('en-US')}.${remainder}`;
}

export function when(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function toIso(localValue: string): string {
  return new Date(localValue).toISOString();
}
