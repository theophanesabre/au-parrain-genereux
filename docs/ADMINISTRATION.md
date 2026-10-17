# Administration Au Parrain Généreux

Cette branche prépare une administration orange `#FF6A00`. La publication doit être validée par le propriétaire. Le site conserve son audience publique ; l’administration est réservée aux utilisateurs autorisés.

## Activation après validation

1. Héberger avec le Worker Vinext, et non avec un export HTML statique. La configuration conserve le projet Sites existant et déclare `DB` (D1) et `BUCKET` (R2). Le flux de publication Sites provisionne ces ressources et applique les migrations `drizzle/` avant le Worker.
2. Pour la première activation, configurer côté serveur le SHA-256 d’un jeton aléatoire de 256 bits dans `ADMIN_SETUP_TOKEN_HASH` et son expiration ISO dans `ADMIN_SETUP_EXPIRES_AT`. Communiquer le lien `/admin/setup#<jeton>` uniquement au propriétaire. Après connexion ChatGPT, le bouton d’activation associe atomiquement son identifiant stable à la ligne unique `admin_access.slot=1`. Le lien expire et ne peut pas associer un second compte. Il importe également les 15 bonbons déjà publics, sans modifier les produits existants, avec stock et prix à renseigner. Les commandes refusent les produits sans prix positif.

   Autre possibilité : configurer côté serveur `ADMIN_USER_IDS` : identifiants stables ChatGPT du Site, séparés par des virgules. Une liste vide refuse tous les utilisateurs qui ne possèdent pas la ligne d’activation dans `admin_access`. Ne pas utiliser une adresse courriel comme preuve d’autorisation. L’administrateur du Site doit obtenir et vérifier les identifiants dans un contexte de confiance ; aucune attribution de rôle par le navigateur ou par premier visiteur.
3. Conserver le proxy d’authentification Sites : il doit supprimer/remplacer les en-têtes `oai-authenticated-*` entrants. Ne pas exposer directement ce Worker sur une autre origine acceptant des en-têtes d’identité arbitraires. En développement local, ces en-têtes simulés ne constituent pas une authentification de production.
4. Après application des migrations, importer explicitement `db/seed-catalog.sql` dans D1 si l’on souhaite reprendre les 15 bonbons existants. Cet import ne remplace pas les produits déjà présents. Les produits sont initialement en brouillon, avec prix et stocks à renseigner : les publier dans `/admin` après vérification. Avant la première activation, `/bonbons` conserve la collection statique si la base est vide. L’activation reprend les 15 bonbons en publication ; après activation, la collection suit les produits publiés, y compris une collection volontairement vide. Le script SQL manuel les crée en brouillon et reste une autre méthode d’import.
5. Tester avec un compte autorisé, un compte non autorisé et une session anonyme. Vérifier le catalogue, la lecture des pages, un téléversement et le cycle d’une commande. Valider sauvegardes, ressources et contenu avant déploiement.

Les secrets restent dans les paramètres serveur de Sites ou un fichier local ignoré `.dev.vars`. Ne jamais les enregistrer dans Git.

## Fonctionnement

- `/admin` : authentification ChatGPT puis autorisation par identifiant côté Worker, avant de servir l’interface. Toutes les routes de gestion `/admin/api/*` vérifient la même autorisation ; seule `/admin/api/claim` utilise l’identité signée et le jeton privé temporaire pour l’activation initiale. Les requêtes de gestion ; aucune donnée sensible n’est embarquée dans le HTML public. Réponses privées sans cache. L’origine de chaque écriture doit correspondre exactement à celle du site.
- Produits : création, modification, suppression, prix en centimes, stock entier, publication, image locale. Les prix initiaux à zéro signifient « à renseigner » ; ils ne permettent pas de créer une commande. Les versions empêchent l’écrasement silencieux des changements d’un autre administrateur.
- Pages : texte brut rendu avec échappement React, brouillon/publication, consultation à `/contenu/<référence>`. Les références réservées `accueil`, `maison` et `savoir-faire` remplacent aussi les pages existantes par un modèle texte conservant en-tête et pied de page. Dépublier ou supprimer le remplacement restaure la page de présentation originale. Les mises en page originales ne sont pas éditées bloc par bloc. Le menu existant n’est pas modifié automatiquement. Aucun HTML arbitraire exécuté.
- Images : téléversement PNG/JPEG/WebP de 5 Mo maximum, signatures contrôlées, clés aléatoires, stockage R2, description accessible. Les images `/media/<id>` sont publiques dès le téléversement : n’y envoyer aucun document privé. La suppression d’une image utilisée par un produit est refusée. Le stock et les commandes ne sont jamais placés dans le stockage navigateur.
- Commandes internes : création manuelle d’un brouillon, coordonnées et lignes produit avec instantané du nom/prix. Total calculé côté serveur. Confirmation → préparation → prête → terminée. Annulation possible avant « prête ». La confirmation réserve les stocks atomiquement en SQL ; le manque de stock annule toute la transaction. L’annulation d’une commande confirmée ou en préparation restitue les stocks une seule fois. Les produits réservés ne peuvent pas être supprimés.
- L’historique conserve l’acteur, l’action, la cible et l’heure des opérations, sans coordonnées client. Une tentative de modification avec version périmée peut être enregistrée même si la modification est refusée.

Aucun panier, paiement, webhook de paiement, courriel, expédition ou commande publique n’est activé. Le rapprochement paiement et les réservations expirantes ne font pas partie de cette préparation. Les listes sont limitées aux 500 éléments les plus récents (commandes/historique) ou premiers identifiants (contenus) ; prévoir une pagination pour un volume supérieur. Les coordonnées clients restent accessibles aux seuls administrateurs ; définir la durée de conservation avant utilisation réelle.

## Vérification et développement

```sh
npm ci
npm run test:admin
npx tsc --noEmit
npm run build
```

Les tests utilisent SQLite réel avec les migrations et une adaptation de l’interface D1 pour les routes HTTP. Ils couvrent autorisation, origine, données invalides, concurrence, produits/pages, images et commandes. Ils ne remplacent pas un essai de bout en bout du proxy d’identité et des ressources D1/R2 hébergées. Aucun navigateur n’était disponible pour une vérification visuelle.

Pour les migrations locales, utiliser la configuration produite par `npm run build` :

```sh
WRANGLER_LOG_PATH=.wrangler/migrations.log npx wrangler d1 migrations apply DB --local --config dist/server/wrangler.json
```

Le chemin des migrations de la configuration générée pointe vers le dossier `drizzle` de ce dépôt pour les vérifications locales. Aucun chemin local absolu ne doit être supposé sur un autre environnement. Pour une installation Cloudflare hors Sites, déclarer explicitement les bindings, `migrations_dir` et la protection d’identité équivalente avant toute publication. Ne pas utiliser `--remote` sans validation.


## Bonbons : découverte et vente au poids

La page `/bonbons` présente les recettes (nom, photo et description), avec un tarif commun de **106 €/kg**. Elle ne propose ni sélection de quantité, ni achat par recette. L’administration distingue « Découverte des bonbons » des produits vendus.

L’article de commande est uniquement **Bonbon**, référence `bonbon`. Son prix est saisi une seule fois en euros par kilo, et son stock disponible est saisi en **grammes**. Les quantités des commandes sont également exprimées en grammes : 250 g à 106 €/kg = 26,50 €. Les réservations et restitutions de stock utilisent le même poids entier. Le total de la ligne est arrondi au centime ; l’instantané de la commande conserve l’unité et le montant de la ligne. Les autres produits restent gérés à la pièce.

Les fiches dont la référence commence par `bonbon-` sont des recettes de découverte : elles n’ont aucun prix ni stock éditable, et l’API refuse de les ajouter à une commande. Les brouillons historiques contenant une recette doivent être recréés avec l’article commun avant confirmation. Les commandes déjà confirmées restent intactes.

Aucune migration ni suppression des fiches existantes n’est nécessaire. Si l’administration a déjà été activée, l’article commun apparaît à 106 €/kg avec un stock à zéro ; son premier enregistrement le crée en base. Pour une nouvelle activation, cet article est créé en même temps que les 15 recettes. Les prix/stocks historiques éventuels des fiches sont conservés en base mais ignorés par la nouvelle interface et les commandes. Le tarif public lit celui de l’article commun, avec 106 €/kg comme valeur initiale.
