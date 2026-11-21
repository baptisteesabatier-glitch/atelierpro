# AtelierPro

Application de gestion d'atelier de réparation (téléphones, ordinateurs, tablettes, consoles) :
tableau de bord, dossiers de réparation, clients, paramètres.

**Démo en ligne :** https://atelierpro-onz0hg.freebuff.site

> Périmètre assumé : c'est aujourd'hui un **prototype d'interface fonctionnel côté client**,
> pas un SaaS multi-utilisateurs. La section « Ce qui n'existe pas encore » est volontairement
> explicite pour éviter les malentendus lors d'une revue ou d'une mise en vente.

## Stack

- React 19 + TypeScript (strict), Vite 6
- React Router 7 (SPA, réécriture serveur)
- Motion (ex-Framer Motion) pour les ressorts et les transitions
- CSS écrit à la main (aucun framework UI), système de design dans `src/styles.css`
- Aucune dépendance payante, aucun service tiers, aucune police distante

## Démarrer

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # tsc --noEmit && vite build  → dist/
npm run preview
```

## Structure

```
src/
  App.tsx              routes, transitions de page, raccourci ⌘K
  styles.css           tokens (couleurs, matières, typographie) + composants
  lib/store.tsx        modèle de données, actions, persistance localStorage
  lib/format.ts        formatage fr-FR (montants, dates, relatifs)
  components/          Sidebar, TopBar, MobileNav, CommandPalette, Toaster,
                       ui.tsx (boutons, panneaux, champs, nombres animés),
                       RepairDetail (panneau latéral), NewRepairDialog
  pages/               Dashboard, Repairs, Clients, Settings
site/worker.js         worker statique (sert dist/)
sites.manifest.json    manifeste de déploiement
vercel.json            configuration d'import Vercel (SPA)
```

## Ce qui fonctionne réellement

- **Tableau de bord** : CA du mois, dossiers ouverts, délai moyen, objectif — calculés depuis les dossiers (aucune valeur codée en dur dans l'UI). Graphique 14 jours, répartition par statut, priorités, activité récente.
- **Réparations** : recherche plein texte, filtres par statut, tri (récent / priorité / devis), tableau responsive, fiche latérale.
- **Suivi d'un dossier** : avancement en 6 étapes cliquables (réception → diagnostic → pièces → réparation → prête → livrée), journal de notes horodatées.
- **Création d'un dossier** : client existant ou nouveau, catégorie, priorité, devis, validation en ligne.
- **Clients** : répertoire, recherche, fiche avec historique et total facturé.
- **Paramètres** : identité de l'atelier, objectif mensuel, export JSON, réinitialisation confirmée.
- **Persistance** : chaque modification est écrite dans `localStorage` et survit à l'actualisation.
- **Accessibilité** : navigation clavier, `aria-*` sur les contrôles, respect de `prefers-reduced-motion`, `prefers-reduced-transparency` et `prefers-contrast`.

## Ce qui n'existe pas encore

Ces points figurent souvent dans les grilles d'évaluation d'un logiciel de gestion d'atelier ; ils
ne sont **pas implémentés** ici et demanderaient un backend :

- **Authentification, comptes, rôles et permissions** — aucun écran de connexion.
- **Base de données partagée** — les données sont locales au navigateur, donc un dossier créé sur un poste n'apparaît pas sur un autre.
- **Devis PDF / facturation** — seul un montant estimé est stocké ; aucun document n'est généré, aucun calcul de TVA.
- **Espace client sécurisé** — le suivi d'une réparation n'est pas exposé au client final.
- **Notifications e-mail / SMS**, impression, sauvegarde serveur, imports.
- **Tests automatisés** — aucun test n'est présent ; la validation repose sur le build TypeScript et des vérifications manuelles.
- **Écrans de connexion et page de vente** — hors périmètre de ce dépôt.

## Notes techniques

- Les données de démonstration sont générées dans `src/lib/store.tsx` (`createSeed`), avec des dates calculées relativement à la date du jour.
- La clé de stockage est `atelierpro.state.v1` ; la vider dans les outils du navigateur restaure le jeu de démonstration.
- Le routage SPA nécessite une réécriture vers `index.html` (fournie dans `vercel.json` et via `"spa": true` dans `sites.manifest.json`).
- `src/styles.css` centralise le système de design : aucune valeur de couleur ou d'espacement n'est codée en dur dans les composants.

## Licence du skill embarqué

`.agents/skills/apple-design/` contient le skill *apple-design* d'Emil Kowalski
(https://github.com/emilkowalski/skills), reproduit tel quel, licence MIT incluse dans le dossier.
