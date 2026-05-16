# Image légère adaptée au Raspberry Pi (ARM 64) et x86
FROM node:20-bookworm-slim

# better-sqlite3 a besoin d'outils de build natifs
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installer les dépendances (cache layer)
COPY backend/package.json ./backend/package.json
WORKDIR /app/backend
RUN npm install --omit=dev

# Copier le reste
WORKDIR /app
COPY backend ./backend
COPY dashboard ./dashboard

WORKDIR /app/backend

ENV NODE_ENV=production
EXPOSE 3000 1883

CMD ["node", "src/server.js"]
