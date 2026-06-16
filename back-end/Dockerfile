FROM python:3.10-slim

WORKDIR /app

# Instalar dependencias si es necesario
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el codigo del proyecto
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
