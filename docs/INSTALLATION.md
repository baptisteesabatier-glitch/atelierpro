# Installation d’AtelierPro 2.0

AtelierPro 2.0 est une application autonome : un serveur Node.js, une base
PostgreSQL et un front React compilé. Aucun compte, service payant ou API
externe n’est nécessaire.

Deux méthodes sont documentées :

1. **Docker Compose** (recommandée) — un seul serveur, deux conteneurs.
2. **Installation manuelle** — Node.js 22+ et PostgreSQL 14+ déjà installés.

---

## 1. Prérequis

| Élément | Version minimale | Remarque |
| --- | --- | --- |
| Docker Engine / Docker Desktop | 24 | avec le plugin Compose v2 |
| ou Node.js | 22 LTS | 20 fonctionne mais n’est plus testé |
| PostgreSQL | 14 | encodage **UTF8** obligatoire |
| RAM | 1 Go | 2 Go confortables |
| Disque | 2 Go | hors sauvegardes |

> **Encodage** : la base doit être créée en UTF8 (`--encoding=UTF8`).
> Un cluster Windows en `WIN1252` refuse certains caractères (flèches, emoji)
> et provoque des erreurs d’écriture.

---

## 2. Installation avec Docker Compose

```bash
git clone <votre-dépôt> atelierpro
cd atelierpro
cp .env.example .env
```

Éditez `.env` :

```ini
POSTGRES_PASSWORD=un-mot-de-passe-long-et-unique
APP_ORIGIN=http://localhost:4000
COOKIE_SECURE=false      # true derrière HTTPS
TRUST_PROXY=true
PORT=4000
```

Puis :

```bash
docker compose up -d --build
docker compose ps          # les deux services doivent être « healthy »
```

L’application est disponible sur `http://localhost:4000`.
Les migrations Prisma sont appliquées automatiquement au démarrage du
conteneur `app`.

### Créer le premier administrateur

Aucun identifiant n’est codé en dur. La commande suivante génère un mot de
passe aléatoire et l’affiche **une seule fois** :

```bash
docker compose exec app node dist/scripts/create-admin.js \
  --email vous@atelier.fr --name "Prénom Nom"
```

Pour choisir vous-même le mot de passe (10 caractères minimum) :

```bash
docker compose exec app node dist/scripts/create-admin.js \
  --email vous@atelier.fr --name "Prénom Nom" --password "MonMotDePasse2026!"
```

Connectez-vous, puis changez le mot de passe depuis **Paramètres → Sécurité**.

### Données de démonstration (facultatif)

Sur une base **vide** uniquement :

```bash
docker compose exec app node dist/scripts/seed-demo.js --password "Demo2026!Demo"
```

Cela crée 9 clients, 15 dossiers, des devis, deux techniciens et un
administrateur (`admin@atelierpro.local`). Ces données sont fictives.

### Sauvegardes en conteneur

```bash
docker compose exec app node dist/scripts/backup.js --out /app/backups/atelierpro-$(date +%F).json
docker compose cp app:/app/backups/atelierpro-$(date +%F).json ./sauvegardes/
```

Le volume `atelierpro-backups` conserve les fichiers produits dans
`/app/backups`. Voir [SAUVEGARDE.md](./SAUVEGARDE.md).

---

## 3. Installation manuelle

```bash
# 1. Dépendances
npm run install:all

# 2. Base de données
createdb -E UTF8 atelierpro      # ou via psql / pgAdmin

# 3. Configuration serveur
cp server/.env.example server/.env
#   → renseignez DATABASE_URL, APP_ORIGIN, PORT…

# 4. Schéma
npm run db:migrate

# 5. Compte administrateur
npm run admin:create -- --email vous@atelier.fr --name "Prénom Nom"

# 6. Build du front + de l’API
npm run build:all

# 7. Démarrage
WEB_DIST=dist NODE_ENV=production npm start
```

`npm start` sert l’API (`/api/*`) **et** le front compilé sur le même port.
`WEB_DIST` indique le dossier du build Vite (`dist` à la racine du dépôt).

### Développement (deux processus)

```bash
npm run dev        # Vite sur http://127.0.0.1:5173 (proxy /api → 4000)
npm run dev:api    # API Express sur http://127.0.0.1:4000
```

Vite proxifie `/api` vers le serveur : aucun réglage CORS n’est nécessaire.

---

## 4. Mise en production

### Reverse proxy et HTTPS

Exemple Nginx :

```nginx
server {
  listen 443 ssl http2;
  server_name atelier.mon-domaine.fr;

  ssl_certificate     /etc/letsencrypt/live/atelier.mon-domaine.fr/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/atelier.mon-domaine.fr/privkey.pem;

  client_max_body_size 4m;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Puis dans `.env` :

```ini
APP_ORIGIN=https://atelier.mon-domaine.fr
COOKIE_SECURE=true
TRUST_PROXY=true
```

`APP_ORIGIN` doit correspondre **exactement** à l’origine utilisée dans le
navigateur (schéma + hôte, sans slash final). Les mutations provenant d’une
autre origine sont refusées.

`COOKIE_SECURE=true` exige HTTPS : en HTTP, la connexion échouerait.

### Liens de suivi client

Les liens publics sont de la forme
`https://atelier.mon-domaine.fr/suivi/<jeton>`. Ils sont générés depuis le
domaine courant : aucune configuration supplémentaire.

### Mise à jour

```bash
git pull
docker compose up -d --build     # les migrations s’appliquent au démarrage
```

Sauvegardez avant chaque mise à jour.

### Vérification de santé

```bash
curl -fsS http://localhost:4000/api/health
# {"status":"ok","version":"2.0.0","database":"up"}
```

---

## 5. Dépannage

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| `Configuration invalide : DATABASE_URL` | `.env` absent ou incomplet | copiez `server/.env.example` |
| `P1001` au démarrage | PostgreSQL injoignable | vérifiez le service `db` et `DATABASE_URL` |
| Connexion refusée après login | `APP_ORIGIN` différent de l’URL réelle | alignez la valeur, redémarrez |
| `CSRF` sur chaque action | cookies bloqués / origine mixte | même domaine, HTTPS cohérent |
| Erreur `22P05 … WIN1252` | base créée dans un mauvais encodage | recréez la base en UTF8 |
| `Impossible de retirer le dernier administrateur` | garde-fou | créez un autre admin d’abord |

Les journaux : `docker compose logs -f app`.
