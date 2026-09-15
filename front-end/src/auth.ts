const API = import.meta.env.VITE_API_URL || '/api';
const PORTAL_LOGIN = import.meta.env.VITE_PORTAL_LOGIN_URL || 'http://192.168.42.191/login';

function getToken(): string | null {
  return localStorage.getItem('token');
}

function tokenExpirado(): boolean {
  const token = getToken();
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function irAlPortal() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = PORTAL_LOGIN;
}

export function verificarSesion() {
  if (tokenExpirado()) {
    irAlPortal();
    return false;
  }
  return true;
}

export async function loginDesdePortal(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/auth/portal-login`, {
      credentials: 'include',
    });
    if (!res.ok) {
      irAlPortal();
      return false;
    }
    const data = await res.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    return true;
  } catch {
    irAlPortal();
    return false;
  }
}

export async function fetchAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  if (tokenExpirado()) {
    const ok = await loginDesdePortal();
    if (!ok) return Promise.reject(new Error('Sesión expirada'));
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${getToken()}`);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    const ok = await loginDesdePortal();
    if (!ok) return Promise.reject(new Error('Sesión expirada'));
    headers.set('Authorization', `Bearer ${getToken()}`);
    return fetch(url, { ...options, headers });
  }

  return res;
}

export { API };
