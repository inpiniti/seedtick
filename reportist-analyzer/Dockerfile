FROM oven/bun:1.4-slim AS bun-deps

WORKDIR /app/opencode-shim
COPY opencode-shim/package.json opencode-shim/bun.lock ./
RUN bun install --frozen-lockfile --production


FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=bun-deps /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun-deps /app/opencode-shim/node_modules /app/opencode-shim/node_modules

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod -R 777 /app

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
