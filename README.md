# 🏥 Obra Social - Estructura Base (Python + React + PostgreSQL)

Este es el punto de partida mínimo para tu proyecto. Está diseñado como un **Monorepo** y estructurado para ser desplegado de manera ágil en tu VPS administrada por **Dokploy**.

---

## 📁 Estructura del Proyecto

```text
/Obra-Social
├── /BD             <-- Scripts iniciales de tu Base de Datos PostgreSQL
│   └── schema.sql
├── /back-end       <-- API de Python desarrollada con FastAPI
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── /front-end      <-- Interfaz de Usuario con React (Vite + JavaScript)
│   ├── /src
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## 🚀 Despliegue en Dokploy (Tu VPS)

Sigue estos pasos para desplegar tu infraestructura en producción en menos de 5 minutos:

### Paso 1: Configurar la Base de Datos en Dokploy

1. Ve a tu panel de **Dokploy**.
2. Dirígete a la sección de **Databases** (Bases de datos) y haz clic en **Create Database**.
3. Selecciona **PostgreSQL**.
4. Elige un nombre para el servicio (por ejemplo, `db-obrasocial`).
5. Una vez creada, entra a la configuración de la base de datos y copia las credenciales generadas de conexión:
   * **Host / Internal Host** (usualmente es un nombre DNS interno de docker, ej: `db-obrasocial`)
   * **Port** (normalmente `5432`)
   * **User** (por defecto `postgres`)
   * **Password**
   * **Database Name** (por defecto `postgres` o la que configures)

*(Opcional)*: Puedes usar la herramienta de gestión que ofrece Dokploy para ejecutar el archivo `BD/schema.sql` y crear la tabla inicial de afiliados.

---

### Paso 2: Desplegar el Backend (Python)

1. Ve a **Applications** en Dokploy y haz clic en **Create Application**.
2. Conecta tu repositorio de GitHub/GitLab.
3. En la configuración de la aplicación:
   * **Root Directory:** Pon `/back-end` (esto le dice a Dokploy que el backend está en esa carpeta).
   * **Build Type:** Selecciona **Nixpacks** (Dokploy leerá tu `requirements.txt` e instalará todo de forma automática).
4. Ve a la pestaña de **Environment Variables** (Variables de Entorno) y agrega las credenciales de la base de datos PostgreSQL que obtuviste en el Paso 1:
   * `DB_USER`
   * `DB_PASSWORD`
   * `DB_HOST` (Usa el Host Interno que te dio Dokploy para que la conexión no viaje por internet y sea ultra rápida)
   * `DB_PORT`
   * `DB_NAME`
5. Haz clic en **Deploy**. Dokploy te dará un dominio/URL para tu backend (ej. `https://api.tudominio.com`).

---

### Paso 3: Desplegar el Frontend (React)

1. Ve a **Applications** y crea otra aplicación apuntando al mismo repositorio.
2. En la configuración:
   * **Root Directory:** Pon `/front-end`.
   * **Build Type:** Selecciona **Nixpacks** (Vite compilará el código estático automáticamente).
3. En **Environment Variables**, agrega la URL de tu backend para que React sepa a dónde hacer las peticiones:
   * `VITE_API_URL` = `https://api.tudominio.com` (La URL pública que Dokploy le asignó a tu backend en el Paso 2)
4. Haz clic en **Deploy**. ¡Listo! Ya tienes tu Frontend público conectado al Backend y el Backend conectado a PostgreSQL de forma 100% segura.

---

## 💻 Desarrollo Local

Si deseas correr e iterar el proyecto en tu computadora local antes de subir los cambios a Dokploy:

### 🐍 Correr el Backend (Python)

Requieres tener instalado Python 3.10+.

1. Ve a la carpeta del backend:
   ```bash
   cd back-end
   ```
2. Crea y activa un entorno virtual (opcional pero recomendado):
   ```bash
   python -m venv venv
   # En Windows (Powershell)
   .\venv\Scripts\Activate.ps1
   # En macOS/Linux
   source venv/bin/activate
   ```
3. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
4. Renombra `.env.example` a `.env` y edita los valores si tienes un PostgreSQL local.
5. Arranca el servidor de desarrollo:
   ```bash
   uvicorn main:app --reload
   ```
   La API estará disponible en `http://localhost:8000`.

---

### ⚛️ Correr el Frontend (React)

Requieres tener instalado Node.js 18+.

1. Ve a la carpeta del frontend:
   ```bash
   cd front-end
   ```
2. Instala las dependencias de Node:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo local de Vite:
   ```bash
   npm run dev
   ```
   La aplicación se abrirá en `http://localhost:5173`.