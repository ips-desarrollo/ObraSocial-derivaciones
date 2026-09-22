FROM python:3.10-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       unixodbc unixodbc-dev tdsodbc freetds-common freetds-dev libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*

RUN printf '[FreeTDS]\nDescription = FreeTDS Driver\nDriver = /usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so\nSetup = /usr/lib/x86_64-linux-gnu/odbc/libtdsS.so\n' > /etc/odbcinst.ini

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
