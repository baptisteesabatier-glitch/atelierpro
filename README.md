# AtelierPro 2.0

Logiciel de gestion d’atelier de réparation : dossiers, clients, devis PDF,
suivi client public, tableau de bord et sauvegardes. Conçu pour être installé
sur **votre** serveur, sans abonnement ni service externe.

- **Front** : React 19 + TypeScript + Vite, design bleu nuit / blanc cassé /
  turquoise, animations Motion.
- **API** : Node.js + Express, sessions sécurisées, validation Zod, rôles et
  permissions côté serveur.
- **Base** : PostgreSQL + Prisma (migrations versionnées).
- **Documents** : devis, bons de dépôt et de restitution en PDF.
- **Déploiement** : Docker Compose ou installation manuelle.

Aucune clé API payante, aucune base de données propriétaire, aucun compte
chez un éditeur tiers.

---

## Démarrage rapide (Docker)

```bash
cp .env.example .env        # renseignez POSTGRES_PASSWORD et APP_ORIGIN
docker compose up -d --build

# premier administrateur (mot de passe généré et affiché une seule fois)
docker compose exec app node dist/scripts/create-admin.js \
  --email vous@atelier.fr --name "Prénom Nom"
```

Ouvrez `http://localhost:4000`, connectez-vous, puis changez le mot de passe
dans **Paramètres → Sécurité**.

Jeu de démonstration (base vide uniquement) :

```bash
docker compose exec app node dist/scripts/seed-demo.js --password "Demo2026!Demo"
```

Détails, reverse proxy et dépannage : [docs/INSTALLATION.md](./docs/INSTALLATION.md).

## Développement

```bash
npm run install:all     # front + serveur
cp server/.env.example server/.env   # DATABASE_URL locale
npm run db:migrate
npm run admin:create -- --email admin@local.test --name "Admin"

npm run dev:api         # API sur http://127.0.0.1:4000
npm run dev             # Vite sur http://127.0.0.1:5173 (proxy /api)
```

## Vérifications

```bash
npm run typecheck       # front + serveur
npm run build:all       # build Vite + compilation API
npm test                # 35 tests (PostgreSQL embarqué, aucun service requis)
```

La suite couvre l’authentification, le CSRF, les rôles et permissions, les
clients, les dossiers, les dix statuts, les notes, les devis (HT/TVA/TTC et
PDF), le suivi public, les sauvegardes et le tableau de bord.

## Fonctionnalités

| Domaine | Contenu |
| --- | --- |
| Dossiers | référence `AP-AAAA-NNNN`, appareil, panne, diagnostic, priorité, technicien, historique complet |
| Statuts | nouvel appareil, diagnostic, devis envoyé, attente d’accord, pièce commandée, en cours, terminé, prêt, restitué, annulé |
| Devis | lignes, quantités, TVA configurable, HT/TTC, numérotation, PDF |
| Documents | devis, bon de dépôt, bon de restitution |
| Clients | CRUD, recherche, historique, garde-fou de suppression |
| Suivi client | lien public à jeton aléatoire, sans donnée privée ni montant |
| Tableau de bord | encaissé réel vs encours estimé, délai moyen, flux 14 jours, performance techniciens |
| Utilisateurs | admin / technicien, permissions fines, désactivation, réinitialisation |
| Sauvegardes | export JSON avec empreinte SHA-256, restauration transactionnelle, CLI |
| Sécurité | sessions hachées, bcrypt, CSRF, rate limiting, audit, Helmet/CSP |

## Structure

```
src/            front React (pages, composants, client API)
server/         API Express, Prisma, scripts, tests
docker/         entrypoint conteneur
docs/           installation, sauvegarde, développeur, utilisateur, transfert, licences
```

## Documentation

- [Installation](./docs/INSTALLATION.md)
- [Sauvegarde et migration](./docs/SAUVEGARDE.md)
- [Documentation développeur et API](./docs/DEVELOPPEMENT.md)
- [Guide utilisateur](./docs/UTILISATEUR.md)
- [Transfert à un acquéreur](./docs/TRANSFERT.md)
- [Dépendances et licences](./docs/LICENCES.md)

## Sécurité et données

- Les mots de passe ne sont jamais stockés en clair (bcrypt, 12 tours).
- Les sessions sont des jetons opaques stockés hachés ; cookies `HttpOnly`,
  `SameSite=Lax`, `Secure` en production.
- Toutes les mutations exigent un jeton CSRF et une origine autorisée.
- Le logiciel ne modélise **aucun** champ pour les codes de déverrouillage
  d’appareil ou les mots de passe des clients.
- Les liens de suivi n’exposent ni coordonnées, ni notes internes, ni montants.

## Licence

Logiciel commercialisé sous licence perpétuelle non exclusive, avec remise du
code source. Voir [LICENSE](./LICENSE) et [docs/LICENCES.md](./docs/LICENCES.md)
pour les composants tiers.

Les données de démonstration sont fictives. Toute mise en production doit
utiliser des comptes et des secrets propres à l’exploitant.
