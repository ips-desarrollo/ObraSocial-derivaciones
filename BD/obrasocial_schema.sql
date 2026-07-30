-- ==========================================
-- SCHEMA COMPLETO - BASE DE DATOS POSTGRESQL "obrasocial"
-- Ejecutar en orden en la BD obrasocial del VPS
-- ==========================================

-- Extensión para generar UUIDs (viene incluida en PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. TABLA DE ROLES
-- ==========================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion VARCHAR(255),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (nombre, descripcion) VALUES
    ('admin', 'Administrador con acceso total'),
    ('operador', 'Operador con acceso limitado a consultas y edición de afiliados'),
    ('lectura', 'Solo lectura, sin acceso a la sección de usuarios ni edición de datos')
ON CONFLICT (nombre) DO NOTHING;

-- ==========================================
-- 2. TABLA DE USUARIOS (inicio de sesión)
-- ==========================================
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    actualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);

-- ==========================================
-- 3. TABLA INTERMEDIA USUARIOS <-> ROLES
-- ==========================================
CREATE TABLE IF NOT EXISTS usuarios_roles (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    asignado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    asignado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    UNIQUE (usuario_id, rol_id)
);

-- ==========================================
-- 4. TABLA DE AUDITORÍA
-- ==========================================
-- Registra cada cambio individual (un registro por campo modificado).
-- No se reemplaza: cada cambio genera una fila nueva.
CREATE TABLE IF NOT EXISTS auditoria (
    id BIGSERIAL PRIMARY KEY,
    -- Quién hizo el cambio
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    usuario_email VARCHAR(150),
    -- Dónde se hizo el cambio
    base_datos VARCHAR(50) NOT NULL,      -- 'sqlserver' o 'postgres'
    esquema VARCHAR(100),                  -- schema de la tabla (dbo, public, etc.)
    tabla VARCHAR(100) NOT NULL,
    -- Qué registro se modificó (clave primaria del registro afectado)
    registro_id VARCHAR(255) NOT NULL,     -- valor de la PK del registro (ej: documento del afiliado)
    -- Qué tipo de operación
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    -- Qué campo se modificó
    columna VARCHAR(100),                  -- NULL en INSERT/DELETE de fila completa
    valor_anterior TEXT,
    valor_nuevo TEXT,
    -- Cuándo
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Contexto extra opcional (IP, endpoint, etc.)
    detalle JSONB
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria (base_datos, tabla);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON auditoria (tabla, registro_id);

-- ==========================================
-- 5. FUNCIÓN Y TRIGGER PARA ACTUALIZAR actualizado_en
-- ==========================================
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_actualizar_timestamp ON usuarios;
CREATE TRIGGER trg_usuarios_actualizar_timestamp
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

-- ==========================================
-- 6. FUNCIÓN Y TRIGGER DE AUDITORÍA AUTOMÁTICA PARA TABLA usuarios
-- ==========================================
CREATE OR REPLACE FUNCTION auditar_usuarios()
RETURNS TRIGGER AS $$
DECLARE
    col TEXT;
    val_old TEXT;
    val_new TEXT;
    uid INTEGER;
BEGIN
    uid := COALESCE(
        current_setting('app.usuario_id', true)::INTEGER,
        NULL
    );

    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria (usuario_id, usuario_email, base_datos, esquema, tabla, registro_id, operacion, columna, valor_anterior, valor_nuevo)
        VALUES (uid, NEW.email, 'postgres', TG_TABLE_SCHEMA, TG_TABLE_NAME, NEW.id::TEXT, 'INSERT', NULL, NULL, row_to_json(NEW)::TEXT);
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO auditoria (usuario_id, usuario_email, base_datos, esquema, tabla, registro_id, operacion, columna, valor_anterior, valor_nuevo)
        VALUES (uid, OLD.email, 'postgres', TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id::TEXT, 'DELETE', NULL, row_to_json(OLD)::TEXT, NULL);
        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Compara campo por campo y genera una fila por cada cambio
        FOREACH col IN ARRAY ARRAY['nombre_completo', 'email', 'password_hash', 'activo']
        LOOP
            EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', col, col)
                INTO val_old, val_new
                USING OLD, NEW;

            IF val_old IS DISTINCT FROM val_new THEN
                INSERT INTO auditoria (usuario_id, usuario_email, base_datos, esquema, tabla, registro_id, operacion, columna, valor_anterior, valor_nuevo)
                VALUES (uid, COALESCE(NEW.email, OLD.email), 'postgres', TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id::TEXT, 'UPDATE', col, val_old, val_new);
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
    FOR EACH ROW
    EXECUTE FUNCTION auditar_usuarios();

-- ==========================================
-- 7. FUNCIÓN Y TRIGGER DE AUDITORÍA PARA usuarios_roles
-- ==========================================
CREATE OR REPLACE FUNCTION auditar_usuarios_roles()
RETURNS TRIGGER AS $$
DECLARE
    uid INTEGER;
BEGIN
    uid := COALESCE(
        current_setting('app.usuario_id', true)::INTEGER,
        NULL
    );

    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria (usuario_id, base_datos, esquema, tabla, registro_id, operacion, columna, valor_anterior, valor_nuevo)
        VALUES (uid, 'postgres', TG_TABLE_SCHEMA, TG_TABLE_NAME, NEW.usuario_id::TEXT, 'INSERT', 'rol_id', NULL, NEW.rol_id::TEXT);
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO auditoria (usuario_id, base_datos, esquema, tabla, registro_id, operacion, columna, valor_anterior, valor_nuevo)
        VALUES (uid, 'postgres', TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.usuario_id::TEXT, 'DELETE', 'rol_id', OLD.rol_id::TEXT, NULL);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditar_usuarios_roles ON usuarios_roles;
CREATE TRIGGER trg_auditar_usuarios_roles
    AFTER INSERT OR DELETE ON usuarios_roles
    FOR EACH ROW
    EXECUTE FUNCTION auditar_usuarios_roles();
