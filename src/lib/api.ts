import { getValidIdToken } from './auth';

function apiBaseUrl() {
  const runtime = window.__env ?? {};
  const value = runtime.VITE_API_URL ?? import.meta.env.VITE_API_URL;
  if (!value) {
    throw new Error('The GK Shoppy API is not configured. Set VITE_API_URL.');
  }
  return value.replace(/\/+$/, '');
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (authenticated) {
    const token = await getValidIdToken();
    if (!token) throw new Error('Please sign in to continue.');
    headers.set('authorization', `Bearer ${token}`);
  }

  const result = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
    headers,
  });
  const payload: unknown = await result.json().catch(() => null);
  if (!result.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `The API request failed (${result.status}).`;
    throw new Error(message);
  }
  return payload as T;
}
