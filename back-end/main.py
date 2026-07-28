from fastapi import FastAPI, Body, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta, timezone
_ART = timezone(timedelta(hours=-3))
from decimal import Decimal
import json
import os
import pyodbc
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


# Una conexión NUEVA por request. Compartir una sola conexión global entre
# requests es inseguro: FastAPI corre los endpoints sync en varios hilos y
# pyodbc no permite usar la misma conexión desde hilos distintos a la vez, lo
# que hace que el backend se cuelgue. pyodbc mantiene un pool interno
# (pooling=True por defecto), así que abrir por request reutiliza la conexión
# física y sigue siendo rápido.
#
# autocommit=True: cada sentencia se confirma sola; los SELECT no dejan
# transacciones abiertas y un UPDATE fallido no envenena nada.
def get_connection():
    return pyodbc.connect(_build_conn_str(), timeout=5, autocommit=True)


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
            # Búsqueda por DNI (Documento es la PK, index seek directo)
            cursor.execute(
                """SELECT TOP 50 Documento, Nombre, nombre_afiliado, apellido_afiliado
                   FROM Afiliados
                   WHERE CAST(Documento AS VARCHAR(20)) LIKE ?
                   ORDER BY Documento""",
                (prefijo,)
            )
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
        credencial = "".join(
            str(int(v)) for v in (row[13], row[14], row[15]) if v is not None
        ) or None

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
