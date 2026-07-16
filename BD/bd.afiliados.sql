CREATE SCHEMA IF NOT EXISTS afiliados;
SET search_path TO afiliados;
CREATE SCHEMA IF NOT EXISTS afiliados;
SET search_path TO afiliados;
 SELECT* FROM afiliados.domicilio where localidad is null;
-- TABLAS USUARIOS AUDITORIAS
create table if not exists sistema (
  id_sistema serial primary key,
  sistema varchar (50),
  fecha_registro timestamp 
);
create table if not exists perfil (
  id_perfil serial primary key,
  perfil varchar (60),
  fecha_registro timestamp
);

create table if not exists permiso (
  id_permiso serial primary key,
  permiso varchar (60),
  nombre_fn varchar(60),
  fecha_registro timestamp
);

create table if not exists usuario (
  id_usuario int,
  nombre varchar (50),
  usuario varchar (50),
  pass varchar (50),
  fecha_registro timestamp
);

create table if not exists sistemaXperfil (
  id_sisXperf int,
  sistema int,
  perfil int,
  fecha_registro timestamp,
  constraint fk_sistema
    foreign key (sistema)
    references sistema (id_sistema),
    constraint fk_perfil
    foreign key (perfil)
    references perfil (id_perfil)
);
create table if not exists permisoXperfil (
  id_permXperf int,
  permiso int,
  perfil int,
  fecha_registro timestamp,
  constraint fk_permiso
    foreign key (permiso)
    references permiso (id_permiso),
    constraint fk_perfil
    foreign key (perfil)
    references perfil (id_perfil)
);

create table if not exists usuarioXperfil (
  id_usuXperf int primary key,
  usuario int,
  perfil int,
  fecha_registro timestamp,
  constraint fk_usuario
    foreign key (usuario)
    references usuario (id_usuario),
    constraint fk_perfil
    foreign key (perfil)
    references perfil (id_perfil)
);

-- TABLAS LOCALIDAD
create table if not exists region (
 id_region serial primary key not null,
 region varchar (50),
 usuario int,
 fecha_registro timestamp
);

create table if not exists departamento (
 id_departamento serial primary key not null,
 departamento varchar (50),
 usuario int,
 fecha_registro timestamp
);

create table if not exists municipio (
 id_municipio serial primary key not null,
 municipio varchar (50),
 usuario int,
  fecha_registro timestamp
);
create table if not exists provincia (
 id_provincia serial primary key not null,
 provincia varchar (50),
 usuario int,
  fecha_registro timestamp
);
create table if not exists localidad (
 id_localidad serial primary key not null,
 localidad varchar (50),
 departamento int,
 provincia int,
 c_postal int,
 municipio int,
 usuario int,
  fecha_registro timestamp,
 constraint fk_departamento
   foreign key (departamento)
   references departamento (id_departamento),
 constraint fk_provincia
   foreign key (provincia)
   references provincia (id_provincia),
   constraint fk_municipio
   foreign key (municipio)
   references municipio (id_municipio)
);
create table if not exists delegacion (
 id_delegacion serial primary key not null,
 delegacion varchar (50),
 responsable varchar (40),
 domicilio varchar (40),
 celular varchar(25),
 region int,
 usuario int,
 fecha_registro timestamp,
 constraint fk_region
   foreign key (region)
   references region (id_region)
);
 
-- TABLAS AFILIADOS --------------------------------------------------------------------------------------
create table if not exists domicilio ( --cargado
 id_domicilio serial primary key not null,
 domicilio varchar (200),
 localidad int,
 usuario int,
 fecha_registro timestamp
);

CREATE TABLE afiliados.tipo_contacto (-- cargado
  id_tipo_contacto SERIAL PRIMARY KEY NOT NULL,
  tipo_contacto VARCHAR(50) UNIQUE NOT NULL,
  usuario INT,
  fecha_registro TIMESTAMP
);

CREATE TABLE afiliados.contacto ( -- cargado
  id_contacto SERIAL PRIMARY KEY NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  tipo_contacto INT NOT NULL,
  usuario INT,
  fecha_registro TIMESTAMP,
  CONSTRAINT fk_tipo_contacto
    FOREIGN KEY (tipo_contacto)
    REFERENCES afiliados.tipo_contacto (id_tipo_contacto),
  CONSTRAINT uq_contacto UNIQUE (descripcion, tipo_contacto)  
);

CREATE TABLE afiliados.afiliado_contacto (
  id_afiliado_contacto SERIAL PRIMARY KEY NOT NULL,
  afiliado BIGINT NOT NULL,
  contacto INT NOT NULL,
  CONSTRAINT fk_afiliado
    FOREIGN KEY (afiliado)
    REFERENCES afiliados.afiliado (id_afiliado),
  CONSTRAINT fk_contacto
    FOREIGN KEY (contacto)
    REFERENCES afiliados.contacto (id_contacto),
  CONSTRAINT uq_afiliado_contacto UNIQUE (afiliado, contacto) --cargado
);
create table if not exists genero ( --cargado
 id_genero serial primary key not null,
 genero varchar (35),
 usuario int,
  fecha_registro timestamp
);
create table if not exists estado_civil ( --cargado
 id_estado_civil serial primary key not null,
 estado_civi varchar (30),
 usuario int,
  fecha_registro timestamp
);
create table if not exists categoria (--cargado
 id_categoria serial primary key not null, 
 categoria varchar (50), -- ips, discapacitados, oncologicos, diabeticos, seguro provincia
 porcentaje_coseguro decimal(5,2),
 usuario int,
  fecha_registro timestamp
);
create table if not exists tipo_documento ( --cargado
 id_tipo_documento serial primary key not null,
 tipo_documento varchar (50),
 usuario int,
  fecha_registro timestamp
);
create table if not exists parentesco ( --cargado
 id_parentesco serial primary key not null,
 parentesco varchar (50),
 ley varchar (35),
 barra int,
 limite_edad int,
 usuario int,
  fecha_registro timestamp
);

create table if not exists fecha ( --cargado
 id_fecha serial primary key not null,
 fecha_alta timestamp,
 fecha_baja timestamp,
 fecha_vto timestamp,
 fecha_carencia timestamp,
 fecha_ingreso timestamp,
 documento numeric(18,0),
 usuario varchar (50),
 fecha_registro timestamp
);

create table if not exists situacion_laboral ( --cargado
 id_situacion_laboral serial primary key not null,
 situacion_laboral varchar (50),
 usuario int,
  fecha_registro timestamp
);

create table if not exists laborales ( --cargado
 id_laborales serial primary key not null,
 legajo numeric,
 expediente varchar (25),
 benef_jubilatorio numeric,
 benef_jubilatorio2 numeric,
 resolucion varchar (200),
 situacion_laboral int,
 situacion_laboral2 int,
 obs varchar(200),
 usuario varchar (60),
 fecha_registro timestamp
);

CREATE TABLE afiliados.afiliado ( --cargado
    id_afiliado BIGINT PRIMARY KEY NOT NULL,
    documento BIGINT,
    tipo_documento BIGINT,
    cuil VARCHAR(20),
    nombre VARCHAR(100),
    apellido VARCHAR(100),
    titular BIGINT,
    discapacidad VARCHAR(5),
    nacimiento DATE,
    barra INTEGER,
    orden INTEGER,
    genero BIGINT,
    estado_civil BIGINT,
    categoria BIGINT,
    parentesco BIGINT,
    fecha BIGINT,
    laborales BIGINT,
    domicilio BIGINT,
    obs VARCHAR(200),
    usuario VARCHAR(60),
    fecha_registro TIMESTAMP
);


create table if not exists banco ( -- LISTO cargado
 id_banco serial primary key not null,
 banco varchar (50)
);

create table if not exists sucursal ( -- LISTO cargado
 id_sucursal serial primary key not null,
 sucursal varchar
);

create table if not exists tipo_cuenta ( -- LISTO cargado
 id_tipo_cuenta serial primary key not null,
 tipo_cuenta varchar (20)
);
create table if not exists convenio_empleador ( -- LISTO cargado
 id_convenio serial primary key not null,
 convenio varchar (50),
 sucursal_ips int,
 grupo varchar (30)
);

create table if not exists cuenta_bancaria ( -- LISTO cargado
 id_cuenta serial primary key not null,
 doc_titular numeric,
 numero_cuenta numeric,
 tipo_cuenta int,
 sucursal int,
 banco int,
 convenio_empleador int
);
-- TABLAS PROFESIONALES

create table if not exists especialidad ( -- LISTO cargado
 id_especialidad serial primary key not null,
 especialidad varchar (50)
);

create table profesion ( --CARGADO
id_profesion serial primary key not null,
profesion varchar (50)
); 
drop table profesional cascade;
create table if not exists profesional ( -- LISTO
 id_profesional serial primary key not null,
 matricula numeric,
 CUIT bigint,
 nombre varchar (60),
 localidad int,
 especialidad int,
 profesion int,
 celular varchar (35),
 usuario int,
 fecha_registro timestamp,
 constraint fk_localidad
   foreign key (localidad)
   references localidad (id_localidad),
 constraint fk_especialidad
   foreign key (especialidad)
   references especialidad (id_especialidad),
 constraint fk_profesion
   foreign key (profesion)
   references profesion (id_profesion)
);
-- TABLAS PRESTACIONES
create table if not exists frecuencia ( --LISTO
 id_frecuencia serial primary key not null,
 frecuencia varchar (20)
);
create table if not exists prestacion ( --LISTO
 id_prestacion serial primary key not null,
 cantidad int,
 frecuencia int,
 afiliado int,
 profesional int,
 constraint fk_frecuencia
   foreign key (frecuencia)
   references frecuencia (id_frecuencia),
 constraint fk_afiliado
   foreign key (afiliado)
   references afiliado (id_afiliado),
 constraint fk_profesional
   foreign key (profesional)
   references profesional (id_profesional)
);
-- TABLAS EMPLEADOR Y CONVENIO
create table if not exists jurisdiccion ( --listo
 id_jurisdiccion serial primary key not null,
 jurisdiccion varchar (60)
);
create table if not exists entidad_empleador ( --cargado
 id_entidad_empleador serial primary key not null,
 entidad_empleador varchar (60)
);
create table if not exists empleador ( --listo
 id_empleador serial primary key not null,
 organismo varchar (60),
 direccion varchar (50),
 celular varchar (35),
 mail varchar (35),
 jurisdiccion int,
 entidad_empleador int,
 usuario int,
  fecha_registro timestamp,
constraint fk_jurisdiccion
   foreign key (jurisdiccion)
   references  jurisdiccion(id_jurisdiccion),
  
constraint fk_entidad_empleador
   foreign key (entidad_empleador)
   references  entidad_empleador (id_entidad_empleador)
);

create table if not exists tipo_convenio ( -- estudiante, residente, extraña jurisdiccion,... --listo
 id_tipo_convenio serial primary key not null,
 tipo_convenio varchar (50),
 usuario int,
  fecha_registro timestamp
);
create table if not exists convenio_x_af ( --listo
 id_convenio_x_af serial primary key not null,
 afiliado int,
 tipo_convenio int,
 convenio int,
 fecha_alta date,
 fecha_baja date,
 celular varchar (35),
 mail varchar (50),
 origen int,
 destino int,
 obs varchar (200),
 usuario int,
  fecha_registro timestamp,
 constraint fk_afiliado
   foreign key (afiliado)
   references  afiliado (id_afiliado),
 constraint fk_convenio
   foreign key (convenio)
   references  convenio (id_convenio),
  
 constraint fk_tipo_convenio
   foreign key (tipo_convenio)
   references  tipo_convenio(id_tipo_convenio),
  constraint fk_empleador_origen
   foreign key (origen)
   references  empleador (id_empleador),
  
 constraint fk_empleador_destino
   foreign key (destino)
   references  empleador (id_empleador)
);
-- TABLAS PATOLOGIAS
create table if not exists tipo_patologia (--listo
 id_tipo_patologia serial primary key not null,
 tipo_patologia varchar (200),
 abreviatura varchar (50),
 plan varchar (200),
 usuario int,
  fecha_registro timestamp
);
create table if not exists CIE_capitulo (--listo
 id_CIE_capitulo serial primary key not null,
 CIE_capitulo varchar (30),
 nro_cap varchar (30),
 usuario int,
  fecha_registro timestamp
);
-- falta CIE_bloque   --LISTO
create table if not exists CIE ( --listo
 id_CIE serial primary key not null,
 CIE varchar (30),
 capitulo int, --MAL, TIENE QUE IR BLOQUE
 usuario int,
  fecha_registro timestamp,
 constraint fk_CIE_capitulo
   foreign key (capitulo)
   references CIE_capitulo (id_CIE_capitulo)
);
create table if not exists patologia ( -listo
 id_patologia serial primary key not null,
 patologia varchar (200),
 CIE int,
 tipo_patologia int,
 usuario int,
  fecha_registro timestamp,
 constraint fk_CIE
   foreign key (CIE)
   references CIE (id_CIE),
 constraint fk_tipo_patologia
   foreign key (tipo_patologia)
   references tipo_patologia (id_tipo_patologia)
);
create table if not exists diagnostico (--listo
 id_diagnostico serial primary key not null,
 path varchar (100),
 archivo varchar(50),
 fecha timestamp,
 patologia int,
 obs varchar (100),
 usuario int,
  fecha_registro timestamp,
 constraint fk_patologia
    foreign key (patologia)
    references patologia (id_patologia)
);
-- TABLAS CRONICOS
create table if not exists CUD ( --listo
 id_CUD serial primary key not null,
 afiliado int,
 num_cud numeric,
 fecha_emision date,
 fecha_vto date,
 path varchar (100),
 archivo varchar (50),
 num_alfa int,
 obs varchar (200),
 usuario int,
  fecha_registro timestamp,
 constraint fk_afiliado
   foreign key (afiliado)
   references afiliado (id_afiliado)
);
create table if not exists cronico ( --listo
 id_cronico serial primary key not null,
 cud int,
 fecha_alta date,
 fecha_baja date,
 fecha_reexamen date,
 alta_medica date,
 profesional int,
 porcentaje_disc decimal(5,2),
 expediente varchar (25),
 patologia int,
 obs varchar (100),
 usuario int,
  fecha_registro timestamp,
 constraint fk_cud
   foreign key (cud)
   references cud (id_cud),
  constraint fk_profesional
   foreign key (profesional)
   references profesional (id_profesional),
  constraint fk_patologia
    foreign key (patologia)
    references patologia (id_patologia)
);
-- TABLA PLAN ESPECIAL
create table if not exists plan_especial ( -- plan materno,...
 id_plan_especial serial primary key not null,
 plan_especial varchar (60),
 articulos varchar (60),
 obs varchar (100),
 afiliado int,
 usuario int,
  fecha_registro timestamp,
 constraint fk_afiliado
   foreign key (afiliado)
   references afiliado (id_afiliado)
);