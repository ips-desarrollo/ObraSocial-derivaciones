const API = import.meta.env.VITE_API_URL || '/api';

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

function irAlLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/';
}

export function verificarSesion() {
  if (tokenExpirado()) {
    irAlLogin();
    return false;
  }
  return true;
}

export async function fetchAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  if (tokenExpirado()) {
    irAlLogin();
    return Promise.reject(new Error('Sesión expirada'));
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${getToken()}`);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    irAlLogin();
    return Promise.reject(new Error('Sesión expirada'));
  }

  return res;
}

export { API };
