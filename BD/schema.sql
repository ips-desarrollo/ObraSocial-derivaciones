-- ==========================================
-- ESTRUCTURA INICIAL DE BASE DE DATOS (POSTGRESQL)
-- ==========================================

-- Nota: En PostgreSQL, la base de datos se suele crear previamente
-- desde el panel de Dokploy o mediante comandos administrativos.
-- Las tablas se crean dentro de la base de datos conectada.

-- Tabla de afiliados (ejemplo práctico para el negocio de Obra Social)
CREATE TABLE IF NOT EXISTS afiliados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    dni VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice para el DNI para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_afiliados_dni ON afiliados (dni);

-- Insertar datos de prueba iniciales
INSERT INTO afiliados (nombre, apellido, dni, email, activo) VALUES 
('Juan', 'Pérez', '35123456', 'juan.perez@email.com', TRUE),
('María', 'Gómez', '38987654', 'maria.gomez@email.com', TRUE),
('Carlos', 'Rodríguez', '41223344', 'carlos.rod@email.com', FALSE)
ON CONFLICT (dni) DO NOTHING;
