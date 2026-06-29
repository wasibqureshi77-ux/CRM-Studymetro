const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface RequestOptions extends RequestInit {
  // Option to override or bypass default headers
}

export async function apiFetch(path: string, options: RequestOptions = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('student_token') : null;

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
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
      localStorage.removeItem('student_token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch {}
    throw new Error(errorJson?.message || errorText || 'Request failed');
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path: string, options?: RequestOptions) =>
    apiFetch(path, { ...options, method: 'GET' }),
  post: (path: string, body?: any, options?: RequestOptions) =>
    apiFetch(path, { 
      ...options, 
      method: 'POST', 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  patch: (path: string, body?: any, options?: RequestOptions) =>
    apiFetch(path, { 
      ...options, 
      method: 'PATCH', 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  delete: (path: string, options?: RequestOptions) =>
    apiFetch(path, { ...options, method: 'DELETE' }),
};
