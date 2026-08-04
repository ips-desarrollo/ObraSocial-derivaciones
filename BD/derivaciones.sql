-- Tablas guía
CREATE TABLE IF NOT EXISTS cobertura (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_traslado (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_alojamiento (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_patologia (
    id SERIAL PRIMARY KEY,
    tipo_pat VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tratamiento (
    id SERIAL PRIMARY KEY,
    tratamiento VARCHAR(200) NOT NULL UNIQUE
);

-- Tabla principal
CREATE TABLE IF NOT EXISTS derivacion (
    id_derivacion SERIAL PRIMARY KEY,
    mes VARCHAR(20),
    nro_disposicion VARCHAR(50),
    fecha DATE NOT NULL,
    expediente VARCHAR(50),
    afiliado_documento VARCHAR(20) NOT NULL,
    afiliado_nombre VARCHAR(200) NOT NULL,
    afiliado_credencial VARCHAR(50),
    afiliado_edad INTEGER,
    afiliado_sexo VARCHAR(20),
    tipo_patologia VARCHAR(100),
    diagnostico TEXT,
    tratamiento TEXT,
    fecha_turno DATE,
    id_tipo_patologia INTEGER REFERENCES tipo_patologia(id),
    id_tratamiento INTEGER REFERENCES tratamiento(id),
    diagnostico_tratamiento TEXT,
    creado_en TIMESTAMP DEFAULT NOW(),
    creado_por VARCHAR(100)
);

-- Prestación médica (1:1 con derivación)
CREATE TABLE IF NOT EXISTS derivacion_prestacion (
    id SERIAL PRIMARY KEY,
    id_derivacion INTEGER NOT NULL UNIQUE REFERENCES derivacion(id_derivacion) ON DELETE CASCADE,
    destino VARCHAR(200),
    id_cobertura INTEGER REFERENCES cobertura(id),
    centro_medico VARCHAR(200),
    monto_prestacion NUMERIC(12, 2)
);

-- Traslado (opcional, 1:1)
CREATE TABLE IF NOT EXISTS derivacion_traslado (
    id SERIAL PRIMARY KEY,
    id_derivacion INTEGER NOT NULL UNIQUE REFERENCES derivacion(id_derivacion) ON DELETE CASCADE,
    id_tipo_traslado INTEGER REFERENCES tipo_traslado(id),
    cant_acompanantes INTEGER DEFAULT 0,
    monto_traslado NUMERIC(12, 2)
);

-- Alojamiento (opcional, 1:1)
CREATE TABLE IF NOT EXISTS derivacion_alojamiento (
    id SERIAL PRIMARY KEY,
    id_derivacion INTEGER NOT NULL UNIQUE REFERENCES derivacion(id_derivacion) ON DELETE CASCADE,
    id_cobertura_alojamiento INTEGER REFERENCES cobertura(id),
    id_tipo_alojamiento INTEGER REFERENCES tipo_alojamiento(id),
    lugar_alojamiento VARCHAR(200),
    cant_noches INTEGER,
    monto_alojamiento NUMERIC(12, 2)
);

CREATE INDEX idx_derivacion_mes ON derivacion(mes);
CREATE INDEX idx_derivacion_documento ON derivacion(afiliado_documento);
