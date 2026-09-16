"""Resetea la contraseña de un usuario en la BD centralizada.

Uso:
    python resetear_password.py email@ejemplo.com NuevaContraseña123
"""

import sys
import os
import psycopg2
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main():
    if len(sys.argv) < 3:
        print("Uso: python resetear_password.py <email> <nueva_contraseña>")
        sys.exit(1)

    email = sys.argv[1].strip().lower()
    nueva = sys.argv[2]

    if len(nueva) < 8:
        print("Error: la contraseña debe tener al menos 8 caracteres.")
        sys.exit(1)

    pg = psycopg2.connect(
        host=os.getenv("USR_HOST") or "localhost",
        port=int(os.getenv("USR_PORT") or "5432"),
        dbname=os.getenv("USR_NAME") or "usuarios",
        user=os.getenv("USR_USER") or "postgres",
        password=os.getenv("USR_PASSWORD") or "postgres",
    )
    cur = pg.cursor()

    cur.execute("SELECT id, nombre_completo, password_hash FROM usuarios WHERE email = %s", (email,))
    row = cur.fetchone()
    if not row:
        print(f"Error: no se encontró el usuario '{email}' en la BD.")
        cur.close()
        pg.close()
        sys.exit(1)

    user_id, nombre, old_hash = row
    print(f"Usuario encontrado: {nombre} (id={user_id})")
    if old_hash and old_hash.startswith("$2"):
        print(f"  Hash actual: {old_hash[:20]}... (bcrypt válido)")
    else:
        print(f"  Hash actual: {old_hash!r} (NO es bcrypt válido — esto puede causar que cualquier password funcione o ninguna)")

    new_hash = pwd_context.hash(nueva)
    cur.execute(
        "UPDATE usuarios SET password_hash = %s, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = %s",
        (new_hash, user_id),
    )
    pg.commit()
    cur.close()
    pg.close()

    print(f"Contraseña actualizada correctamente para '{email}'.")
    print(f"  Nuevo hash: {new_hash[:20]}...")


if __name__ == "__main__":
    main()
