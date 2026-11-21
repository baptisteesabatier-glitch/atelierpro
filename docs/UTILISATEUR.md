# Guide utilisateur

## Se connecter

Ouvrez l’adresse fournie par votre administrateur, puis saisissez votre
e-mail et votre mot de passe. Après 8 tentatives infructueuses, l’accès est
temporairement bloqué (15 minutes).

Un lien **Se déconnecter** est disponible en bas de la barre latérale.

## Tableau de bord

- **Encaissé ce mois** : argent réellement encaissé (paiements enregistrés).
- **En cours** : montant estimé des dossiers ouverts — ce n’est pas du
  chiffre d’affaires.
- **En atelier** : dossiers non restitués, urgences comprises.
- **Délai moyen** : temps entre réception et restitution.
- **Objectif du mois** : progression de l’encaissement par rapport à la cible
  définie dans les paramètres.
- **Flux de l’atelier** : entrées et restitutions sur 14 jours.
- **Performance des techniciens** : dossiers actifs, restitués et montants
  encaissés rattachés.

## Dossiers de réparation

### Créer un dossier

**Nouvelle réparation** → choisissez un client existant ou créez-le à la
volée, renseignez marque, modèle, catégorie, numéro de série (facultatif),
panne signalée, priorité et montant estimé. Une référence `AP-AAAA-NNNN` et
un lien de suivi sont générés automatiquement.

### Les dix statuts

| Statut | Signification |
| --- | --- |
| Nouvel appareil | réceptionné, non pris en charge |
| Diagnostic | analyse technique |
| Devis envoyé | proposition transmise |
| En attente d’accord | réponse du client attendue |
| Pièce commandée | intervention suspendue |
| Réparation en cours | sur l’établi |
| Réparation terminée | contrôles qualité |
| Prêt à récupérer | le client peut venir |
| Restitué | dossier clos |
| Annulé | abandon ou refus |

Les boutons d’étape proposent uniquement les transitions autorisées.
Un administrateur peut forcer un statut en cas d’erreur de saisie.

### Diagnostic, notes, historique

Le diagnostic et le montant se modifient directement dans la fiche.
Les **notes internes** ne sont jamais visibles par le client.
L’**historique** conserve chaque changement avec son auteur et son horodatage.

### Documents

- **Bon de dépôt** : à imprimer à la réception.
- **Bon de restitution** : à signer au retrait.
- **Devis PDF** : lignes, quantités, TVA, total HT et TTC, identité et logo.

### Encaissement (administrateur)

Saisissez le montant reçu puis **Encaisser**. Ce montant alimente le chiffre
d’affaires réel. **Annuler** corrige une erreur de saisie.

## Devis

**Créer un devis** : ajoutez des lignes (main d’œuvre, pièce, fourniture),
quantités et prix unitaires. La TVA est préremplie depuis les paramètres.
Les totaux se calculent en direct.

Cycle : brouillon → envoyé → accepté (ou refusé/expiré). Envoyer un devis fait
passer le dossier en « Devis envoyé » ; l’accepter le passe en « Réparation
en cours ». Un devis accepté ne peut plus être supprimé.

## Suivi client

Chaque dossier possède un lien public :

```
https://votre-atelier.fr/suivi/<jeton>
```

Copiez-le depuis la fiche (**Suivi client → Copier**) et envoyez-le au
client. La page affiche la référence, l’appareil, l’avancement étape par
étape et les coordonnées de l’atelier. Elle n’expose ni coordonnées du
client, ni notes internes, ni montants.

## Clients

Recherche par nom, téléphone, e-mail ou ville. La fiche affiche l’historique
des interventions et le total encaissé. La suppression est refusée tant que
des dossiers sont rattachés : annulez ou réaffectez-les d’abord.

## Utilisateurs (administrateur)

- Créer un technicien ou un administrateur.
- Ajuster les permissions d’un technicien :
  modifier les dossiers, changer les statuts, créer des devis, gérer les
  clients.
- Réinitialiser un mot de passe (les sessions du compte sont fermées).
- Désactiver un compte sans supprimer son historique.
- Le dernier administrateur actif ne peut pas être désactivé.

## Paramètres

- **Identité** : nom commercial, adresse, téléphone, e-mail, SIRET, TVA.
  Ces mentions figurent sur les documents.
- **Documents** : logo (PNG/JPEG/WebP, 300 Ko max), préfixe et validité des
  devis.
- **Objectif mensuel** : cible d’encaissement du tableau de bord.
- **Sécurité** : changement de mot de passe (déconnecte les autres sessions).
- **Sauvegarde** : export et restauration — voir
  [SAUVEGARDE.md](./SAUVEGARDE.md).

> Les champs SIRET, TVA et mentions de pied de page facilitent l’établissement
> de documents commerciaux français. Ils ne garantissent pas à eux seuls la
> conformité juridique : faites valider vos modèles par un professionnel.

## Raccourcis

- `Ctrl/⌘ + K` : recherche globale (dossiers et clients).
- `Échap` : fermer une fenêtre ou un panneau latéral.
