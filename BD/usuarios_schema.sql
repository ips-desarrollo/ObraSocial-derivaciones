-- ============================================================================
--  BASE DE DATOS CENTRALIZADA DE IDENTIDAD  ->  "usuarios"
--  PostgreSQL
-- ----------------------------------------------------------------------------
--  Objetivo:
--    Centralizar en UNA sola base ("usuarios") la gestion de usuarios, roles,
--    permisos y auditoria para TODOS los sistemas de la organizacion
--    (obra_social, oncologia, y los futuros que se agreguen).
--
--    En PostgreSQL NO existen claves foraneas entre bases distintas. Por eso
--    toda la identidad vive dentro de esta base y cada sistema se conecta a
--    ella para autenticar y autorizar. Un mismo usuario puede pertenecer a
--    varios sistemas, con roles distintos en cada uno.
--
--  Modelo de seguridad:
--    - Un usuario es GLOBAL (una sola credencial para todos los sistemas).
--    - "usuarios_sistemas" define a QUE sistemas puede entrar cada usuario.
--    - Los roles y permisos estan SCOPEADOS por sistema (sistema_id).
--    - La consistencia (que un rol pertenezca al sistema al que el usuario
--      tiene acceso) se garantiza por FK compuestas, no por logica de app.
--
--  Como se ejecuta:
--    1) Crear la base (una sola vez, conectado a otra base, ej. "postgres"):
--         CREATE DATABASE usuarios
--             WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'es_AR.UTF-8' LC_CTYPE 'es_AR.UTF-8';
--       (En Dokploy/panel administrativo se puede crear desde la UI.)
--    2) Conectarse a la base "usuarios" y ejecutar este script completo.
-- ============================================================================


-- ============================================================================
--  0. EXTENSIONES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid(), hashing
CREATE EXTENSION IF NOT EXISTS "citext";    -- email case-insensitive (unicidad real)


-- ============================================================================
--  1. FUNCION AUXILIAR: actualiza automaticamente "actualizado_en"
-- ============================================================================
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
--  2. SISTEMAS
--     Cada aplicacion que se conecta a esta base central.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemas (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(50)  UNIQUE NOT NULL,   -- 'obra_social', 'oncologia'
    nombre          VARCHAR(150) NOT NULL,
    descripcion     VARCHAR(255),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_sistemas_ts ON sistemas;
CREATE TRIGGER trg_sistemas_ts
    BEFORE UPDATE ON sistemas
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();


-- ============================================================================
--  3. USUARIOS (identidad global + seguridad de acceso)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id                        SERIAL PRIMARY KEY,
    nombre_completo           VARCHAR(150) NOT NULL,
    email                     CITEXT       UNIQUE NOT NULL,   -- unico e insensible a mayus/minus
    password_hash             VARCHAR(255) NOT NULL,          -- SIEMPRE hash (bcrypt/argon2), nunca texto plano

    -- Estado / seguridad de la cuenta
    activo                    BOOLEAN      NOT NULL DEFAULT TRUE,
    email_verificado          BOOLEAN      NOT NULL DEFAULT FALSE,
    requiere_cambio_password  BOOLEAN      NOT NULL DEFAULT FALSE,
    password_actualizado_en   TIMESTAMP,

    -- Proteccion contra fuerza bruta
    intentos_fallidos         INTEGER      NOT NULL DEFAULT 0,
    bloqueado_hasta           TIMESTAMP,                      -- si > now(), la cuenta esta bloqueada
    ultimo_acceso             TIMESTAMP,

    -- Segundo factor (opcional, listo para activar)
    dos_factores_activo       BOOLEAN      NOT NULL DEFAULT FALSE,
    dos_factores_secreto      VARCHAR(255),                   -- secreto TOTP cifrado a nivel app

    -- Auditoria de fila
    creado_en                 TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creado_por                INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
    actualizado_por           INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email  ON usuarios (email);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios (activo);

DROP TRIGGER IF EXISTS trg_usuarios_ts ON usuarios;
CREATE TRIGGER trg_usuarios_ts
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();


-- ============================================================================
--  4. USUARIOS_SISTEMAS  (a que sistemas puede entrar cada usuario)
--     Relacion N:M usuario <-> sistema. Es la "membresia".
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios_sistemas (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER   NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sistema_id    INTEGER   NOT NULL REFERENCES sistemas(id) ON DELETE CASCADE,
    activo        BOOLEAN   NOT NULL DEFAULT TRUE,             -- se puede suspender el acceso a UN sistema
    fecha_alta    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asignado_por  INTEGER   REFERENCES usuarios(id) ON DELETE SET NULL,

    UNIQUE (usuario_id, sistema_id)
);

-- Clave necesaria para las FK compuestas de usuarios_roles (ver seccion 8)
ALTER TABLE usuarios_sistemas
    ADD CONSTRAINT uq_usuarios_sistemas_par UNIQUE (usuario_id, sistema_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_sistemas_usuario ON usuarios_sistemas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_sistemas_sistema ON usuarios_sistemas (sistema_id);


-- ============================================================================
--  5. ROLES  (scopeados por sistema)
--     El mismo nombre de rol ('admin') puede existir en varios sistemas y
--     significar cosas distintas.
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id           SERIAL PRIMARY KEY,
    sistema_id   INTEGER      NOT NULL REFERENCES sistemas(id) ON DELETE CASCADE,
    nombre       VARCHAR(50)  NOT NULL,
    descripcion  VARCHAR(255),
    creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (sistema_id, nombre)
);

-- Clave para FK compuestas (garantiza rol->sistema en usuarios_roles y roles_permisos)
ALTER TABLE roles
    ADD CONSTRAINT uq_roles_id_sistema UNIQUE (id, sistema_id);

CREATE INDEX IF NOT EXISTS idx_roles_sistema ON roles (sistema_id);


-- ============================================================================
--  6. PERMISOS  (granularidad fina, scopeados por sistema)
--     Cada permiso es una accion concreta: 'afiliados.ver', 'usuarios.editar'.
-- ============================================================================
CREATE TABLE IF NOT EXISTS permisos (
    id           SERIAL PRIMARY KEY,
    sistema_id   INTEGER      NOT NULL REFERENCES sistemas(id) ON DELETE CASCADE,
    codigo       VARCHAR(100) NOT NULL,                    -- 'modulo.accion'
    nombre       VARCHAR(150) NOT NULL,
    descripcion  VARCHAR(255),
    creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (sistema_id, codigo)
);

ALTER TABLE permisos
    ADD CONSTRAINT uq_permisos_id_sistema UNIQUE (id, sistema_id);

CREATE INDEX IF NOT EXISTS idx_permisos_sistema ON permisos (sistema_id);


-- ============================================================================
--  7. ROLES_PERMISOS  (que permisos otorga cada rol)
--     La FK compuesta obliga a que rol y permiso pertenezcan AL MISMO sistema.
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles_permisos (
    id           SERIAL PRIMARY KEY,
    sistema_id   INTEGER   NOT NULL REFERENCES sistemas(id) ON DELETE CASCADE,
    rol_id       INTEGER   NOT NULL,
    permiso_id   INTEGER   NOT NULL,
    asignado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (rol_id, permiso_id),

    -- rol pertenece a sistema_id
    CONSTRAINT fk_rp_rol
        FOREIGN KEY (rol_id, sistema_id)
        REFERENCES roles (id, sistema_id) ON DELETE CASCADE,

    -- permiso pertenece a sistema_id  ->  imposible mezclar permisos de otro sistema
    CONSTRAINT fk_rp_permiso
        FOREIGN KEY (permiso_id, sistema_id)
        REFERENCES permisos (id, sistema_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_roles_permisos_rol     ON roles_permisos (rol_id);
CREATE INDEX IF NOT EXISTS idx_roles_permisos_permiso ON roles_permisos (permiso_id);


-- ============================================================================
--  8. USUARIOS_ROLES  (que rol tiene un usuario en un sistema)
--     Doble FK compuesta:
--       - (usuario_id, sistema_id) debe existir en usuarios_sistemas
--         => el usuario es miembro de ese sistema.
--       - (rol_id, sistema_id) debe existir en roles
--         => el rol pertenece a ese sistema.
--     Resultado: es IMPOSIBLE asignar a un usuario un rol de un sistema al que
--     no tiene acceso. Consistencia garantizada por la base, no por la app.
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios_roles (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER   NOT NULL,
    sistema_id    INTEGER   NOT NULL,
    rol_id        INTEGER   NOT NULL,
    asignado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asignado_por  INTEGER   REFERENCES usuarios(id) ON DELETE SET NULL,

    UNIQUE (usuario_id, rol_id),

    CONSTRAINT fk_ur_membresia
        FOREIGN KEY (usuario_id, sistema_id)
        REFERENCES usuarios_sistemas (usuario_id, sistema_id) ON DELETE CASCADE,

    CONSTRAINT fk_ur_rol
        FOREIGN KEY (rol_id, sistema_id)
        REFERENCES roles (id, sistema_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usuarios_roles_usuario ON usuarios_roles (usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_roles_rol     ON usuarios_roles (rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_roles_sistema ON usuarios_roles (sistema_id);


-- ============================================================================
--  9. SESIONES  (refresh tokens / control de sesion activa)
--     Se guarda el HASH del token, nunca el token en claro.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sesiones (
    id            BIGSERIAL PRIMARY KEY,
    usuario_id    INTEGER   NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sistema_id    INTEGER   REFERENCES sistemas(id) ON DELETE SET NULL,  -- desde que sistema inicio sesion
    token_hash    VARCHAR(255) NOT NULL UNIQUE,        -- hash del refresh token
    user_agent    VARCHAR(255),
    ip            INET,
    creada_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en     TIMESTAMP NOT NULL,
    revocada_en   TIMESTAMP                            -- si != NULL, la sesion fue cerrada/revocada
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones (usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira  ON sesiones (expira_en);


-- ============================================================================
-- 10. INTENTOS_LOGIN  (bitacora de accesos para deteccion de ataques)
-- ============================================================================
CREATE TABLE IF NOT EXISTS intentos_login (
    id           BIGSERIAL PRIMARY KEY,
    usuario_id   INTEGER   REFERENCES usuarios(id) ON DELETE SET NULL,  -- NULL si el email no existe
    email        CITEXT    NOT NULL,                    -- lo que se intento (aunque no exista)
    sistema_id   INTEGER   REFERENCES sistemas(id) ON DELETE SET NULL,
    exito        BOOLEAN   NOT NULL,
    motivo       VARCHAR(100),                          -- 'password_incorrecta', 'cuenta_bloqueada', etc.
    ip           INET,
    user_agent   VARCHAR(255),
    fecha        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intentos_login_email ON intentos_login (email, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_intentos_login_ip    ON intentos_login (ip, fecha DESC);


-- ============================================================================
-- 11. TOKENS_RECUPERACION  (reset de password / verificacion de email)
--     Se guarda solo el hash del token; expira y es de un solo uso.
-- ============================================================================
CREATE TABLE IF NOT EXISTS tokens_recuperacion (
    id          BIGSERIAL PRIMARY KEY,
    usuario_id  INTEGER   NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo        VARCHAR(30) NOT NULL CHECK (tipo IN ('reset_password', 'verificar_email')),
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en   TIMESTAMP NOT NULL,
    usado_en    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tokens_recup_usuario ON tokens_recuperacion (usuario_id);


-- ============================================================================
-- 12. AUDITORIA  (bitacora central de cambios sobre la identidad)
--     Un registro por cambio individual. Nunca se actualiza: se agrega.
-- ============================================================================
CREATE TABLE IF NOT EXISTS auditoria (
    id             BIGSERIAL PRIMARY KEY,
    -- Quien
    usuario_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    usuario_email  CITEXT,
    -- Donde
    sistema_id     INTEGER REFERENCES sistemas(id) ON DELETE SET NULL,
    esquema        VARCHAR(100),
    tabla          VARCHAR(100) NOT NULL,
    registro_id    VARCHAR(255) NOT NULL,
    -- Que
    operacion      VARCHAR(10)  NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    columna        VARCHAR(100),
    valor_anterior TEXT,
    valor_nuevo    TEXT,
    -- Cuando + contexto
    fecha          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detalle        JSONB
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha    ON auditoria (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla    ON auditoria (tabla);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario  ON auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON auditoria (tabla, registro_id);


-- ============================================================================
-- 13. AUDITORIA AUTOMATICA (triggers)
--     Reutiliza el patron del sistema actual: current_setting('app.usuario_id').
--     La app debe hacer, dentro de la transaccion:
--         SET LOCAL app.usuario_id = '<id del usuario logueado>';
-- ============================================================================

-- 13.1  usuarios
CREATE OR REPLACE FUNCTION auditar_usuarios()
RETURNS TRIGGER AS $$
DECLARE
    col     TEXT;
    val_old TEXT;
    val_new TEXT;
    uid     INTEGER;
BEGIN
    uid := current_setting('app.usuario_id', true)::INTEGER;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria (usuario_id, usuario_email, esquema, tabla, registro_id, operacion, valor_nuevo)
        VALUES (uid, NEW.email, TG_TABLE_SCHEMA, TG_TABLE_NAME, NEW.id::TEXT, 'INSERT', row_to_json(NEW)::TEXT);
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO auditoria (usuario_id, usuario_email, esquema, tabla, registro_id, operacion, valor_anterior)
        VALUES (uid, OLD.email, TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id::TEXT, 'DELETE', row_to_json(OLD)::TEXT);
        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
        FOREACH col IN ARRAY ARRAY['nombre_completo','email','password_hash','activo','email_verificado',
                                   'dos_factores_activo','bloqueado_hasta']
        LOOP
            EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', col, col)
                INTO val_old, val_new USING OLD, NEW;
            IF val_old IS DISTINCT FROM val_new THEN
                -- No se registra el valor del hash de password, solo que cambio
                IF col = 'password_hash' THEN
                    val_old := '***'; val_new := '***';
                END IF;
                INSERT INTO auditoria (usuario_id, usuario_email, esquema, tabla, registro_id, operacion, columna, valor_anterior, valor_nuevo)
                VALUES (uid, COALESCE(NEW.email, OLD.email), TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id::TEXT, 'UPDATE', col, val_old, val_new);
            END IF;
        END LOOP;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditar_usuarios ON usuarios;
CREATE TRIGGER trg_auditar_usuarios
    AFTER INSERT OR UPDATE OR DELETE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION auditar_usuarios();


-- 13.2  Auditoria generica para tablas de asignacion (INSERT/DELETE)
--       usuarios_roles, usuarios_sistemas, roles_permisos
CREATE OR REPLACE FUNCTION auditar_asignacion()
RETURNS TRIGGER AS $$
DECLARE
    uid INTEGER;
BEGIN
    uid := current_setting('app.usuario_id', true)::INTEGER;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria (usuario_id, esquema, tabla, registro_id, operacion, valor_nuevo)
        VALUES (uid, TG_TABLE_SCHEMA, TG_TABLE_NAME, NEW.id::TEXT, 'INSERT', row_to_json(NEW)::TEXT);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO auditoria (usuario_id, esquema, tabla, registro_id, operacion, valor_anterior)
        VALUES (uid, TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id::TEXT, 'DELETE', row_to_json(OLD)::TEXT);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditar_usuarios_roles ON usuarios_roles;
CREATE TRIGGER trg_auditar_usuarios_roles
    AFTER INSERT OR DELETE ON usuarios_roles
    FOR EACH ROW EXECUTE FUNCTION auditar_asignacion();

DROP TRIGGER IF EXISTS trg_auditar_usuarios_sistemas ON usuarios_sistemas;
CREATE TRIGGER trg_auditar_usuarios_sistemas
    AFTER INSERT OR DELETE ON usuarios_sistemas
    FOR EACH ROW EXECUTE FUNCTION auditar_asignacion();

DROP TRIGGER IF EXISTS trg_auditar_roles_permisos ON roles_permisos;
CREATE TRIGGER trg_auditar_roles_permisos
    AFTER INSERT OR DELETE ON roles_permisos
    FOR EACH ROW EXECUTE FUNCTION auditar_asignacion();


-- ============================================================================
-- 14. VISTA DE CONSULTA: permisos efectivos de cada usuario por sistema
--     La app pregunta a esta vista "¿este usuario tiene tal permiso?".
-- ============================================================================
CREATE OR REPLACE VIEW v_usuarios_permisos AS
SELECT DISTINCT
    u.id            AS usuario_id,
    u.email,
    s.id            AS sistema_id,
    s.codigo        AS sistema_codigo,
    p.codigo        AS permiso_codigo
FROM usuarios u
JOIN usuarios_sistemas us ON us.usuario_id = u.id AND us.activo
JOIN sistemas s           ON s.id = us.sistema_id AND s.activo
JOIN usuarios_roles ur    ON ur.usuario_id = u.id AND ur.sistema_id = s.id
JOIN roles r              ON r.id = ur.rol_id
JOIN roles_permisos rp    ON rp.rol_id = r.id
JOIN permisos p           ON p.id = rp.permiso_id
WHERE u.activo
  AND (u.bloqueado_hasta IS NULL OR u.bloqueado_hasta < CURRENT_TIMESTAMP);


-- ============================================================================
-- 15. LIMPIEZA DE DATOS TEMPORALES
--     Estas tablas crecen constantemente y no deben conservarse para siempre.
--     Se limpian con criterios distintos:
--       - intentos_login : por ANTIGUEDAD (deja de servir para deteccion).
--       - sesiones       : por ESTADO (token ya vencido o revocado = inutil).
--       - tokens_recuperacion : usados o vencidos.
--     La auditoria NO se toca: es traza historica y se conserva.
--
--     Correr esta funcion una vez por dia desde un cron / tarea programada:
--         SELECT limpiar_datos_temporales();
--     (Si el VPS tiene la extension pg_cron, se puede agendar dentro de la BD.)
-- ============================================================================
CREATE OR REPLACE FUNCTION limpiar_datos_temporales()
RETURNS void AS $$
BEGIN
    -- Intentos de login con mas de 90 dias: ya no aportan a la deteccion.
    DELETE FROM intentos_login
    WHERE fecha < CURRENT_TIMESTAMP - INTERVAL '90 days';

    -- Sesiones muertas: el token ya vencio o fue revocado, no sirve para entrar.
    DELETE FROM sesiones
    WHERE expira_en < CURRENT_TIMESTAMP
       OR revocada_en IS NOT NULL;

    -- Tokens de recuperacion ya usados o vencidos.
    DELETE FROM tokens_recuperacion
    WHERE usado_en IS NOT NULL
       OR expira_en < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 16. DATOS INICIALES (seed)
-- ============================================================================

-- 15.1  Sistemas
INSERT INTO sistemas (codigo, nombre, descripcion) VALUES
    ('obra_social', 'Obra Social', 'Gestion de afiliados y derivaciones'),
    ('oncologia',   'Oncologia',   'Sistema de oncologia')
ON CONFLICT (codigo) DO NOTHING;

-- 15.2  Roles del sistema obra_social (equivalentes a los actuales)
INSERT INTO roles (sistema_id, nombre, descripcion)
SELECT s.id, v.nombre, v.descripcion
FROM sistemas s
CROSS JOIN (VALUES
    ('admin',    'Administrador con acceso total'),
    ('operador', 'Operador: consulta y edicion de afiliados'),
    ('lectura',  'Solo lectura')
) AS v(nombre, descripcion)
WHERE s.codigo = 'obra_social'
ON CONFLICT (sistema_id, nombre) DO NOTHING;

-- 15.3  Permisos del sistema obra_social
INSERT INTO permisos (sistema_id, codigo, nombre, descripcion)
SELECT s.id, v.codigo, v.nombre, v.descripcion
FROM sistemas s
CROSS JOIN (VALUES
    ('afiliados.ver',     'Ver afiliados',     'Consultar el listado y ficha de afiliados'),
    ('afiliados.editar',  'Editar afiliados',  'Crear y modificar afiliados'),
    ('derivaciones.ver',  'Ver derivaciones',  'Consultar derivaciones'),
    ('derivaciones.editar','Editar derivaciones','Crear y modificar derivaciones'),
    ('usuarios.ver',      'Ver usuarios',      'Consultar usuarios del sistema'),
    ('usuarios.editar',   'Editar usuarios',   'Crear, editar y asignar roles a usuarios')
) AS v(codigo, nombre, descripcion)
WHERE s.codigo = 'obra_social'
ON CONFLICT (sistema_id, codigo) DO NOTHING;

-- 15.4  admin de obra_social = todos los permisos de ese sistema
INSERT INTO roles_permisos (sistema_id, rol_id, permiso_id)
SELECT r.sistema_id, r.id, p.id
FROM roles r
JOIN sistemas s   ON s.id = r.sistema_id AND s.codigo = 'obra_social'
JOIN permisos p   ON p.sistema_id = r.sistema_id
WHERE r.nombre = 'admin'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- 15.5  operador de obra_social = ver/editar afiliados y derivaciones (sin usuarios)
INSERT INTO roles_permisos (sistema_id, rol_id, permiso_id)
SELECT r.sistema_id, r.id, p.id
FROM roles r
JOIN sistemas s ON s.id = r.sistema_id AND s.codigo = 'obra_social'
JOIN permisos p ON p.sistema_id = r.sistema_id
                AND p.codigo IN ('afiliados.ver','afiliados.editar','derivaciones.ver','derivaciones.editar')
WHERE r.nombre = 'operador'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- 15.6  lectura de obra_social = solo *.ver
INSERT INTO roles_permisos (sistema_id, rol_id, permiso_id)
SELECT r.sistema_id, r.id, p.id
FROM roles r
JOIN sistemas s ON s.id = r.sistema_id AND s.codigo = 'obra_social'
JOIN permisos p ON p.sistema_id = r.sistema_id AND p.codigo LIKE '%.ver'
WHERE r.nombre = 'lectura'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- 15.7  Usuario administrador inicial
--       Reemplazar el hash por uno real (bcrypt/argon2) generado por la app.
--       Ejemplo de placeholder (NO usar en produccion tal cual):
INSERT INTO usuarios (nombre_completo, email, password_hash, activo, email_verificado)
VALUES ('Administrador', 'admin@obrasocial.local', 'REEMPLAZAR_POR_HASH_REAL', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- 15.8  Dar acceso del admin al sistema obra_social y asignarle el rol admin
INSERT INTO usuarios_sistemas (usuario_id, sistema_id)
SELECT u.id, s.id
FROM usuarios u, sistemas s
WHERE u.email = 'admin@obrasocial.local' AND s.codigo = 'obra_social'
ON CONFLICT (usuario_id, sistema_id) DO NOTHING;

INSERT INTO usuarios_roles (usuario_id, sistema_id, rol_id)
SELECT u.id, s.id, r.id
FROM usuarios u, sistemas s, roles r
WHERE u.email = 'admin@obrasocial.local'
  AND s.codigo = 'obra_social'
  AND r.sistema_id = s.id AND r.nombre = 'admin'
ON CONFLICT (usuario_id, rol_id) DO NOTHING;

-- ============================================================================
--  FIN DEL SCRIPT
-- ============================================================================
