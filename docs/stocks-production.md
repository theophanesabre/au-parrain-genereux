# Stocks & Production APG

## Architecture et périmètre

L’application reste le site existant : React 19/Vinext, Worker Cloudflare, SQLite/D1, accès par identité ChatGPT injectée par la plateforme. Le module est exposé par `admin/handler.mjs` à `/admin/stocks`, embarqué dans le menu existant `/admin/puck?section=inventory`. Aucun service ni système de connexion supplémentaire, aucune dépendance ajoutée.

Le catalogue e-commerce `products.stock` est réservé par les commandes et Stripe. Il ne peut pas représenter le stock du laboratoire sans modifier ce fonctionnement. Les tables `sp_*` sont donc volontairement indépendantes : ni import, ni liaison de soldes, ni déduction par vente, ni consommation automatique de recette. Les références du laboratoire sont créées par l’administrateur ; la migration ne crée aucun exemple et ne touche aucune donnée existante.

## Utilisation sur tablette

L’accueil regroupe deux onglets (Matières premières / Produits finis), les cartes de stocks disponibles et un formulaire immédiat : produit, Entrée (+) / Sortie (−), quantité, validation. Toucher une carte sélectionne directement le produit. Les opérations indisponibles pour le profil restent désactivées ; les autorisations sont également vérifiées côté serveur. Les écrans secondaires sont repliés dans « Gestion ». Le stock disponible et l’unité restent affichés. Les champs lot, fournisseur, date et commentaire sont secondaires et facultatifs. Une confirmation annonce le nouveau solde. Les unités se choisissent par référence : kg, g, pièce, sac, carton, litre. Il n’y a aucune conversion automatique entre unités. Une référence commence à zéro : saisir son stock initial comme une entrée, avec le commentaire « Stock initial ».

Cibles tactiles de 52 px minimum, actions de 150 px ou plus, grille à deux colonnes, formulaires en une colonne aux petites largeurs, tableaux défilants, navigation clavier et région d’annonce. La largeur s’adapte aux orientations tablette et téléphone. Aucune installation nécessaire.

## Données et garanties

- `sp_references` : identifiant UUID, nom, catégorie, unité, seuil optionnel, statut, version optimiste, création.
- `sp_balances` : solde déclaré en entier à l’échelle 1000. Ainsi 5,125 kg = 5125 unités internes. Au plus trois décimales ; pièces/sacs/cartons entiers. Jamais de flottants accumulés.
- `sp_movements` : journal immuable, clé de validation unique, instant UTC, date déclarée distincte, auteur/nom/profil, référence/nom/unité au moment de l’opération, quantité et soldes avant/après, type, sens, lot, fournisseur, commentaire et mouvement compensé.
- `sp_lots` : identité du lot par référence, fournisseur conservé ; les lignes restent présentes après épuisement. Numéro de fabrication = lot d’un produit fini. Un prélèvement peut identifier un lot existant ; aucun lot n’est créé par une sortie.
- `sp_users` : profils employés et activation, utilisant la même identité que le site.
- `sp_access_audit` : journal immuable des changements de références et d’accès.

L’insertion du mouvement lit le solde dans la transaction D1 ; un trigger vérifie le mouvement et actualise le solde. Les contrôles empêchent les stocks négatifs, les quantités invalides et les changements d’unité/catégorie après le premier mouvement. Toute mise à jour du solde doit correspondre au total du journal. Un batch D1 rend atomiques la création éventuelle du lot et le mouvement. Des index couvrent référence, date, auteur, type et lot.

La clé de validation est réutilisée pour une relance réseau et le serveur compare le contenu normalisé ainsi que l’auteur. Un double clic ne crée donc pas deux mouvements. Dans la session du navigateur, une validation sans réponse est conservée pour pouvoir la reprendre avec la même clé ; un refus explicite permet de corriger la saisie. Une incertitude réseau 5xx reste à résoudre avant une nouvelle opération. Les données métier persistantes sont exclusivement dans D1.

Les corrections sont réservées aux administrateurs, motivées, et ajoutent un inverse complet une seule fois, lié à l’original. Pour changer la quantité, annuler puis saisir la bonne opération. Une compensation ne peut pas rendre le solde négatif : corriger d’abord les mouvements dépendants si nécessaire. Les références s’archivent ; les mouvements et lots ne se suppriment ni ne s’éditent.

## Permissions

| Profil | Opérations | Consultation |
| --- | --- | --- |
| Administrateur existant | Tout, références, corrections, accès | Tout, historique, CSV, statistiques |
| Laboratoire | Entrées/sorties matières, entrées production | Références et lots matières/produits finis, production |
| Boutique | Sorties production | Références et lots des seuls produits finis, production |

Les administrateurs restent ceux de `ADMIN_USER_IDS` et de l’activation existante `admin_access`. Le module ne donne pas à un employé l’accès à Stripe, aux commandes, aux photos ou aux articles e-commerce. Un administrateur peut créer/désactiver les accès Laboratoire/Boutique via « Équipe ». Chaque employé se connecte avec son propre compte ChatGPT ; sans accès, `/admin/stocks` affiche son propre identifiant dans le message de refus afin qu’il puisse le transmettre au responsable. Les administrateurs sont gérés par le mécanisme existant, pas par une nouvelle liste.

Les routes vérifient le profil côté serveur à chaque requête et les écritures vérifient l’origine. Les triggers appliquent aussi les restrictions de mouvement. Les pages et API sont non mises en cache, la page utilise une CSP avec nonce et accepte uniquement l’intégration dans le même site.

## Routes et vues

Toutes les routes API commencent par `/admin/api/inventory` :

- `GET /me`, `GET/POST /references`, `PUT /references/:id`.
- `GET /lots?reference=UUID`, `POST /movements` (ou `correction_of` avec motif).
- `GET /movements` et `/export` : administrateur, filtres recherche/référence/catégorie/type/auteur/période. Les dates de filtre correspondent à l’enregistrement UTC ; la date déclarée de fabrication reste affichée séparément.
- `GET /dashboard` : quantités disponibles et seuils actuels, mouvements par période et par unité, production nette des annulations, derniers mouvements.
- `GET /production` : références/lots actifs dans la période sélectionnée, dates de fabrication, entrées nettes, prélèvements nets, solde déclaré sur tout l’historique du groupe.
- `GET/PUT /users` : administrateur uniquement.

Le catalogue est paginé par 100 références, l’historique par 50 mouvements. L’export CSV exporte toute la sélection jusqu’à 10 000 mouvements ; au-delà, il refuse et demande de réduire la période, sans tronquer silencieusement. Les cellules textuelles sont protégées contre les formules de tableur. La vue production annonce une limite de 200 groupes et demande d’affiner la recherche au-delà. La liste de suggestions de lots montre les 200 derniers ; on peut saisir le code exact d’un lot plus ancien, toujours conservé dans le journal et exportable.

Les quantités de kg, g et pièces ne sont jamais additionnées ensemble. Le total disponible du laboratoire n’est pas le stock de la boutique. Les soldes par lot sont des soldes déclarés : si des mouvements ont été saisis sans lot, leur ventilation doit être complétée par correction ; elle n’est pas devinée automatiquement. Un solde nul après ouverture d’un sac ne signifie pas que ses ingrédients ont physiquement disparu et ne supprime jamais sa traçabilité.

Ce module conserve les identités de lots mais n’établit pas automatiquement la généalogie entre lots d’ingrédients et fabrication. Les éventuels documents de traçabilité sanitaire, quantités physiques restantes et procédures de rappel restent à tenir selon le fonctionnement de l’atelier.

## Migration et mise en service — sans déploiement automatique

Appliquer `drizzle/0033_stocks_production.sql` via le système de migrations D1 existant, une fois seulement, après validation du propriétaire. La migration est enregistrée dans `drizzle/meta/_journal.json`. Ne pas lancer une génération Drizzle pour recréer ces triggers : ils sont écrits explicitement en SQL. Les modèles déclaratifs sont dans `db/inventory.ts`, réexportés par le schéma existant.

1. Sauvegarder la base avec l’outil de sauvegarde existant.
2. Appliquer la migration additive et le code ensemble sur un environnement validé.
3. Vérifier l’accès administrateur, créer les références réelles, saisir les soldes initiaux par des entrées.
4. Ajouter les accès du personnel et vérifier les quatre opérations sur les tablettes réelles.

En cas de retour au code précédent, conserver les tables et leur journal. Le script facultatif `docs/migrations/0033_rollback_empty.sql` n’autorise une suppression qu’avant toute utilisation et refuse s’il existe des références, mouvements ou accès. Le registre de migration relève de l’outil de déploiement. Aucun rollback destructif n’est proposé sur un journal utilisé.

## Vérifications

`npm run test:inventory` couvre les quatre opérations demandées, les décimales, les erreurs et refus atomiques, l’idempotence, les profils/CSRF/révocation, les corrections immuables, les alertes/archives/versions, les filtres/CSV, la persistance après fermeture SQLite et deux écritures réellement simultanées dans un fichier SQLite partagé. Il vérifie aussi que les produits e-commerce et commandes ne changent pas, la CSP, le viewport et la syntaxe du client.

Les tests SQLite reproduisent les transactions et triggers utilisés sur D1, mais ne remplacent pas une recette D1 distante après migration. Le contrôle tactile réel (Safari iPad/Chrome Android, orientation, clavier virtuel) reste à faire avant validation de production : aucun outil de navigateur n’est disponible dans cette session. Aucun test de paiement réel ni aucune migration distante n’est exécuté.

## Protection des informations sensibles

Les accès Stripe, réglages de paiement, commandes/données clients, journal général du site et médiathèque restent réservés au propriétaire et aux administrateurs responsables déjà explicitement autorisés. Le profil de production ne peut pas s’élever en administrateur, même par appel direct à l’API ou envoi d’un faux champ/en-tête de rôle. Le quatorzième test du module vérifie le refus avant toute lecture de données sensibles. La consultation de configuration Stripe ne lit que les colonnes non secrètes ; les clés API et webhook restent chiffrées côté serveur et ne sont pas renvoyées dans l’interface. Les accès au tableau de bord Stripe lui-même se gèrent également dans les permissions de l’équipe du compte Stripe ; le module APG n’accorde aucun accès à ce compte externe.

## Écran quotidien simplifié

À la demande du propriétaire, l’interface du programme ne présente plus que Stocks : catégories, cartes, mouvement et ajout/modification/retrait d’une référence. Les menus secondaires sont retirés de cet écran. Le journal durable et les services protégés restent conservés, sans suppression de données. Le retrait d’une référence est un archivage explicite avec confirmation. Le contrôle de création accepte les compteurs D1 incluant les écritures des triggers, tout en refusant toujours une mise à jour de version périmée.

## Séparation Laboratoire / Magasin / Vente en ligne

L’écran Stocks présente trois emplacements, sans rétablir les anciens menus. Les matières premières et produits fabriqués restent des quantités déclarées **au laboratoire**. Les produits en magasin utilisent un journal et un solde dédiés (`sp_shop_movements`, `sp_shop_balances`). Les quantités web restent les disponibilités de `products.stock`, dont le fonctionnement de réservation/paiement est préservé.

- Une sortie de produit fini effectuée par le nouvel écran est explicitement un **transfert vers le magasin** : la même quantité quitte le laboratoire et entre au magasin, atomiquement. Une ancienne sortie sans destination n’est jamais rétroactivement transformée en stock magasin. La destination est conservée dans le journal ; une compensation inverse les deux côtés ou échoue entièrement si les articles ne sont plus disponibles au magasin.
- Le stock magasin antérieur est inconnu : l’écran affiche **À compter** jusqu’au premier mouvement, et non une quantité physique inventée. Faire une entrée initiale comptée, uniquement pour les articles réellement présents au magasin, hors réserve web. Les entrées suivantes sont des ajouts. Une sortie magasin représente une vente ou un prélèvement déclaré ; aucune intégration automatique à une caisse n’est créée.
- **Mettre de côté pour le web** retire du magasin et augmente la disponibilité web, dans la même transaction. Le retour web vers le magasin fait l’inverse et refuse de reprendre une quantité réservée ou déjà vendue, puisque seul `products.stock` disponible est utilisable.
- Les transferts web exigent une référence de produit fini stockée à la **pièce**, la sélection explicite de l’article web correspondant et la confirmation qu’il s’agit exactement du même article. Les libellés et quantités sont rappelés avant validation. Aucune conversion poids/coffret ni association de recette n’est déduite. Créer une référence « Coffret X » à la pièce si la production en vrac est stockée en kg ; son conditionnement reste une déclaration distincte.
- La réserve web doit être **physiquement mise à part** dans l’entreprise. Le logiciel ne peut ni déplacer les articles lui-même ni détecter un article vendu en caisse sans déclaration. Ne jamais présenter la disponibilité web comme l’inventaire physique complet : elle est déjà diminuée des réservations et ventes traitées par le système existant. Les commandes payées non encore préparées restent à gérer dans le module Commandes.

Les mouvements magasin sont immuables, idempotents et contrôlés contre les sorties excessives. Les responsables peuvent demander un mouvement compensatoire via `POST /admin/api/inventory/shop-movements` avec `correction_of` et un motif ; l’original reste conservé. Les transferts de laboratoire sont corrigés par le journal laboratoire. Les archives et noms d’articles sont préservés dans les journaux.

Les employés autorisés peuvent consulter les trois vues. Le profil Boutique et les responsables peuvent enregistrer les mouvements magasin ; les autorisations laboratoire restent inchangées. La vue web sélectionne uniquement `id`, `name`, `stock`, `published` : aucun prix, client, commande ou paramètre Stripe n’est exposé. Gérer une quantité d’article ne donne aucun accès à la configuration des paiements.

Migration additive **0034_stock_locations.sql**, à appliquer avec le code. Elle ne modifie aucun stock e-commerce et ne déplace aucun stock antérieur. Les seules modifications ultérieures de stock web sont les transferts explicitement validés par les utilisateurs. Un retour au code précédent doit conserver les nouveaux journaux ; le rollback vide de 0033 n’est pas prévu après 0034.

Tests supplémentaires : transfert et compensation laboratoire↔magasin, non-reprise des sorties anciennes, mise de côté web et retour, refus des conversions kg/coffret, refus des quantités réservées, idempotence, correction magasin et deux allocations simultanées ne pouvant consommer deux fois les mêmes unités. Les tests existants de paiement continuent de vérifier les réservations Stripe indépendamment.
