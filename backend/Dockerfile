# Użyj oficjalnego obrazu Python 3.11
FROM python:3.11-slim

# Ustaw katalog roboczy
WORKDIR /app

# Zainstaluj zależności systemowe (wymagane dla psycopg2, ffmpeg itp.)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Skopiuj requirements.txt i zainstaluj zależności Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Skopiuj cały katalog app/ do /app/app/
COPY ./app ./app

# Upewnij się, że katalog app/ jest pakietem Pythona
RUN touch /app/app/__init__.py

# Uruchom aplikację (poprawiona ścieżka: app.main:app)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]