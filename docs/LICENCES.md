# Dépendances et licences open source

AtelierPro 2.0 n’utilise que des bibliothèques libres, sans composant
propriétaire ni service payant. Toutes sont compatibles avec une
redistribution du code source à un acquéreur.

## Frontend

| Paquet | Version | Licence | Usage |
| --- | --- | --- | --- |
| react / react-dom | 19 | MIT | interface |
| react-router-dom | 7 | MIT | navigation |
| motion | 12 | MIT | animations |
| vite | 6 | MIT | build (dev) |
| @vitejs/plugin-react | 4 | MIT | build (dev) |
| typescript | 5.7 | Apache-2.0 | compilation (dev) |

## Backend

| Paquet | Version | Licence | Usage |
| --- | --- | --- | --- |
| express | 4 | MIT | serveur HTTP |
| @prisma/client / prisma | 6 | Apache-2.0 | ORM et migrations |
| zod | 3 | MIT | validation |
| bcryptjs | 2 | MIT | hachage des mots de passe |
| helmet | 8 | MIT | en-têtes de sécurité |
| express-rate-limit | 7 | MIT | limitation des tentatives |
| cookie-parser | 1 | MIT | lecture des cookies |
| dotenv | 16 | BSD-2-Clause | chargement de `.env` |
| pdfkit | 0.15 | MIT | génération des PDF |

## Tests (développement uniquement)

| Paquet | Version | Licence |
| --- | --- | --- |
| vitest | 2 | MIT |
| supertest | 7 | MIT |
| embedded-postgres | 18.7 (bêta) | MIT |
| tsx | 4 | MIT |

## Systèmes requis (non redistribués)

- **PostgreSQL** — licence PostgreSQL (BSD-like), installé séparément.
- **Node.js** — MIT, installé séparément.
- **Docker** — Apache-2.0, installé séparément.

Les binaires PostgreSQL utilisés par `embedded-postgres` ne servent qu’aux
tests locaux ; ils ne sont pas embarqués dans l’image de production, qui
utilise l’image officielle `postgres:16-alpine`.

## Obligations

- Conserver les mentions de copyright des bibliothèques MIT/Apache-2.0 dans
  les sources redistribuées (les `node_modules` ne sont pas versionnés).
- Apache-2.0 (Prisma, TypeScript) : fournir la licence et signaler les
  modifications éventuelles du code Apache.
- Aucune bibliothèque en GPL/AGPL n’est utilisée : la redistribution sous
  licence commerciale reste possible.

## Vérification

```bash
npm ls --all --depth=0
npm --prefix server ls --all --depth=0
```

En cas d’ajout d’une dépendance, mettre à jour ce fichier et vérifier sa
licence avant intégration.
