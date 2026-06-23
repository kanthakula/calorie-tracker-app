# K21 Calorie Tracker — AI service
FROM python:3.12-slim

# Avoid .pyc files and buffer stdout/stderr for clean container logs.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy the application code.
COPY app ./app

EXPOSE 8000

# Run a non-root user for safety.
RUN useradd --create-home --uid 10001 appuser
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
