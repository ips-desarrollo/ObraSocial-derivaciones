from fastapi import FastAPI, Body, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta, timezone
_ART = timezone(timedelta(hours=-3))
from decimal import Decimal
import json
import os
import pyodbc
pyodbc.pooling = False
import psycopg2
from dotenv import load_dotenv
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="API Obra Social")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

JWT_SECRET = os.getenv("JWT_SECRET", "default-secret-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))


class LoginRequest(BaseModel):
    email: str
    password: str


class CrearUsuarioRequest(BaseModel):
    nombre_completo: str
    email: str
    password: str


class ActualizarUsuarioRequest(BaseModel):
    nombre_completo: str | None = None
    email: str | None = None
    password: str | None = None
    activo: bool | None = None
    roles: list[str] | None = None


def crear_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _build_conn_str():
    server   = os.getenv("DB_SERVER",   "")
    database = os.getenv("DB_NAME",     "")
    driver   = os.getenv("DB_DRIVER",   "ODBC Driver 17 for SQL Server")
    uid      = os.getenv("DB_USER",     "")
    pwd      = os.getenv("DB_PASSWORD", "")

    if not server or not database:
        raise RuntimeError(
            "Las variables de entorno DB_SERVER y DB_NAME son obligatorias. "
            "Configuralas en el .env local o en las variables de entorno de Dokploy."
        )

    if uid:
        return (
            f"DRIVER={{{driver}}};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"UID={uid};PWD={pwd};"
        )
    # Autenticación de Windows (mismo equipo)
    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        "Trusted_Connection=yes;"
    )


# Una conexión NUEVA por request con retry. pyodbc.pooling está desactivado
# (arriba) para evitar reutilizar conexiones muertas del pool interno.
# Aun así, la primera conexión tras inactividad puede tardar si SQL Express
# necesita despertar; el retry con timeout corto evita cuelgues largos.
def get_connection():
    conn_str = _build_conn_str()
    last_err = None
    for attempt in range(3):
        try:
            return pyodbc.connect(conn_str, timeout=3, autocommit=True)
        except pyodbc.Error as e:
            last_err = e
    raise last_err


def get_pg_connection():
    return psycopg2.connect(
        host=os.getenv("PG_HOST", "localhost"),
        port=int(os.getenv("PG_PORT", "5433")),
        dbname=os.getenv("PG_NAME", "obrasocial"),
        user=os.getenv("PG_USER", "postgres"),
        password=os.getenv("PG_PASSWORD", "postgres"),
    )


def _pg_set_audit_context(cur, usuario_id: int | None, usuario_email: str | None):
    if usuario_id is not None:
        cur.execute("SET LOCAL app.usuario_id = %s", (str(usuario_id),))
    if usuario_email is not None:
        cur.execute("SET LOCAL app.usuario_email = %s", (usuario_email,))


@app.get("/")
def read_root():
    return {
        "status": "ok",
        "message": "API de Python (FastAPI) funcionando correctamente"
    }


@app.post("/login")
def login(datos: LoginRequest):
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute(
            """SELECT u.id, u.nombre_completo, u.email, u.password_hash, u.activo,
                      ARRAY_AGG(r.nombre) FILTER (WHERE r.nombre IS NOT NULL) AS roles
               FROM usuarios u
               LEFT JOIN usuarios_roles ur ON u.id = ur.usuario_id
               LEFT JOIN roles r ON ur.rol_id = r.id
               WHERE u.email = %s
               GROUP BY u.id""",
            (datos.email.strip().lower(),),
        )
        row = cur.fetchone()
        cur.close()
        pg.close()

        if row is None:
            raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

        user_id, nombre, email, password_hash, activo, roles = row

        if not activo:
            raise HTTPException(status_code=401, detail="Usuario desactivado")

        if not pwd_context.verify(datos.password, password_hash):
            raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

        token = crear_token({
            "sub": str(user_id),
            "email": email,
            "nombre": nombre,
            "roles": roles or [],
        })

        return {
            "token": token,
            "usuario": {
                "id": user_id,
                "nombre": nombre,
                "email": email,
                "roles": roles or [],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/crear-usuario")
def crear_usuario(datos: CrearUsuarioRequest, token: str | None = Depends(oauth2_scheme)):
    uid, uemail = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos para esta acción")
    try:
        pg = get_pg_connection()
        pg.autocommit = False
        cur = pg.cursor()

        _pg_set_audit_context(cur, uid, uemail)

        cur.execute("SELECT COUNT(*) FROM usuarios WHERE email = %s", (datos.email.strip().lower(),))
        if cur.fetchone()[0] > 0:
            cur.close()
            pg.close()
            raise HTTPException(status_code=400, detail="Ya existe un usuario con ese email")

        hashed = pwd_context.hash(datos.password)
        cur.execute(
            """INSERT INTO usuarios (nombre_completo, email, password_hash, creado_por)
               VALUES (%s, %s, %s, %s) RETURNING id""",
            (datos.nombre_completo.strip(), datos.email.strip().lower(), hashed, uid),
        )
        user_id = cur.fetchone()[0]

        cur.execute(
            "SELECT id FROM roles WHERE nombre = 'operador'"
        )
        rol = cur.fetchone()
        if rol:
            cur.execute(
                "INSERT INTO usuarios_roles (usuario_id, rol_id, asignado_por) VALUES (%s, %s, %s)",
                (user_id, rol[0], uid),
            )

        pg.commit()
        cur.close()
        pg.close()
        return {"ok": True, "id": user_id, "email": datos.email.strip().lower()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/usuarios")
def listar_usuarios(token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos para ver usuarios")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute(
            """SELECT u.id, u.nombre_completo, u.email, u.activo, u.creado_en,
                      ARRAY_AGG(r.nombre) FILTER (WHERE r.nombre IS NOT NULL) AS roles
               FROM usuarios u
               LEFT JOIN usuarios_roles ur ON u.id = ur.usuario_id
               LEFT JOIN roles r ON ur.rol_id = r.id
               GROUP BY u.id
               ORDER BY u.nombre_completo"""
        )
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [
            {
                "id": r[0],
                "nombre_completo": r[1],
                "email": r[2],
                "activo": r[3],
                "creado_en": r[4].isoformat() if r[4] else None,
                "roles": r[5] or [],
            }
            for r in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/roles")
def listar_roles(token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("SELECT id, nombre, descripcion FROM roles ORDER BY nombre")
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [{"id": r[0], "nombre": r[1], "descripcion": r[2]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/usuarios/{usuario_id}")
def obtener_usuario(usuario_id: int, token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos para ver usuarios")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute(
            """SELECT u.id, u.nombre_completo, u.email, u.activo, u.creado_en,
                      ARRAY_AGG(r.nombre) FILTER (WHERE r.nombre IS NOT NULL) AS roles
               FROM usuarios u
               LEFT JOIN usuarios_roles ur ON u.id = ur.usuario_id
               LEFT JOIN roles r ON ur.rol_id = r.id
               WHERE u.id = %s
               GROUP BY u.id""",
            (usuario_id,),
        )
        row = cur.fetchone()
        cur.close()
        pg.close()
        if row is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return {
            "id": row[0],
            "nombre_completo": row[1],
            "email": row[2],
            "activo": row[3],
            "creado_en": row[4].isoformat() if row[4] else None,
            "roles": row[5] or [],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/usuarios/{usuario_id}")
def actualizar_usuario(usuario_id: int, datos: ActualizarUsuarioRequest, token: str | None = Depends(oauth2_scheme)):
    uid, uemail = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos para esta acción")
    try:
        pg = get_pg_connection()
        pg.autocommit = False
        cur = pg.cursor()

        _pg_set_audit_context(cur, uid, uemail)

        cur.execute(
            "SELECT nombre_completo, email, activo FROM usuarios WHERE id = %s",
            (usuario_id,),
        )
        actual = cur.fetchone()
        if actual is None:
            cur.close()
            pg.close()
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        act_nombre, act_email, act_activo = actual

        if datos.email is not None and datos.email.strip().lower() != act_email:
            cur.execute(
                "SELECT id FROM usuarios WHERE email = %s AND id != %s",
                (datos.email.strip().lower(), usuario_id),
            )
            if cur.fetchone() is not None:
                cur.close()
                pg.close()
                raise HTTPException(status_code=400, detail="Ya existe otro usuario con ese email")

        sets = []
        params = []
        if datos.nombre_completo is not None and datos.nombre_completo.strip() != act_nombre:
            sets.append("nombre_completo = %s")
            params.append(datos.nombre_completo.strip())
        if datos.email is not None and datos.email.strip().lower() != act_email:
            sets.append("email = %s")
            params.append(datos.email.strip().lower())
        if datos.password is not None and datos.password.strip():
            sets.append("password_hash = %s")
            params.append(pwd_context.hash(datos.password))
        if datos.activo is not None and datos.activo != act_activo:
            sets.append("activo = %s")
            params.append(datos.activo)

        if sets:
            sets.append("actualizado_por = %s")
            params.append(uid)
            params.append(usuario_id)
            cur.execute(
                f"UPDATE usuarios SET {', '.join(sets)} WHERE id = %s",
                params,
            )

        if datos.roles is not None:
            cur.execute(
                """SELECT r.nombre FROM usuarios_roles ur
                   JOIN roles r ON ur.rol_id = r.id
                   WHERE ur.usuario_id = %s ORDER BY r.nombre""",
                (usuario_id,),
            )
            roles_actuales = sorted([row[0] for row in cur.fetchall()])
            roles_nuevos = sorted(datos.roles)

            if roles_actuales != roles_nuevos:
                cur.execute("DELETE FROM usuarios_roles WHERE usuario_id = %s", (usuario_id,))
                for rol_nombre in datos.roles:
                    cur.execute("SELECT id FROM roles WHERE nombre = %s", (rol_nombre,))
                    rol_row = cur.fetchone()
                    if rol_row:
                        cur.execute(
                            "INSERT INTO usuarios_roles (usuario_id, rol_id, asignado_por) VALUES (%s, %s, %s)",
                            (usuario_id, rol_row[0], uid),
                        )

        pg.commit()
        cur.close()
        pg.close()
        return {"ok": True, "id": usuario_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/usuarios/{usuario_id}")
def eliminar_usuario(usuario_id: int, token: str | None = Depends(oauth2_scheme)):
    uid, uemail = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos para esta acción")
    if uid == usuario_id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    try:
        pg = get_pg_connection()
        pg.autocommit = False
        cur = pg.cursor()

        _pg_set_audit_context(cur, uid, uemail)

        cur.execute("SELECT id FROM usuarios WHERE id = %s", (usuario_id,))
        if cur.fetchone() is None:
            cur.close()
            pg.close()
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        cur.execute("DELETE FROM usuarios WHERE id = %s", (usuario_id,))
        pg.commit()
        cur.close()
        pg.close()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/empleadores")
def listar_empleadores():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT Codigo, Organismo FROM Empleadores ORDER BY Organismo")
        rows = cursor.fetchall()
        cursor.close()
        return [{"codigo": int(r[0]), "organismo": (r[1] or "").strip()} for r in rows]
    except Exception as e:
        return {"error": str(e)}


@app.get("/afiliados/buscar")
def buscar_afiliados(q: str = "", campo: str = ""):
    """Busca afiliados por nombre o DNI.

    `campo` puede ser 'dni' o 'nombre'. Si no se envía, se autodetecta según
    si `q` es numérico (compatibilidad con la barra anterior).
    """
    q = q.strip()
    if len(q) < 2:
        return []

    campo = campo.strip().lower()
    if campo not in ("dni", "nombre"):
        campo = "dni" if q.isdigit() else "nombre"

    try:
        conn = get_connection()
        cursor = conn.cursor()
        prefijo = f"{q}%"
        if campo == "dni":
            if q.isdigit():
                val = int(q)
                cursor.execute(
                    """SELECT TOP 50 Documento, Nombre, nombre_afiliado, apellido_afiliado
                       FROM Afiliados
                       WHERE Documento = ?""",
                    (val,)
                )
                rows = cursor.fetchall()
                if not rows and len(q) >= 2:
                    conds = []
                    params = []
                    l = len(q)
                    for d in range(0, max(0, 9 - l)):
                        mult = 10**d
                        low = val * mult
                        high = low + mult - 1
                        conds.append("(Documento >= ? AND Documento <= ?)")
                        params.extend([low, high])
                    if conds:
                        sql = f"""SELECT TOP 50 Documento, Nombre, nombre_afiliado, apellido_afiliado
                                   FROM Afiliados
                                   WHERE {" OR ".join(conds)}
                                   ORDER BY Documento"""
                        cursor.execute(sql, params)
                        rows = cursor.fetchall()
            else:
                cursor.execute(
                    """SELECT TOP 50 Documento, Nombre, nombre_afiliado, apellido_afiliado
                       FROM Afiliados
                       WHERE CAST(Documento AS VARCHAR(20)) LIKE ?
                       ORDER BY Documento""",
                    (prefijo,)
                )
                rows = cursor.fetchall()
        else:
            cursor.execute(
                """SELECT TOP 50 Documento, Nombre, nombre_afiliado, apellido_afiliado
                   FROM Afiliados
                   WHERE Nombre LIKE ?
                   ORDER BY Nombre""",
                (prefijo,)
            )
            rows = cursor.fetchall()
        result = [
            {
                "id_afiliado": int(row[0]),
                "nombre_completo": row[1],
                "nombre": row[2],
                "apellido": row[3],
                "documento": int(row[0]),
            }
            for row in rows
        ]
        cursor.close()
        return result
    except Exception as e:
        return {"error": str(e)}


def _si_no(v):
    """Convierte el indicador de incapacidad ('S'/'N') a 'Sí'/'No'."""
    if v is None:
        return "No"
    return "Sí" if str(v).strip().upper().startswith("S") else "No"


def _sexo_a_texto(v):
    """Código de sexo de la BD ('F'/'M'/'N') → texto para el front."""
    if v is None:
        return None
    c = str(v).strip().upper()[:1]
    return {"F": "Femenino", "M": "Masculino", "N": "No Binario"}.get(c) or None


def _sexo_a_codigo(v):
    """Texto del front → código de sexo para la BD ('F'/'M'/'N') o None."""
    if v is None:
        return None
    t = str(v).strip().upper()
    if t.startswith("F"):
        return "F"
    if t.startswith("M"):
        return "M"
    if t.startswith("N"):
        return "N"
    return None


def _num(v):
    """Convierte un numeric/Decimal de SQL Server a int (si es entero) o float, o None."""
    if v is None:
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return None


def _fecha(v):
    """Convierte datetime de SQL Server a 'YYYY-MM-DD' o None."""
    if v is None:
        return None
    try:
        return v.strftime("%Y-%m-%d")
    except AttributeError:
        return str(v)


@app.get("/afiliados/{documento}")
def obtener_afiliado(documento: int):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT a.Documento, a.Cuil, a.nombre_afiliado, a.apellido_afiliado,
                      a.afi_tipo_documento, a.afi_parentezco, a.afi_categoria,
                      a.Nacimiento, a.Fallecio, a.Sexo, a.EstCivil, a.Incapacitado,
                      p.Parentezco,
                      a.afi_orden, a.doc_titular, a.afi_barra,
                      a.Alta, a.VtoOs, a.Baja, a.afi_fecha_carencia,
                      a.Afi_legajo_laboral, a.afi_fecha_ingreso, a.afi_sit_id,
                      a.afi_resolucion, a.afi_expediente,
                      a.afi_beneficio_jubilatorio, a.afi_beneficio_jubilatorio1,
                      ta.Tpo_descripcion, e.Organismo, a.Afi_Obs,
                      a.Telefono, a.Celular, a.email, a.Nombre,
                      a.Empleador
               FROM Afiliados a
               LEFT JOIN Parentezco p ON a.Tipo = p.Codigo
               LEFT JOIN tipo_afiliado ta ON a.tipo_afiliado = ta.Tpo_id
               LEFT JOIN Empleadores e ON a.Empleador = e.Codigo
               WHERE a.Documento = ?""",
            (documento,)
        )
        row = cursor.fetchone()

        if row is None:
            cursor.close()
            return {"error": "Afiliado no encontrado"}

        # Domicilios (tabla Domicilio, vinculada por dir_documento)
        cursor.execute(
            """SELECT d.dir_calle, d.dir_numero, d.dir_piso, d.dir_departamento,
                      l.Descripcion, p.Descripcion, d.dir_codigo_postal
               FROM Domicilio d
               LEFT JOIN localidad l ON d.dir_localidad = l.Codigo
               LEFT JOIN Provincia p ON d.dir_provincia = p.Codigo
               WHERE d.dir_documento = ?
               ORDER BY d.dir_id""",
            (documento,)
        )
        domicilios = [
            {
                "domicilio": (d[0] or "").strip(),
                "numero": ((d[1] or "").strip() or None),
                "piso": ((d[2] or "").strip() or None),
                "dpto": ((d[3] or "").strip() or None),
                "localidad": (d[4] or "").strip(),
                "provincia": (d[5] or "").strip(),
                "c_postal": _num((d[6] or "").strip()),
            }
            for d in cursor.fetchall()
        ]

        # Crónicos (tabla cronicos, vinculada por CRO_DOCUMENTO)
        cursor.execute(
            """SELECT CRO_ALTA_MEDICA, CRO_BAJA, CRO_REEXAMEN, CRO_EXPEDIENTE,
                      CRO_RESOLUCION, CRO_OBS, CRO_ALTA, CRO_PORCENTAJE_INCAPACIDAD
               FROM cronicos
               WHERE CRO_DOCUMENTO = ?""",
            (documento,)
        )
        cro_row = cursor.fetchone()
        cronico = None
        if cro_row is not None:
            cronico = {
                "alta_medica": _fecha(cro_row[0]),
                "baja": _fecha(cro_row[1]),
                "reexamen": _fecha(cro_row[2]),
                "expediente": _to_str(cro_row[3]),
                "resolucion": _to_str(cro_row[4]),
                "obs": _to_str(cro_row[5]),
                "alta": _fecha(cro_row[6]),
                "porcentaje_incapacidad": _num(cro_row[7]),
            }

        # CUD (tabla CUD, vinculada por cud_documento)
        cursor.execute(
            """SELECT cud_id, cud_fecha, cud_fecha_emision, cud_fecha_vto,
                      cud_path, cud_archivo, cud_numero, cud_numero_alfa,
                      cud_nro_caja, cud_obs
               FROM CUD
               WHERE cud_documento = ?""",
            (documento,)
        )
        cud_row = cursor.fetchone()
        cud = None
        if cud_row is not None:
            cud = {
                "cud_id": _num(cud_row[0]),
                "cud_fecha": _fecha(cud_row[1]),
                "cud_fecha_emision": _fecha(cud_row[2]),
                "cud_fecha_vto": _fecha(cud_row[3]),
                "cud_path": _to_str(cud_row[4]),
                "cud_archivo": _to_str(cud_row[5]),
                "cud_numero": _num(cud_row[6]),
                "cud_numero_alfa": _to_str(cud_row[7]),
                "cud_nro_caja": _num(cud_row[8]),
                "cud_obs": _to_str(cud_row[9]),
            }

        cursor.close()

        # Credencial = orden + documento del titular + barra, todo de corrido
        orden_val = row[13]
        doc_titular_val = row[14]
        barra_val = row[15]
        parts = []
        if orden_val is not None:
            parts.append(str(int(orden_val)).zfill(2))
        if doc_titular_val is not None:
            parts.append(str(int(doc_titular_val)))
        if barra_val is not None:
            parts.append(str(int(barra_val)).zfill(2))
        credencial = "".join(parts) or None

        return {
            "credencial": credencial,
            "documento": int(row[0]),
            "cuil": str(int(row[1])) if row[1] is not None else "",
            "nombre": (row[2] or "").strip(),
            "apellido": (row[3] or "").strip(),
            "nombre_completo": (row[33] or "").strip(),
            "tipo_documento": int(row[4]) if row[4] is not None else None,
            "parentesco": int(row[5]) if row[5] is not None else None,
            "categoria": int(row[6]) if row[6] is not None else None,
            "nacimiento": _fecha(row[7]),
            "fallecimiento": _fecha(row[8]),
            "genero": _sexo_a_texto(row[9]),
            "estado_civil": (row[10] or "").strip() or None,
            "discapacidad": _si_no(row[11]),
            "obs": (row[29] or "").strip() or None,
            "tipo_afiliado": (row[27] or "").strip() or None if row[27] is not None else None,
            "fechas": {
                "fecha_alta": _fecha(row[16]),
                "fecha_vto": _fecha(row[17]),
                "fecha_baja": _fecha(row[18]),
                "fecha_carencia": _fecha(row[19]),
            },
            "laborales": {
                "empleador": (row[28] or "").strip() or None,
                "empleador_codigo": _num(row[34]),
                "legajo": _num(row[20]),
                "fecha_ingreso": _fecha(row[21]),
                "situacion_laboral": str(int(row[22])) if row[22] is not None else None,
                "resolucion": (row[23] or "").strip() or None,
                "expediente": (row[24] or "").strip() or None,
                "benef_jubilatorio": _num(row[25]),
                "benef_jubilatorio2": _num(row[26]),
            },
            "domicilios": domicilios,
            "telefonos": [
                entry
                for entry in (
                    {"numero": (row[30] or "").strip(), "tipo": "telefono"},
                    {"numero": (row[31] or "").strip(), "tipo": "celular"},
                )
                if entry["numero"]
            ],
            "emails": [
                {"descripcion": mail}
                for mail in ((row[32] or "").strip(),)
                if mail
            ],
            "cronico": cronico,
            "cud": cud,
        }
    except Exception as e:
        return {"error": str(e)}


# Mapeo inverso: texto del tipo de documento del front → código numérico de la BD.
_TIPO_DOC_INV = {"DNI": 1, "LC": 2, "LE": 3, "PASAPORTE": 4, "CI": 5}


def _to_fecha_sql(v):
    """'YYYY-MM-DD' (o vacío/None) → objeto date de Python o None.

    Enviamos un date real (no una cadena) para que pyodbc lo vincule como
    parámetro de fecha y no dependa de la configuración regional del servidor
    al convertir el texto.
    """
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    # Tomamos solo la parte 'YYYY-MM-DD' por si viniera con hora.
    s = s[:10]
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


def _to_int(v):
    """Convierte a int, o None si está vacío/no numérico."""
    if v is None:
        return None
    s = str(v).strip()
    if s == "":
        return None
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return None


def _to_str(v):
    """Devuelve la cadena recortada, o None si queda vacía."""
    if v is None:
        return None
    s = str(v).strip()
    return s or None


_CAMPOS_AUDITADOS = [
    ("Nombre", "nombre_completo"),
    ("nombre_afiliado", "nombre"),
    ("apellido_afiliado", "apellido"),
    ("Cuil", "cuil"),
    ("afi_tipo_documento", "tipo_documento"),
    ("afi_categoria", "categoria"),
    ("Nacimiento", "nacimiento"),
    ("Fallecio", "fallecimiento"),
    ("Sexo", "genero"),
    ("EstCivil", "estado_civil"),
    ("Incapacitado", "discapacidad"),
    ("Afi_Obs", "obs"),
    ("Alta", "fecha_alta"),
    ("VtoOs", "fecha_vto"),
    ("Baja", "fecha_baja"),
    ("afi_fecha_carencia", "fecha_carencia"),
    ("Empleador", "empleador_codigo"),
    ("Afi_legajo_laboral", "legajo"),
    ("afi_fecha_ingreso", "fecha_ingreso"),
    ("afi_sit_id", "situacion_laboral"),
    ("afi_resolucion", "resolucion"),
    ("afi_expediente", "expediente"),
    ("afi_beneficio_jubilatorio", "benef_jubilatorio"),
    ("afi_beneficio_jubilatorio1", "benef_jubilatorio2"),
    ("Telefono", "telefono"),
    ("Celular", "celular"),
    ("email", "email"),
]


def _leer_estado_actual(cursor, documento: int) -> dict | None:
    cols_sql = ", ".join(c[0] for c in _CAMPOS_AUDITADOS)
    cursor.execute(
        f"SELECT {cols_sql} FROM Afiliados WHERE Documento = ?",
        (documento,),
    )
    row = cursor.fetchone()
    if row is None:
        return None
    return {c[1]: _normalizar_valor(row[i]) for i, c in enumerate(_CAMPOS_AUDITADOS)}


def _normalizar_valor(v) -> str | None:
    if v is None:
        return None
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, (Decimal, float, int)) and not isinstance(v, bool):
        f = float(v)
        return str(int(f)) if f.is_integer() else str(f)
    s = str(v).strip()
    return s if s else None


def _extraer_usuario(token: str | None) -> tuple[int | None, str | None]:
    if not token:
        return None, None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload.get("sub")), payload.get("email")
    except JWTError:
        return None, None


def _extraer_roles(token: str | None) -> list[str]:
    if not token:
        return []
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("roles") or []
    except JWTError:
        return []


def _solo_lectura(roles: list[str]) -> bool:
    return roles == ["lectura"]


def _registrar_auditoria(documento: int, antes: dict, despues: dict,
                         usuario_id: int | None = None, usuario_email: str | None = None):
    cambios = []
    for _, campo in _CAMPOS_AUDITADOS:
        val_old = antes.get(campo)
        val_new = despues.get(campo)
        if val_old != val_new:
            cambios.append((campo, val_old, val_new))
    if not cambios:
        return
    try:
        pg = get_pg_connection()
        pg_cur = pg.cursor()
        for columna, val_old, val_new in cambios:
            pg_cur.execute(
                """INSERT INTO auditoria
                       (usuario_id, usuario_email, base_datos, esquema, tabla,
                        registro_id, operacion, columna, valor_anterior, valor_nuevo, fecha)
                   VALUES (%s, %s, 'sqlserver', 'dbo', 'Afiliados',
                           %s, 'UPDATE', %s, %s, %s, %s)""",
                (usuario_id, usuario_email, str(documento), columna, val_old, val_new,
                 datetime.now(_ART).replace(tzinfo=None)),
            )
        pg.commit()
        pg_cur.close()
        pg.close()
    except Exception as e:
        print(f"[AUDITORIA ERROR] {e}")


@app.put("/afiliados/{documento}")
def actualizar_afiliado(documento: int, datos: dict = Body(...), token: str | None = Depends(oauth2_scheme)):
    uid, uemail = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos para editar")
    try:
        fechas = datos.get("fechas") or {}
        laborales = datos.get("laborales") or {}
        telefonos = datos.get("telefonos") or []
        emails = datos.get("emails") or []

        tel1 = None
        tel2 = None
        for t in telefonos:
            tipo = (t.get("tipo") or "").lower()
            num = _to_str(t.get("numero"))
            if tipo == "celular":
                tel2 = num
            else:
                tel1 = num
        email1 = _to_str(emails[0].get("descripcion")) if len(emails) > 0 else None

        tipo_doc_txt = str(datos.get("tipo_documento") or "").strip().upper()
        tipo_doc = _TIPO_DOC_INV.get(tipo_doc_txt)

        incap = "S" if str(datos.get("discapacidad") or "").strip().upper().startswith("S") else "N"

        conn = get_connection()
        cursor = conn.cursor()

        antes = _leer_estado_actual(cursor, documento)
        if antes is None:
            cursor.close()
            return {"error": "Afiliado no encontrado"}

        params = [
            _to_str(datos.get("nombre_completo")),
            _to_str(datos.get("nombre")),
            _to_str(datos.get("apellido")),
            _to_int(datos.get("cuil")),
            tipo_doc,
            _to_int(datos.get("categoria")),
            _to_fecha_sql(datos.get("nacimiento")),
            _to_fecha_sql(datos.get("fallecimiento")),
            _sexo_a_codigo(datos.get("genero")),
            _to_str(datos.get("estado_civil")),
            incap,
            _to_str(datos.get("obs")),
            _to_fecha_sql(fechas.get("fecha_alta")),
            _to_fecha_sql(fechas.get("fecha_vto")),
            _to_fecha_sql(fechas.get("fecha_baja")),
            _to_fecha_sql(fechas.get("fecha_carencia")),
            _to_int(laborales.get("legajo")),
            _to_fecha_sql(laborales.get("fecha_ingreso")),
            _to_int(laborales.get("situacion_laboral")),
            _to_str(laborales.get("resolucion")),
            _to_str(laborales.get("expediente")),
            _to_int(laborales.get("benef_jubilatorio")),
            _to_int(laborales.get("benef_jubilatorio2")),
            tel1,
            tel2,
            email1,
            documento,
        ]

        empleador_codigo = _to_int(laborales.get("empleador_codigo"))
        emp_sql = ""
        if empleador_codigo is not None:
            emp_sql = "Empleador = ?, "
            params.insert(0, empleador_codigo)

        cursor.execute(
            f"""UPDATE Afiliados SET
                   {emp_sql}Nombre = ?,
                   nombre_afiliado = ?,
                   apellido_afiliado = ?,
                   Cuil = ?,
                   afi_tipo_documento = ?,
                   afi_categoria = ?,
                   Nacimiento = ?,
                   Fallecio = ?,
                   Sexo = ?,
                   EstCivil = ?,
                   Incapacitado = ?,
                   Afi_Obs = ?,
                   Alta = ?,
                   VtoOs = ?,
                   Baja = ?,
                   afi_fecha_carencia = ?,
                   Afi_legajo_laboral = ?,
                   afi_fecha_ingreso = ?,
                   afi_sit_id = ?,
                   afi_resolucion = ?,
                   afi_expediente = ?,
                   afi_beneficio_jubilatorio = ?,
                   afi_beneficio_jubilatorio1 = ?,
                   Telefono = ?,
                   Celular = ?,
                   email = ?
               WHERE Documento = ?""",
            params,
        )
        filas = cursor.rowcount
        cursor.close()
        if filas == 0:
            return {"error": "Afiliado no encontrado"}

        despues_vals = {
            "nombre_completo": _to_str(datos.get("nombre_completo")),
            "nombre": _to_str(datos.get("nombre")),
            "apellido": _to_str(datos.get("apellido")),
            "cuil": _normalizar_valor(_to_int(datos.get("cuil"))),
            "tipo_documento": _normalizar_valor(tipo_doc),
            "categoria": _normalizar_valor(_to_int(datos.get("categoria"))),
            "nacimiento": _to_str(datos.get("nacimiento")),
            "fallecimiento": _to_str(datos.get("fallecimiento")),
            "genero": _sexo_a_codigo(datos.get("genero")),
            "estado_civil": _to_str(datos.get("estado_civil")),
            "discapacidad": incap,
            "obs": _to_str(datos.get("obs")),
            "fecha_alta": _to_str(fechas.get("fecha_alta")),
            "fecha_vto": _to_str(fechas.get("fecha_vto")),
            "fecha_baja": _to_str(fechas.get("fecha_baja")),
            "fecha_carencia": _to_str(fechas.get("fecha_carencia")),
            "empleador_codigo": _normalizar_valor(empleador_codigo) if empleador_codigo is not None else antes.get("empleador_codigo"),
            "legajo": _normalizar_valor(_to_int(laborales.get("legajo"))),
            "fecha_ingreso": _to_str(laborales.get("fecha_ingreso")),
            "situacion_laboral": _normalizar_valor(_to_int(laborales.get("situacion_laboral"))),
            "resolucion": _to_str(laborales.get("resolucion")),
            "expediente": _to_str(laborales.get("expediente")),
            "benef_jubilatorio": _normalizar_valor(_to_int(laborales.get("benef_jubilatorio"))),
            "benef_jubilatorio2": _normalizar_valor(_to_int(laborales.get("benef_jubilatorio2"))),
            "telefono": tel1,
            "celular": tel2,
            "email": email1,
        }

        _registrar_auditoria(documento, antes, despues_vals, uid, uemail)

        return {"ok": True, "documento": documento}
    except Exception as e:
        return {"error": str(e)}


class DerivacionRequest(BaseModel):
    mes: str
    nro_disposicion: str | None = None
    fecha: str | None = None
    afiliado_documento: str
    afiliado_nombre: str | None = None
    afiliado_credencial: str | None = None
    afiliado_edad: int | None = None
    afiliado_sexo: str | None = None
    expediente: str | None = None
    tipo_patologia: str | None = None
    diagnostico: str | None = None
    tratamiento: str | None = None
    fecha_turno: str | None = None
    id_tipo_patologia: int | None = None
    id_tratamiento: int | None = None
    diagnostico_tratamiento: str | None = None
    destino: str | None = None
    id_cobertura: int | None = None
    centro_medico: str | None = None
    id_centro_medico: int | None = None
    monto_prestacion: float | None = None
    id_tipo_traslado: int | None = None
    cant_acompanantes: int | None = None
    monto_traslado: float | None = None
    id_cobertura_alojamiento: int | None = None
    id_tipo_alojamiento: int | None = None
    lugar_alojamiento: str | None = None
    id_lugar_alojamiento: int | None = None
    cant_noches: int | None = None
    monto_alojamiento: float | None = None


def _ensure_derivacion_tables():
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("""
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
            CREATE TABLE IF NOT EXISTS centro_medico (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(200) NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS lugar_alojamiento (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(200) NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS tipo_patologia (
                id SERIAL PRIMARY KEY,
                tipo_pat VARCHAR(100) NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS tratamiento (
                id SERIAL PRIMARY KEY,
                tratamiento VARCHAR(200) NOT NULL UNIQUE
            );
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
            CREATE TABLE IF NOT EXISTS derivacion_prestacion (
                id SERIAL PRIMARY KEY,
                id_derivacion INTEGER NOT NULL UNIQUE REFERENCES derivacion(id_derivacion) ON DELETE CASCADE,
                destino VARCHAR(200),
                id_cobertura INTEGER REFERENCES cobertura(id),
                centro_medico VARCHAR(200),
                monto_prestacion NUMERIC(12, 2)
            );
            CREATE TABLE IF NOT EXISTS derivacion_traslado (
                id SERIAL PRIMARY KEY,
                id_derivacion INTEGER NOT NULL UNIQUE REFERENCES derivacion(id_derivacion) ON DELETE CASCADE,
                id_tipo_traslado INTEGER REFERENCES tipo_traslado(id),
                cant_acompanantes INTEGER DEFAULT 0,
                monto_traslado NUMERIC(12, 2)
            );
            CREATE TABLE IF NOT EXISTS derivacion_alojamiento (
                id SERIAL PRIMARY KEY,
                id_derivacion INTEGER NOT NULL UNIQUE REFERENCES derivacion(id_derivacion) ON DELETE CASCADE,
                id_cobertura_alojamiento INTEGER REFERENCES cobertura(id),
                id_tipo_alojamiento INTEGER REFERENCES tipo_alojamiento(id),
                lugar_alojamiento VARCHAR(200),
                cant_noches INTEGER,
                monto_alojamiento NUMERIC(12, 2)
            );
        """)
        for col, defn in [
            ("id_tipo_patologia", "INTEGER REFERENCES tipo_patologia(id)"),
            ("id_tratamiento", "INTEGER REFERENCES tratamiento(id)"),
            ("diagnostico_tratamiento", "TEXT"),
        ]:
            try:
                cur.execute(f"ALTER TABLE derivacion ADD COLUMN {col} {defn}")
            except Exception:
                pg.rollback()
        for tabla, col, defn in [
            ("derivacion_prestacion", "id_centro_medico", "INTEGER REFERENCES centro_medico(id)"),
            ("derivacion_alojamiento", "id_lugar_alojamiento", "INTEGER REFERENCES lugar_alojamiento(id)"),
        ]:
            try:
                cur.execute(f"ALTER TABLE {tabla} ADD COLUMN {col} {defn}")
            except Exception:
                pg.rollback()
        # Backfill idempotente: pasar el texto libre existente a los catálogos
        try:
            cur.execute("""
                INSERT INTO centro_medico (nombre)
                SELECT DISTINCT TRIM(centro_medico) FROM derivacion_prestacion
                WHERE centro_medico IS NOT NULL AND TRIM(centro_medico) <> ''
                ON CONFLICT (nombre) DO NOTHING;
                INSERT INTO lugar_alojamiento (nombre)
                SELECT DISTINCT TRIM(lugar_alojamiento) FROM derivacion_alojamiento
                WHERE lugar_alojamiento IS NOT NULL AND TRIM(lugar_alojamiento) <> ''
                ON CONFLICT (nombre) DO NOTHING;
                UPDATE derivacion_prestacion dp SET id_centro_medico = cm.id
                FROM centro_medico cm
                WHERE dp.id_centro_medico IS NULL AND dp.centro_medico IS NOT NULL
                  AND cm.nombre = TRIM(dp.centro_medico);
                UPDATE derivacion_alojamiento da SET id_lugar_alojamiento = la.id
                FROM lugar_alojamiento la
                WHERE da.id_lugar_alojamiento IS NULL AND da.lugar_alojamiento IS NOT NULL
                  AND la.nombre = TRIM(da.lugar_alojamiento);
            """)
        except Exception:
            pg.rollback()
        pg.commit()
        cur.close()
        pg.close()
    except Exception as e:
        print(f"[DERIVACION TABLES] {e}")


_ensure_derivacion_tables()


@app.get("/coberturas")
def listar_coberturas(token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("SELECT id, nombre FROM cobertura ORDER BY nombre")
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [{"id": r[0], "nombre": r[1]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/coberturas")
def crear_cobertura(nombre: str, token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("INSERT INTO cobertura (nombre) VALUES (%s) ON CONFLICT (nombre) DO NOTHING RETURNING id", (nombre,))
        row = cur.fetchone()
        if row is None:
            cur.execute("SELECT id FROM cobertura WHERE nombre = %s", (nombre,))
            row = cur.fetchone()
        pg.commit()
        cur.close()
        pg.close()
        return {"id": row[0], "nombre": nombre}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tipos-traslado")
def listar_tipos_traslado(token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("SELECT id, nombre FROM tipo_traslado ORDER BY nombre")
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [{"id": r[0], "nombre": r[1]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tipos-traslado")
def crear_tipo_traslado(nombre: str, token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("INSERT INTO tipo_traslado (nombre) VALUES (%s) ON CONFLICT (nombre) DO NOTHING RETURNING id", (nombre,))
        row = cur.fetchone()
        if row is None:
            cur.execute("SELECT id FROM tipo_traslado WHERE nombre = %s", (nombre,))
            row = cur.fetchone()
        pg.commit()
        cur.close()
        pg.close()
        return {"id": row[0], "nombre": nombre}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tipos-alojamiento")
def listar_tipos_alojamiento(token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("SELECT id, nombre FROM tipo_alojamiento ORDER BY nombre")
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [{"id": r[0], "nombre": r[1]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tipos-alojamiento")
def crear_tipo_alojamiento(nombre: str, token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("INSERT INTO tipo_alojamiento (nombre) VALUES (%s) ON CONFLICT (nombre) DO NOTHING RETURNING id", (nombre,))
        row = cur.fetchone()
        if row is None:
            cur.execute("SELECT id FROM tipo_alojamiento WHERE nombre = %s", (nombre,))
            row = cur.fetchone()
        pg.commit()
        cur.close()
        pg.close()
        return {"id": row[0], "nombre": nombre}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tipos-patologia")
def listar_tipos_patologia(token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("SELECT id, tipo_pat FROM tipo_patologia ORDER BY tipo_pat")
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [{"id": r[0], "nombre": r[1]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tipos-patologia")
def crear_tipo_patologia(nombre: str, token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("INSERT INTO tipo_patologia (tipo_pat) VALUES (%s) ON CONFLICT (tipo_pat) DO NOTHING RETURNING id", (nombre,))
        row = cur.fetchone()
        if row is None:
            cur.execute("SELECT id FROM tipo_patologia WHERE tipo_pat = %s", (nombre,))
            row = cur.fetchone()
        pg.commit()
        cur.close()
        pg.close()
        return {"id": row[0], "nombre": nombre}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tratamientos")
def listar_tratamientos(token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("SELECT id, tratamiento FROM tratamiento ORDER BY tratamiento")
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [{"id": r[0], "nombre": r[1]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tratamientos")
def crear_tratamiento(nombre: str, token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("INSERT INTO tratamiento (tratamiento) VALUES (%s) ON CONFLICT (tratamiento) DO NOTHING RETURNING id", (nombre,))
        row = cur.fetchone()
        if row is None:
            cur.execute("SELECT id FROM tratamiento WHERE tratamiento = %s", (nombre,))
            row = cur.fetchone()
        pg.commit()
        cur.close()
        pg.close()
        return {"id": row[0], "nombre": nombre}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/centros-medicos")
def listar_centros_medicos(token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("SELECT id, nombre FROM centro_medico ORDER BY nombre")
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [{"id": r[0], "nombre": r[1]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/centros-medicos")
def crear_centro_medico(nombre: str, token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("INSERT INTO centro_medico (nombre) VALUES (%s) ON CONFLICT (nombre) DO NOTHING RETURNING id", (nombre,))
        row = cur.fetchone()
        if row is None:
            cur.execute("SELECT id FROM centro_medico WHERE nombre = %s", (nombre,))
            row = cur.fetchone()
        pg.commit()
        cur.close()
        pg.close()
        return {"id": row[0], "nombre": nombre}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/lugares-alojamiento")
def listar_lugares_alojamiento(token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("SELECT id, nombre FROM lugar_alojamiento ORDER BY nombre")
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [{"id": r[0], "nombre": r[1]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/lugares-alojamiento")
def crear_lugar_alojamiento(nombre: str, token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("INSERT INTO lugar_alojamiento (nombre) VALUES (%s) ON CONFLICT (nombre) DO NOTHING RETURNING id", (nombre,))
        row = cur.fetchone()
        if row is None:
            cur.execute("SELECT id FROM lugar_alojamiento WHERE nombre = %s", (nombre,))
            row = cur.fetchone()
        pg.commit()
        cur.close()
        pg.close()
        return {"id": row[0], "nombre": nombre}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


_DERIVACION_SELECT = """
    SELECT d.id_derivacion, d.mes, d.nro_disposicion, d.fecha,
           d.afiliado_documento, d.afiliado_nombre, d.afiliado_credencial,
           d.afiliado_edad, d.afiliado_sexo, d.expediente,
           d.tipo_patologia, d.diagnostico, d.tratamiento, d.fecha_turno,
           d.creado_en,
           dp.destino, dp.id_cobertura, c.nombre,
           COALESCE(cm.nombre, dp.centro_medico), dp.monto_prestacion,
           dt.id_tipo_traslado, tt.nombre,
           dt.cant_acompanantes, dt.monto_traslado,
           da.id_cobertura_alojamiento, ca.nombre,
           da.id_tipo_alojamiento, ta.nombre,
           COALESCE(la.nombre, da.lugar_alojamiento), da.cant_noches, da.monto_alojamiento,
           d.id_tipo_patologia, tp.tipo_pat,
           d.id_tratamiento, tr.tratamiento,
           d.diagnostico_tratamiento,
           dp.id_centro_medico, da.id_lugar_alojamiento
    FROM derivacion d
    LEFT JOIN derivacion_prestacion dp ON dp.id_derivacion = d.id_derivacion
    LEFT JOIN cobertura c ON c.id = dp.id_cobertura
    LEFT JOIN centro_medico cm ON cm.id = dp.id_centro_medico
    LEFT JOIN derivacion_traslado dt ON dt.id_derivacion = d.id_derivacion
    LEFT JOIN tipo_traslado tt ON tt.id = dt.id_tipo_traslado
    LEFT JOIN derivacion_alojamiento da ON da.id_derivacion = d.id_derivacion
    LEFT JOIN cobertura ca ON ca.id = da.id_cobertura_alojamiento
    LEFT JOIN tipo_alojamiento ta ON ta.id = da.id_tipo_alojamiento
    LEFT JOIN lugar_alojamiento la ON la.id = da.id_lugar_alojamiento
    LEFT JOIN tipo_patologia tp ON tp.id = d.id_tipo_patologia
    LEFT JOIN tratamiento tr ON tr.id = d.id_tratamiento
"""


def _row_to_derivacion(r):
    return {
        "id": r[0],
        "mes": r[1],
        "nro_disposicion": r[2],
        "fecha": r[3].strftime("%Y-%m-%d") if r[3] else None,
        "afiliado_documento": r[4],
        "afiliado_nombre": r[5],
        "afiliado_credencial": r[6],
        "afiliado_edad": r[7],
        "afiliado_sexo": r[8],
        "expediente": r[9],
        "tipo_patologia": r[10],
        "diagnostico": r[11],
        "tratamiento": r[12],
        "fecha_turno": r[13].strftime("%Y-%m-%d") if r[13] else None,
        "creado_en": r[14].isoformat() if r[14] else None,
        "destino": r[15],
        "id_cobertura": r[16],
        "cobertura_prestacion": r[17],
        "centro_medico": r[18],
        "monto_prestacion": float(r[19]) if r[19] is not None else None,
        "id_tipo_traslado": r[20],
        "tipo_traslado": r[21],
        "cant_acompanantes": r[22],
        "monto_traslado": float(r[23]) if r[23] is not None else None,
        "id_cobertura_alojamiento": r[24],
        "cobertura_alojamiento": r[25],
        "id_tipo_alojamiento": r[26],
        "tipo_alojamiento": r[27],
        "lugar_alojamiento": r[28],
        "cant_noches": r[29],
        "monto_alojamiento": float(r[30]) if r[30] is not None else None,
        "id_tipo_patologia": r[31],
        "tipo_patologia_nombre": r[32],
        "id_tratamiento": r[33],
        "tratamiento_nombre": r[34],
        "diagnostico_tratamiento": r[35],
        "id_centro_medico": r[36],
        "id_lugar_alojamiento": r[37],
    }


@app.get("/derivaciones")
def listar_derivaciones(mes: str = "", token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        if mes:
            cur.execute(
                _DERIVACION_SELECT + " WHERE d.mes = %s ORDER BY d.fecha, d.id_derivacion",
                (mes,),
            )
        else:
            cur.execute(
                _DERIVACION_SELECT + " ORDER BY d.mes DESC, d.fecha, d.id_derivacion LIMIT 200"
            )
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [_row_to_derivacion(r) for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/derivaciones/meses")
def listar_meses_derivaciones(token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute(
            """SELECT DISTINCT mes, COUNT(*) as total
               FROM derivacion
               GROUP BY mes
               ORDER BY mes DESC"""
        )
        rows = cur.fetchall()
        cur.close()
        pg.close()
        return [
            {"mes": r[0], "total": r[1]}
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/derivaciones")
def crear_derivacion(datos: DerivacionRequest, token: str | None = Depends(oauth2_scheme)):
    uid, uemail = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos para crear derivaciones")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute(
            """INSERT INTO derivacion
                   (mes, nro_disposicion, fecha, expediente,
                    afiliado_documento, afiliado_nombre, afiliado_credencial,
                    afiliado_edad, afiliado_sexo,
                    tipo_patologia, diagnostico, tratamiento, fecha_turno,
                    id_tipo_patologia, id_tratamiento, diagnostico_tratamiento,
                    creado_por)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               RETURNING id_derivacion""",
            (
                datos.mes,
                _to_str(datos.nro_disposicion),
                _to_fecha_sql(datos.fecha),
                _to_str(datos.expediente),
                datos.afiliado_documento,
                _to_str(datos.afiliado_nombre),
                _to_str(datos.afiliado_credencial),
                datos.afiliado_edad,
                _to_str(datos.afiliado_sexo),
                _to_str(datos.tipo_patologia),
                _to_str(datos.diagnostico),
                _to_str(datos.tratamiento),
                _to_fecha_sql(datos.fecha_turno),
                datos.id_tipo_patologia,
                datos.id_tratamiento,
                _to_str(datos.diagnostico_tratamiento),
                uemail or str(uid),
            ),
        )
        new_id = cur.fetchone()[0]
        cur.execute(
            """INSERT INTO derivacion_prestacion
                   (id_derivacion, destino, id_cobertura, id_centro_medico, monto_prestacion)
               VALUES (%s,%s,%s,%s,%s)""",
            (new_id, _to_str(datos.destino), datos.id_cobertura,
             datos.id_centro_medico, datos.monto_prestacion),
        )
        if datos.id_tipo_traslado or datos.cant_acompanantes or datos.monto_traslado:
            cur.execute(
                """INSERT INTO derivacion_traslado
                       (id_derivacion, id_tipo_traslado, cant_acompanantes, monto_traslado)
                   VALUES (%s,%s,%s,%s)""",
                (new_id, datos.id_tipo_traslado, datos.cant_acompanantes or 0, datos.monto_traslado),
            )
        if datos.id_cobertura_alojamiento or datos.id_tipo_alojamiento or datos.id_lugar_alojamiento or datos.cant_noches or datos.monto_alojamiento:
            cur.execute(
                """INSERT INTO derivacion_alojamiento
                       (id_derivacion, id_cobertura_alojamiento, id_tipo_alojamiento,
                        id_lugar_alojamiento, cant_noches, monto_alojamiento)
                   VALUES (%s,%s,%s,%s,%s,%s)""",
                (new_id, datos.id_cobertura_alojamiento, datos.id_tipo_alojamiento,
                 datos.id_lugar_alojamiento, datos.cant_noches, datos.monto_alojamiento),
            )
        pg.commit()
        cur.close()
        pg.close()
        return {"ok": True, "id": new_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/derivaciones/{derivacion_id}")
def actualizar_derivacion(derivacion_id: int, datos: DerivacionRequest, token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos para editar derivaciones")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("SELECT id_derivacion FROM derivacion WHERE id_derivacion = %s", (derivacion_id,))
        if cur.fetchone() is None:
            cur.close()
            pg.close()
            raise HTTPException(status_code=404, detail="Derivación no encontrada")
        cur.execute(
            """UPDATE derivacion SET
                   mes=%s, nro_disposicion=%s, fecha=%s, expediente=%s,
                   afiliado_documento=%s, afiliado_nombre=%s, afiliado_credencial=%s,
                   afiliado_edad=%s, afiliado_sexo=%s,
                   tipo_patologia=%s, diagnostico=%s, tratamiento=%s, fecha_turno=%s,
                   id_tipo_patologia=%s, id_tratamiento=%s, diagnostico_tratamiento=%s
               WHERE id_derivacion=%s""",
            (
                datos.mes,
                _to_str(datos.nro_disposicion),
                _to_fecha_sql(datos.fecha),
                _to_str(datos.expediente),
                datos.afiliado_documento,
                _to_str(datos.afiliado_nombre),
                _to_str(datos.afiliado_credencial),
                datos.afiliado_edad,
                _to_str(datos.afiliado_sexo),
                _to_str(datos.tipo_patologia),
                _to_str(datos.diagnostico),
                _to_str(datos.tratamiento),
                _to_fecha_sql(datos.fecha_turno),
                datos.id_tipo_patologia,
                datos.id_tratamiento,
                _to_str(datos.diagnostico_tratamiento),
                derivacion_id,
            ),
        )
        cur.execute(
            """INSERT INTO derivacion_prestacion (id_derivacion, destino, id_cobertura, id_centro_medico, monto_prestacion)
               VALUES (%s,%s,%s,%s,%s)
               ON CONFLICT (id_derivacion) DO UPDATE SET
                   destino=EXCLUDED.destino, id_cobertura=EXCLUDED.id_cobertura,
                   id_centro_medico=EXCLUDED.id_centro_medico, monto_prestacion=EXCLUDED.monto_prestacion""",
            (derivacion_id, _to_str(datos.destino), datos.id_cobertura,
             datos.id_centro_medico, datos.monto_prestacion),
        )
        if datos.id_tipo_traslado or datos.cant_acompanantes or datos.monto_traslado:
            cur.execute(
                """INSERT INTO derivacion_traslado (id_derivacion, id_tipo_traslado, cant_acompanantes, monto_traslado)
                   VALUES (%s,%s,%s,%s)
                   ON CONFLICT (id_derivacion) DO UPDATE SET
                       id_tipo_traslado=EXCLUDED.id_tipo_traslado,
                       cant_acompanantes=EXCLUDED.cant_acompanantes,
                       monto_traslado=EXCLUDED.monto_traslado""",
                (derivacion_id, datos.id_tipo_traslado, datos.cant_acompanantes or 0, datos.monto_traslado),
            )
        else:
            cur.execute("DELETE FROM derivacion_traslado WHERE id_derivacion = %s", (derivacion_id,))
        if datos.id_cobertura_alojamiento or datos.id_tipo_alojamiento or datos.id_lugar_alojamiento or datos.cant_noches or datos.monto_alojamiento:
            cur.execute(
                """INSERT INTO derivacion_alojamiento
                       (id_derivacion, id_cobertura_alojamiento, id_tipo_alojamiento,
                        id_lugar_alojamiento, cant_noches, monto_alojamiento)
                   VALUES (%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (id_derivacion) DO UPDATE SET
                       id_cobertura_alojamiento=EXCLUDED.id_cobertura_alojamiento,
                       id_tipo_alojamiento=EXCLUDED.id_tipo_alojamiento,
                       id_lugar_alojamiento=EXCLUDED.id_lugar_alojamiento,
                       cant_noches=EXCLUDED.cant_noches,
                       monto_alojamiento=EXCLUDED.monto_alojamiento""",
                (derivacion_id, datos.id_cobertura_alojamiento, datos.id_tipo_alojamiento,
                 datos.id_lugar_alojamiento, datos.cant_noches, datos.monto_alojamiento),
            )
        else:
            cur.execute("DELETE FROM derivacion_alojamiento WHERE id_derivacion = %s", (derivacion_id,))
        pg.commit()
        cur.close()
        pg.close()
        return {"ok": True, "id": derivacion_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/derivaciones/{derivacion_id}")
def eliminar_derivacion(derivacion_id: int, token: str | None = Depends(oauth2_scheme)):
    uid, _ = _extraer_usuario(token)
    if uid is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    if _solo_lectura(_extraer_roles(token)):
        raise HTTPException(status_code=403, detail="Sin permisos para eliminar derivaciones")
    try:
        pg = get_pg_connection()
        cur = pg.cursor()
        cur.execute("SELECT id_derivacion FROM derivacion WHERE id_derivacion = %s", (derivacion_id,))
        if cur.fetchone() is None:
            cur.close()
            pg.close()
            raise HTTPException(status_code=404, detail="Derivación no encontrada")
        cur.execute("DELETE FROM derivacion WHERE id_derivacion = %s", (derivacion_id,))
        pg.commit()
        cur.close()
        pg.close()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/patologias/afiliado/{documento}")
def patologias_afiliado(documento: int):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT p.PAT_ID, p.PAT_NOMBRE, p.PAT_CIE_CLAVE, d.descripcion
               FROM cronicos c
               INNER JOIN PATOLOGIAS p ON c.CRO_PAT_ID = p.PAT_ID
               LEFT JOIN CIE_diagnosticos d ON p.PAT_CIE_CLAVE = d.codigo
               WHERE c.CRO_DOCUMENTO = ?
               ORDER BY p.PAT_NOMBRE""",
            (documento,),
        )
        rows = cursor.fetchall()
        cursor.close()
        return [
            {
                "pat_id": _num(r[0]),
                "nombre": (r[1] or "").strip(),
                "cie_clave": (r[2] or "").strip(),
                "diagnostico": (r[3] or "").strip(),
            }
            for r in rows
        ]
    except Exception as e:
        return {"error": str(e)}


@app.get("/diagnosticos/{cie_clave}")
def diagnosticos_por_cie(cie_clave: str):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT codigo, descripcion FROM CIE_diagnosticos WHERE codigo = ?",
            (cie_clave,),
        )
        rows = list(cursor.fetchall())
        cursor.execute(
            "SELECT TOP 50 codigo, descripcion FROM CIE_diagnosticos WHERE codigo LIKE ? ORDER BY codigo",
            (cie_clave + ".%",),
        )
        rows.extend(cursor.fetchall())
        cursor.close()
        return [
            {
                "codigo": (r[0] or "").strip(),
                "descripcion": (r[1] or "").strip(),
            }
            for r in rows
        ]
    except Exception as e:
        return {"error": str(e)}


@app.get("/db-columnas/{tabla}")
def listar_columnas(tabla: str):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
            (tabla,)
        )
        rows = cursor.fetchall()
        cursor.close()
        return [{"columna": r[0], "tipo": r[1]} for r in rows]
    except Exception as e:
        return {"error": str(e)}


@app.get("/db-tablas")
def listar_tablas():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME"
        )
        rows = cursor.fetchall()
        cursor.close()
        return [{"schema": r[0], "tabla": r[1]} for r in rows]
    except Exception as e:
        return {"error": str(e)}


@app.get("/db-test")
def test_db():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT DB_NAME(), @@SERVERNAME")
        db_name, server_name = cursor.fetchone()
        cursor.close()
        return {
            "status": "connected",
            "message": "Conexión a SQL Server exitosa",
            "database": db_name,
            "server": server_name,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": "No se pudo conectar a SQL Server.",
            "error": str(e),
        }
