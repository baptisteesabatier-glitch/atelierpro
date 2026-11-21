# --- Étape 1 : build du front (React + Vite) -----------------------------
FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

# --- Étape 2 : dépendances et compilation de l'API -----------------------
FROM node:22-bookworm-slim AS api
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY server/prisma ./prisma
RUN npx prisma generate
COPY server/tsconfig.json ./
COPY server/src ./src
COPY server/scripts ./scripts
RUN npm run build

# --- Étape 3 : image d'exécution ------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    WEB_DIST=/app/public \
    PORT=4000

# node_modules conservés avec la CLI Prisma : les migrations s'appliquent
# au démarrage du conteneur, sans accès réseau supplémentaire.
COPY --from=api /app/node_modules ./node_modules
COPY --from=api /app/dist ./dist
COPY --from=api /app/prisma ./prisma
COPY --from=api /app/package.json ./package.json
COPY --from=web /app/dist ./public
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
  && useradd --create-home --uid 10001 atelier \
  && mkdir -p /app/backups \
  && chown -R atelier:atelier /app

USER atelier
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
