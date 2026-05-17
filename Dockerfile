# Dockerfile racine optimisé pour Google Cloud Run
# Build : gcloud builds submit --tag gcr.io/PROJECT-ID/telemetrie-backend
# Deploy : gcloud run deploy telemetrie-backend --image gcr.io/PROJECT-ID/telemetrie-backend --region europe-west1

FROM node:20-bookworm-slim

# Outils de build pour better-sqlite3 (binaire natif)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dépendances backend
COPY backend/package.json ./backend/package.json
WORKDIR /app/backend
RUN npm install --omit=dev

# Copie tout le projet (backend + dashboard + web + demos + admin)
WORKDIR /app
COPY backend ./backend
COPY dashboard ./dashboard
COPY web ./web
COPY demos ./demos
COPY demos-public ./demos-public
COPY admin ./admin

# Cloud Run injecte PORT (par défaut 8080). On crée un volume éphémère pour SQLite.
ENV NODE_ENV=production
ENV DB_PATH=/tmp/telemetry.db

EXPOSE 8080

# IMPORTANT : Cloud Run nécessite que l'app écoute sur 0.0.0.0:$PORT (déjà géré dans server.js)
CMD ["node", "backend/src/server.js"]
