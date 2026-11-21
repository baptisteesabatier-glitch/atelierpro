# Procédure de transfert

Ce document décrit la remise d’AtelierPro 2.0 à un acquéreur de licence,
avec le code source, les données et les accès nécessaires.

## 1. Contenu remis

| Élément | Emplacement |
| --- | --- |
| Code source complet | dépôt Git (branche `main`) |
| Historique des versions | `git log` |
| Documentation | `README.md`, `docs/` |
| Licence commerciale | `LICENSE` |
| Inventaire open source | `docs/LICENCES.md` |
| Modèle de configuration | `.env.example`, `server/.env.example` |
| Migrations de base | `server/prisma/migrations/` |
| Suite de tests | `server/tests/` (35 tests) |
| Image Docker | `Dockerfile`, `docker-compose.yml` |

Ne sont **pas** remis : secrets de production, sauvegardes de données
personnelles, comptes et mots de passe des utilisateurs de l’atelier.

## 2. Préparation côté cédant

```bash
# 1. Sauvegarde complète
npm run backup -- --out transfert/donnees-metier.json
docker compose exec db pg_dump -U atelierpro -Fc atelierpro > transfert/base.dump

# 2. Vérification de l’état du dépôt
git status                 # doit être propre
npm test                   # suite verte
npm run typecheck
npm run build:all
```

3. Retirer du dépôt tout fichier local : `.env`, journaux, dossiers
   `node_modules`, `dist`, `server/tests/.pgdata-*`.
4. Vérifier qu’aucun secret n’apparaît dans l’historique :

   ```bash
   git log -p | grep -iE "(password|secret|token|api[_-]?key)" | head
   ```

5. Créer un tag de version : `git tag -a v2.0.0 -m "AtelierPro 2.0"`.

## 3. Mise en place chez l’acquéreur

```bash
git clone <dépôt> atelierpro
cd atelierpro
cp .env.example .env          # renseigner POSTGRES_PASSWORD, APP_ORIGIN…
docker compose up -d --build
docker compose exec app node dist/scripts/create-admin.js \
  --email admin@acquereur.fr --name "Administrateur"
```

Puis, si des données sont transférées :

```bash
docker compose cp ./donnees-metier.json app:/app/backups/import.json
docker compose exec app node dist/scripts/restore.js \
  --file /app/backups/import.json --confirm REPLACE
```

Les comptes utilisateurs doivent être recréés chez l’acquéreur : la
restauration ne les importe pas (par conception).

## 4. Secrets et accès à révoquer

À la fin du transfert, le cédant doit :

- révoquer l’accès au serveur et au dépôt de son côté ;
- supprimer ses propres sauvegardes de données client ;
- ne conserver aucun accès aux installations de l’acquéreur.

L’acquéreur doit générer ses propres valeurs :

| Secret | Où |
| --- | --- |
| `POSTGRES_PASSWORD` | `.env` |
| mots de passe utilisateurs | via l’interface, jamais par e-mail |
| certificats TLS | son hébergeur / Let’s Encrypt |

AtelierPro ne contient aucun secret intégré : aucune clé à faire tourner
dans le code.

## 5. Vérifications de recette

1. `curl -fsS https://<domaine>/api/health` → `database: "up"`.
2. Connexion administrateur, changement de mot de passe.
3. Création d’un client et d’un dossier.
4. Devis PDF et bon de dépôt téléchargeables.
5. Lien de suivi ouvert dans une fenêtre privée (aucune donnée privée).
6. Export de sauvegarde, puis restauration sur une base de test.
7. Création d’un technicien, vérification de ses permissions.
8. `npm test` et `npm run build:all` chez l’acquéreur.

## 6. Support et garanties

Le contrat de licence précise la durée de garantie, le périmètre du support
et les conditions de mise à jour. Aucun engagement n’est implicite : ce qui
n’est pas écrit dans le contrat n’est pas dû.
