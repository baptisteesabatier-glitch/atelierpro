# Documentation développeur

## Pile technique

| Couche | Choix |
| --- | --- |
| Front | React 19, TypeScript, Vite 6, Motion, React Router 7 |
| API | Node.js 22, Express 4, TypeScript (CommonJS compilé) |
| Base | PostgreSQL 14+, Prisma 6 |
| Validation | Zod |
| PDF | PDFKit |
| Tests | Vitest + Supertest + PostgreSQL embarqué |

Aucune dépendance payante, aucun service externe obligatoire.

## Arborescence

```
.
├── src/                 front React
│   ├── components/      coquille, primitives UI, dossier, devis
│   ├── lib/             client API, auth, hooks, métadonnées métier
│   └── pages/           tableau de bord, réparations, clients, utilisateurs,
│                        paramètres, connexion, suivi public
├── server/
│   ├── prisma/          schéma + migrations SQL
│   ├── scripts/         admin, démo, sauvegarde, restauration
│   ├── src/
│   │   ├── routes/      auth, users, clients, repairs, quotes, dashboard,
│   │   │                settings, backups, public
│   │   ├── services/    références, transitions, documents PDF, sauvegardes
│   │   ├── auth.ts      sessions, hachage, cookies
│   │   ├── middleware.ts CSRF, permissions, rate limiting
│   │   └── validation.ts schémas Zod
│   └── tests/           suite Vitest (PostgreSQL jetable)
├── docker/              entrypoint
├── docs/                cette documentation
├── Dockerfile
└── docker-compose.yml
```

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run install:all` | installe front + serveur |
| `npm run dev` | Vite (5173) avec proxy `/api` |
| `npm run dev:api` | API en mode watch (4000) |
| `npm run build` | typecheck + build front |
| `npm run build:server` | compile l’API dans `server/dist` |
| `npm run build:all` | les deux |
| `npm run typecheck` | TypeScript front + serveur |
| `npm test` | suite serveur (PostgreSQL embarqué) |
| `npm run db:migrate` | applique les migrations |
| `npm run db:seed-demo -- --password "…"` | jeu de démonstration |
| `npm run admin:create -- --email … --name …` | premier administrateur |
| `npm run backup -- --out fichier.json` | export CLI |
| `npm run restore -- --file fichier.json --confirm REPLACE` | import CLI |

### Tests

`npm test` démarre un PostgreSQL 18 jetable (`embedded-postgres`, port 55432),
applique les migrations, exécute 35 tests puis supprime le cluster. Aucun
service externe n’est requis ; le port 55432 doit être libre.

Couverture : connexion/déconnexion, CSRF, comptes désactivés, changement de
mot de passe et révocation de sessions, CRUD clients et garde-fous de
suppression, dossiers, transitions de statut, notes, devis (HT/TVA/TTC, PDF),
permissions admin/technicien, suivi public sans fuite de données,
sauvegarde/restauration et intégrité, indicateurs du tableau de bord.

### Modifier le schéma

```bash
cd server
npx prisma migrate dev --name ma_modification
npx prisma generate
```

En production, seules les migrations versionnées sont appliquées
(`prisma migrate deploy`), jamais `db push`.

## API REST

Toutes les routes sont sous `/api`. Les réponses d’erreur ont la forme
`{ "error": { "code", "message", "details" } }`.

### Authentification

| Méthode | Route | Accès |
| --- | --- | --- |
| POST | `/auth/login` | public (CSRF requis) |
| POST | `/auth/logout` | session |
| GET | `/auth/me` | public (renvoie `user: null` si déconnecté) |
| POST | `/auth/password` | session |

### Utilisateurs (admin)

`GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`
(désactivation). Garde-fous : impossible de désactiver le dernier
administrateur ou son propre compte.

### Clients

`GET /clients?q=`, `GET /clients/:id`, `POST /clients`, `PATCH /clients/:id`
(permission `canManageClients`), `DELETE /clients/:id` (admin, refusé si des
dossiers existent).

### Réparations

| Méthode | Route | Remarque |
| --- | --- | --- |
| GET | `/repairs?status=&q=&sort=&priority=&assignee=` | liste |
| GET | `/repairs/:id` | détail + notes + événements + devis |
| POST | `/repairs` | référence `AP-AAAA-NNNN` générée |
| PATCH | `/repairs/:id` | `canEditRepairs` |
| PATCH | `/repairs/:id/status` | `canChangeStatus`, `force` réservé admin |
| POST | `/repairs/:id/notes` | note interne |
| POST | `/repairs/:id/payment` | admin |
| DELETE | `/repairs/:id` | admin |
| GET | `/repairs/:id/deposit-slip.pdf` | bon de dépôt |
| GET | `/repairs/:id/return-slip.pdf` | bon de restitution |

Transitions autorisées :

```
NEW → DIAGNOSIS | CANCELLED
DIAGNOSIS → QUOTE_SENT | IN_PROGRESS | CANCELLED
QUOTE_SENT → AWAITING_APPROVAL | PART_ORDERED | IN_PROGRESS | CANCELLED
AWAITING_APPROVAL → PART_ORDERED | IN_PROGRESS | CANCELLED
PART_ORDERED → IN_PROGRESS | CANCELLED
IN_PROGRESS → REPAIRED | CANCELLED
REPAIRED → READY | IN_PROGRESS | CANCELLED
READY → RETURNED | REPAIRED
CANCELLED → NEW
```

Un administrateur peut forcer une transition (`force: true`) ; l’opération
est journalisée.

### Devis

`GET /quotes`, `GET /quotes/:id`, `POST /quotes` (`canCreateQuotes`),
`PATCH /quotes/:id`, `POST /quotes/:id/status`, `DELETE /quotes/:id` (admin,
refusé si accepté), `GET /quotes/:id/pdf`.

Montants en **centimes entiers** : `subtotalCents`, `vatCents`, `totalCents`.
Le statut du dossier suit le devis (envoyé → `QUOTE_SENT`, accepté →
`IN_PROGRESS`) sans jamais forcer une transition invalide.

### Tableau de bord

`GET /dashboard/summary` — compteurs, chiffre d’affaires **encaissé**
(et non estimé), encours estimé, délai moyen, série de 14 jours, répartition,
priorités, activité, performance des techniciens.

### Paramètres et sauvegardes

`GET /settings` (session), `PATCH /settings` (admin),
`GET /backups/export` (admin), `POST /backups/import` (admin).

### Suivi public

`GET /public/track/:token` — jeton de 32 caractères, réponse `no-store`,
limitée à la référence, au statut, aux étapes atteintes et aux coordonnées de
l’atelier. Aucune donnée client, note ou information financière.

## Sécurité

- Sessions opaques : jeton aléatoire 32 octets, stocké **haché** en base,
  cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production.
- Mots de passe : bcrypt (12 tours), politique 10 caractères minimum.
- CSRF : double soumission cookie + en-tête `x-csrf-token`, comparaison en
  temps constant, sur toutes les mutations.
- Origine : les mutations d’une origine étrangère renvoient 403.
- Rate limiting : 8 tentatives / 15 min par IP + verrouillage par compte.
- Validation Zod systématique, requêtes Prisma paramétrées (pas de SQL
  concaténé), Helmet avec CSP stricte.
- Journal d’audit : connexions, CRUD, statuts, devis, sauvegardes,
  utilisateurs.
- Aucun code de déverrouillage d’appareil ni mot de passe client n’est
  modélisé : ces données ne peuvent pas être saisies.

## Conventions

- Montants : entiers en centimes (`Int`), jamais de flottant monétaire.
- Dates : ISO 8601, stockées en `timestamptz` par PostgreSQL.
- Messages d’erreur en français, codes stables en anglais.
- Pas de secret dans le dépôt ; `.env` est ignoré.
