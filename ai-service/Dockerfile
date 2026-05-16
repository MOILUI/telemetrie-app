FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY predict.py .

EXPOSE 8000
CMD ["uvicorn", "predict:app", "--host", "0.0.0.0", "--port", "8000"]
