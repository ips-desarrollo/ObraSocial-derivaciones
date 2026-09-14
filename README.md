# Obra Social - Estructura Base (Python + React + PostgreSQL)

##  Estructura del Proyecto

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

## Desarrollo Local

Si deseas correr e iterar el proyecto en tu computadora local antes de subir los cambios a Dokploy:

### Correr el Backend (Python)

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

### Correr el Frontend (React)

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