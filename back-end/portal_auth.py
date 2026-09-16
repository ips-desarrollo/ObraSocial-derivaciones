"""Middleware SSO del portal IPSM para FastAPI.

Verifica la cookie `ipsm_portal` (firmada con HMAC-SHA256) en cada request.
Si es válida y el usuario tiene acceso al sistema, inyecta los datos del
usuario en `request.state.portal_user`. Caso contrario devuelve 401/403.
"""

import base64
import hashlib
import hmac
import json
import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

COOKIE_NAME = "ipsm_portal"
SESSION_SECRET = os.getenv("SESSION_SECRET", "")
if not SESSION_SECRET:
    raise RuntimeError(
        "SESSION_SECRET no está configurado. Es obligatorio para validar "
        "las cookies del portal SSO. Configuralo en el .env."
    )
SISTEMA_CODIGO = os.getenv("SISTEMA_CODIGO", "obra_social")
LOGIN_URL = os.getenv("PORTAL_LOGIN_URL", "http://192.168.42.191/login")

_RUTAS_PUBLICAS = frozenset({"/", "/health", "/docs", "/openapi.json"})


def _b64url_decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


def _b64url_encode_no_pad(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _verificar_cookie(cookie_value: str) -> dict | None:
    if not SESSION_SECRET:
        return None
    dot = cookie_value.rfind(".")
    if dot < 0:
        return None
    payload_b64 = cookie_value[:dot]
    firma_recibida = cookie_value[dot + 1:]

    mac = hmac.new(
        SESSION_SECRET.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    )
    firma_esperada = _b64url_encode_no_pad(mac.digest())

    if not hmac.compare_digest(firma_esperada, firma_recibida):
        return None

    try:
        payload_bytes = _b64url_decode(payload_b64)
        return json.loads(payload_bytes)
    except (json.JSONDecodeError, Exception):
        return None


class PortalAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path.rstrip("/") or "/"

        if path in _RUTAS_PUBLICAS or request.method == "OPTIONS":
            return await call_next(request)

        cookie = request.cookies.get(COOKIE_NAME)
        if not cookie:
            print(f"[SSO] 401 sin cookie — path={path} cookies={list(request.cookies.keys())}")
            return JSONResponse(
                status_code=401,
                content={
                    "detail": "No autenticado en el portal",
                    "login_url": LOGIN_URL,
                },
            )

        session = _verificar_cookie(cookie)
        if session is None:
            print(f"[SSO] 401 firma inválida — path={path} cookie_len={len(cookie)}")
            return JSONResponse(
                status_code=401,
                content={
                    "detail": "Sesión del portal inválida o expirada",
                    "login_url": LOGIN_URL,
                },
            )

        sistemas = session.get("sistemas", [])
        tiene_acceso = any(
            s.get("sistema_codigo") == SISTEMA_CODIGO for s in sistemas
        )
        if not tiene_acceso:
            return JSONResponse(
                status_code=403,
                content={
                    "detail": f"No tenés acceso al sistema '{SISTEMA_CODIGO}'",
                    "login_url": LOGIN_URL,
                },
            )

        request.state.portal_user = session
        return await call_next(request)
