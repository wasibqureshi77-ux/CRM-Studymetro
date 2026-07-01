function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'; // Target NestJS backend API port

export interface RequestOptions extends RequestInit {
  tenantId?: string;
}

export async function apiFetch(path: string, options: RequestOptions = {}) {
  const token = getCookie('sm_session');
  // Tenant ID resolved from cookie or manual override
  const tenantId = options.tenantId || getCookie('sm_tenant_id') || '';

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (tenantId) {
    headers.set('x-tenant-id', tenantId);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      // Clear cookies and redirect to login
      document.cookie = 'sm_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // Not JSON
    }
    throw new Error(errorJson?.message || errorText || 'Request failed');
  }

  // Handle empty or JSON responses
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path: string, options?: RequestOptions) =>
    apiFetch(path, { ...options, method: 'GET' }),
  post: (path: string, body?: any, options?: RequestOptions) =>
    apiFetch(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body?: any, options?: RequestOptions) =>
    apiFetch(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: (path: string, body?: any, options?: RequestOptions) =>
    apiFetch(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string, options?: RequestOptions) =>
    apiFetch(path, { ...options, method: 'DELETE' }),
};
