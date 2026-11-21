#!/bin/sh
# Applique les migrations puis démarre l'API et le front compilé.
set -eu

echo "[atelierpro] application des migrations Prisma…"
npx prisma migrate deploy

echo "[atelierpro] démarrage du serveur sur le port ${PORT:-4000}"
exec node dist/src/index.js
