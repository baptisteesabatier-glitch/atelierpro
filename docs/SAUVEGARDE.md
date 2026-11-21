# Sauvegarde, restauration et migration

## Contenu d’une sauvegarde

Un fichier JSON unique, lisible et vérifiable :

```json
{
  "format": "atelierpro-backup",
  "version": "2.0.0",
  "exportedAt": "2026-11-21T09:12:00.000Z",
  "checksum": "<sha256 du payload>",
  "payload": {
    "settings": {},
    "clients": [],
    "repairs": [],
    "quotes": [],
    "notes": [],
    "events": []
  }
}
```

- **Les comptes utilisateurs ne sont pas exportés.** Ils restent liés à
  l’installation : une sauvegarde transmise à un tiers ne contient aucun
  condensat de mot de passe.
- Les identifiants internes et les dates sont conservés : l’historique est
  restitué à l’identique.
- Le logo (data URL) est inclus dans `settings`.

Le `checksum` est le SHA-256 de la sérialisation du `payload`. Toute
modification du fichier est détectée et la restauration est refusée.

## Exporter

### Depuis l’interface

**Paramètres → Sauvegarde → Exporter** télécharge un fichier
`atelierpro-backup-AAAA-MM-JJ.json`.

### En ligne de commande

```bash
npm run backup -- --out sauvegardes/atelierpro-2026-11-21.json
```

Avec Docker :

```bash
docker compose exec app node dist/scripts/backup.js --out /app/backups/atelierpro.json
docker compose cp app:/app/backups/atelierpro.json ./
```

### Image PostgreSQL complète (complément recommandé)

Le JSON couvre les données métier. Pour inclure aussi les comptes, sessions
et journaux d’audit :

```bash
docker compose exec db pg_dump -U atelierpro -Fc atelierpro > atelierpro.dump
```

Restauration :

```bash
docker compose exec -T db pg_restore -U atelierpro -d atelierpro --clean < atelierpro.dump
```

## Restaurer

La restauration **remplace** toutes les données métier. Elle est refusée si :

- le format ou la version du fichier diffèrent ;
- l’empreinte ne correspond pas ;
- une écriture échoue : la transaction est annulée et la base reste intacte.

### Interface

**Paramètres → Sauvegarde → Restaurer…**, sélectionnez le fichier, puis
saisissez `REPLACE` pour confirmer.

### Ligne de commande

```bash
npm run restore -- --file sauvegardes/atelierpro-2026-11-21.json --confirm REPLACE
```

Avec Docker :

```bash
docker compose cp ./atelierpro.json app:/app/backups/restore.json
docker compose exec app node dist/scripts/restore.js \
  --file /app/backups/restore.json --confirm REPLACE
```

Sans l’option de confirmation, la commande s’arrête avant toute écriture.

## Bonnes pratiques

1. Sauvegarder **avant** chaque mise à jour et avant toute restauration.
2. Conserver les fichiers hors du serveur (poste local chiffré, NAS).
3. Tester périodiquement une restauration sur une base de test.
4. Rotation : 7 quotidiennes, 4 hebdomadaires, 12 mensuelles.
5. Les fichiers contiennent des données personnelles : les chiffrer et
   limiter leur accès.

Exemple de chiffrement :

```bash
age -p -o atelierpro-2026-11-21.json.age atelierpro-2026-11-21.json
```

## Migration depuis AtelierPro 1.0 (localStorage)

La version 1.0 conservait son état dans le navigateur, sous la clé
`atelierpro.state.v1`. Les données peuvent être reprises :

1. Sur l’ancienne installation, dans la console du navigateur :

   ```js
   copy(localStorage.getItem('atelierpro.state.v1'))
   ```

2. Coller le résultat dans un fichier `v1.json`.
3. Convertir vers le format 2.0 avec un script de conversion, puis restaurer
   le fichier obtenu avec la commande `npm run restore`.

Projection appliquée : les anciens statuts (`intake`, `diagnostic`, `parts`,
`repair`, `ready`, `delivered`) correspondent aux dix statuts 2.0, les
montants en euros deviennent des centimes entiers, et un jeton de suivi est
généré pour chaque dossier. Les clients sans e-mail conservent un champ vide
au lieu d’une valeur inventée.

## Ce qui n’est jamais sauvegardé

- mots de passe en clair (ils n’existent nulle part) ;
- codes de déverrouillage d’appareil ou identifiants appartenant aux clients :
  ces champs n’existent pas dans le modèle de données ;
- jetons de session actifs (les sessions sont recréées à la connexion).
