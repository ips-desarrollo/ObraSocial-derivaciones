# Base de datos `usuarios` — Documentación

Base de identidad centralizada (PostgreSQL). Gestiona **usuarios, roles, permisos y auditoría** para todos los sistemas de la organización (Obra Social, Oncología, y los que se sumen).

## 1. Lógica general

Cada sistema se conecta a esta base para autenticar y autorizar. En PostgreSQL no existen claves foráneas entre bases distintas, por eso toda la identidad vive acá.

- Un usuario es **global**: existe una sola vez, con una credencial única.
- `usuarios_sistemas` define a **qué sistemas** puede entrar cada usuario.
- Roles y permisos están **scopeados por sistema**: `admin` de Obra Social ≠ `admin` de Oncología.
- La consistencia (que un rol pertenezca al sistema al que el usuario tiene acceso) la garantizan **FK compuestas**, no la aplicación: es imposible asignar un rol de un sistema al que el usuario no está habilitado.

## 2. Tablas

**Núcleo**

| Tabla | Para qué |
|---|---|
| `sistemas` | Cada aplicación que usa la base (obra_social, oncologia…). |
| `usuarios` | Las personas: email + hash de contraseña + estado de seguridad (bloqueo, 2FA, verificación). |
| `roles` | Roles por sistema. |
| `permisos` | Acciones finas por sistema (`afiliados.editar`). |

**Enlaces (N:M)**

| Tabla | Para qué |
|---|---|
| `usuarios_sistemas` | A qué sistemas puede entrar cada usuario (membresía). |
| `usuarios_roles` | Qué rol tiene un usuario en un sistema. |
| `roles_permisos` | Qué permisos otorga cada rol. |

**Seguridad / operación**

| Tabla | Para qué |
|---|---|
| `sesiones` | Sesiones abiertas: hash del token de login, con vencimiento y revocación. |
| `intentos_login` | Bitácora de logins (éxito/fallo) para detectar fuerza bruta. |
| `tokens_recuperacion` | Tokens de un solo uso: reset de contraseña y verificación de email. |
| `auditoria` | Historial de cambios sobre la identidad (quién, qué, cuándo). No se borra. |

## 3. Índices

| Índice | Sirve para |
|---|---|
| `idx_usuarios_email` | Login: buscar la cuenta por email. |
| `idx_usuarios_activo` | Filtrar usuarios activos. |
| `idx_usuarios_sistemas_*` | Resolver membresías por usuario y por sistema. |
| `idx_roles_sistema` / `idx_permisos_sistema` | Listar roles y permisos de un sistema. |
| `idx_roles_permisos_*` / `idx_usuarios_roles_*` | Cruzar asignaciones al chequear permisos. |
| `idx_sesiones_usuario` / `idx_sesiones_expira` | Sesiones de un usuario y limpieza de vencidas. |
| `idx_intentos_login_email` / `_ip` | Contar fallos por email o IP (detección de ataques). |
| `idx_auditoria_*` | Consultar auditoría por fecha, tabla, usuario o registro. |

Además, las `UNIQUE` generan índices implícitos y habilitan las FK compuestas: `roles(id, sistema_id)`, `permisos(id, sistema_id)` y `usuarios_sistemas(usuario_id, sistema_id)`.

## 4. Vista

`v_usuarios_permisos` — cruce ya resuelto de **usuario × sistema × permiso**. Solo incluye usuarios activos, no bloqueados y con membresía activa. La app la consulta para responder "¿este usuario tiene tal permiso en tal sistema?" sin rearmar los joins cada vez.

## 5. Función de limpieza

`limpiar_datos_temporales()` — se corre 1 vez por día (cron / `pg_cron`). Borra:

- `intentos_login` de +90 días,
- `sesiones` vencidas o revocadas,
- `tokens_recuperacion` usados o vencidos.

La `auditoria` no se toca.

```sql
SELECT limpiar_datos_temporales();
```

## 6. Qué modificar en los INSERT (seed)

El script trae datos iniciales de ejemplo. Antes de producción, ajustar:

```sql
-- 15.7  Usuario admin: REEMPLAZAR el hash placeholder
INSERT INTO usuarios (nombre_completo, email, password_hash, ...)
VALUES ('Administrador', 'admin@obrasocial.local',
        'REEMPLAZAR_POR_HASH_REAL', ...);  -- ← hash bcrypt/argon2 real
```

- **`password_hash`** — cambiar `'REEMPLAZAR_POR_HASH_REAL'` por un hash generado por la app (bcrypt/argon2). Nunca texto plano.
- **email del admin** — reemplazar `admin@obrasocial.local` por el mail real del administrador.
- **`sistemas`** (15.1) — dejar solo los que existen hoy; agregar los nuevos a medida que se sumen.
- **roles y permisos** (15.2–15.6) — están seteados para `obra_social`; replicar el bloque para cada sistema nuevo con sus propios permisos.
- Los `ON CONFLICT DO NOTHING` hacen el seed **reejecutable** sin duplicar: se puede correr de nuevo sin romper nada.

---

`BD/usuarios_schema.sql` · 11 tablas · 1 vista · 1 función de limpieza
