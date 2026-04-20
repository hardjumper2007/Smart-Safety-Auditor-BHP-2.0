FROM python:3.11-slim

WORKDIR /app

# Instalacja zależności systemowych
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Kopiujemy plik z wymaganiami
COPY requirements.txt .

# Instalujemy biblioteki Pythona
RUN pip install --no-cache-dir -r requirements.txt

# KOPIUJEMY KOD (tutaj była poprawka)
# Zakładając, że Twój kod jest w folderze 'app' obok Dockerfile:
COPY ./app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]