export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = (await response.json()) as {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    throw new ApiError(response.status, payload.error?.code ?? 'INTERNAL', payload.error?.message ?? 'Request failed');
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Request failed';
}
