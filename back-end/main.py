from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import psycopg2

app = FastAPI(title="API Obra Social")

# Habilitar CORS para que React se comunique de forma segura
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción se puede restringir al dominio de tu React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "message": "API de Python (FastAPI) funcionando correctamente"
    }

@app.get("/db-test")
def test_db():
    # Soporte para DATABASE_URL (fácil de usar en Dokploy) o variables individuales
    database_url = os.getenv("DATABASE_URL")
    
    try:
        if database_url:
            connection = psycopg2.connect(database_url, connect_timeout=5)
            db_name = connection.info.dbname
            db_host = connection.info.host
        else:
            db_user = os.getenv("DB_USER", "postgres")
            db_password = os.getenv("DB_PASSWORD", "postgres")
            db_host = os.getenv("DB_HOST", "localhost")
            db_port = os.getenv("DB_PORT", "5432")
            db_name = os.getenv("DB_NAME", "obra_social")
            
            connection = psycopg2.connect(
                host=db_host,
                user=db_user,
                password=db_password,
                dbname=db_name,
                port=int(db_port),
                connect_timeout=5
            )
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
            
        connection.close()
        
        return {
            "status": "connected",
            "message": "¡Conexión a PostgreSQL exitosa desde Python (usando psycopg2)!",
            "database": db_name,
            "host": db_host
        }
    except Exception as e:
        return {
            "status": "error",
            "message": "No se pudo conectar a la base de datos PostgreSQL. Revisa tus credenciales o si el servicio está activo.",
            "error": str(e)
        }
