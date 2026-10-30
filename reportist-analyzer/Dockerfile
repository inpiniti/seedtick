FROM node:22-bookworm-slim AS node-runtime

FROM python:3.12-slim

COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libatomic1 \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

RUN node --version

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod -R 777 /app

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
