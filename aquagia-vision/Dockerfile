FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema para OpenCV headless y V4L2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    v4l-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app
EXPOSE 8000

# Por defecto inicia el daemon con API REST y scheduler periódico
CMD ["python", "cli.py", "daemon", "--port", "8000"]
