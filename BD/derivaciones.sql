CREATE TABLE IF NOT EXISTS derivaciones (
    id              SERIAL PRIMARY KEY,
    mes             DATE NOT NULL,
    nro_disposicion VARCHAR(100),
    fecha           DATE,
    afiliado_documento  INT NOT NULL,
    afiliado_nombre     VARCHAR(250),
    afiliado_credencial VARCHAR(100),
    afiliado_edad       INT,
    afiliado_sexo       VARCHAR(30),
    destino             VARCHAR(250),
    cobertura_prestacion VARCHAR(250),
    centro_medico       VARCHAR(250),
    monto_prestacion    NUMERIC(12,2),
    expediente          VARCHAR(150),
    cant_acompanantes   INT,
    tipo_traslado       VARCHAR(150),
    monto_traslado      NUMERIC(12,2),
    cobertura_alojamiento VARCHAR(250),
    tipo_alojamiento    VARCHAR(150),
    lugar_alojamiento   VARCHAR(250),
    cant_noches_alojamiento INT,
    monto_alojamiento   NUMERIC(12,2),
    tipo_patologia      VARCHAR(150),
    diagnostico         TEXT,
    tratamiento         TEXT,
    fecha_turno         DATE,
    creado_en           TIMESTAMP DEFAULT NOW(),
    creado_por          INT REFERENCES usuarios(id)
);

CREATE INDEX idx_derivaciones_mes ON derivaciones(mes);
CREATE INDEX idx_derivaciones_documento ON derivaciones(afiliado_documento);
