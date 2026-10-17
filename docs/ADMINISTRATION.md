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
- Pages : les quatre pages existantes (Accueil, Maison, Savoir-faire, Bonbons) sont visibles dès l’ouverture, même sans enregistrement en base. Modifier leurs champs conserve la mise en page ; les coordonnées, les horaires et le pied de page se règlent dans Accueil. Les nouvelles pages libres utilisent du texte brut à `/contenu/<référence>`. Les textes sont rendus avec échappement React, sans HTML arbitraire exécuté. Les anciennes substitutions en texte brut restent compatibles jusqu’à leur réenregistrement dans le nouveau modèle.
- Images : 21 images utilisées par le site sont visibles sans import ni copie des fichiers statiques. « Remplacer » téléverse une image PNG/JPEG/WebP de 5 Mo maximum et enregistre une correspondance D1 vers R2 ; les composants du site lisent cette correspondance. L’original reste intact et peut être restauré. Une image téléversée encore utilisée par un produit ou un remplacement ne peut pas être supprimée. Les descriptions alternatives sont utilisées sur le site. Les téléversements sous `/media/<id>` sont publics : ne pas y envoyer de documents privés.
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


## Ancien fonctionnement au poids (retiré)

La page `/bonbons` présente les recettes (nom, photo et description), avec un tarif commun de **106 €/kg**. Elle ne propose ni sélection de quantité, ni achat par recette. L’administration distingue « Découverte des bonbons » des produits vendus.

L’article de commande est uniquement **Bonbon**, référence `bonbon`. Son prix est saisi une seule fois en euros par kilo, et son stock disponible est saisi en **grammes**. Les quantités des commandes sont également exprimées en grammes : 250 g à 106 €/kg = 26,50 €. Les réservations et restitutions de stock utilisent le même poids entier. Le total de la ligne est arrondi au centime ; l’instantané de la commande conserve l’unité et le montant de la ligne. Les autres produits restent gérés à la pièce.

Les fiches dont la référence commence par `bonbon-` sont des recettes de découverte : elles n’ont aucun prix ni stock éditable, et l’API refuse de les ajouter à une commande. Les brouillons historiques contenant une recette doivent être recréés avec l’article commun avant confirmation. Les commandes déjà confirmées restent intactes.

Aucune migration ni suppression des fiches existantes n’est nécessaire. Si l’administration a déjà été activée, l’article commun apparaît à 106 €/kg avec un stock à zéro ; son premier enregistrement le crée en base. Pour une nouvelle activation, cet article est créé en même temps que les 15 recettes. Les prix/stocks historiques éventuels des fiches sont conservés en base mais ignorés par la nouvelle interface et les commandes. Le tarif public lit celui de l’article commun, avec 106 €/kg comme valeur initiale.


## Pages et images existantes

Les listes vides ne sont plus nécessaires à l’initialisation : les contenus d’origine servent de valeurs par défaut. Une simple lecture ne crée ni page ni image en base. Le premier enregistrement d’une page est atomique et respecte les versions concurrentes. Le bouton de restauration supprime uniquement la surcharge enregistrée et réaffiche les valeurs d’origine, sans supprimer la page publique.

Les pages existantes utilisent le format interne `site-fields-v1` dans la colonne `pages.body`. L’API valide les noms de champs, tailles, courriel et téléphone. Les autres pages restent en texte brut. `/contenu/accueil`, `/contenu/maison`, `/contenu/savoir-faire` et `/contenu/bonbons` redirigent vers leur URL principale.

La migration `0003_slow_star_brand.sql` crée uniquement `image_replacements`. Aucun fichier ni contenu existant n’est supprimé. Appliquer cette migration avant de publier le Worker utilisant les remplacements. L’accès aux enregistrements de page et d’image est mutualisé par requête avec `React.cache`, sans cache global de données personnelles.

Vérification : 13 tests couvrent les opérations métier, les listes de contenus d’origine sur base vide, l’édition/restauration, le remplacement/restauration d’images, et l’exposition des boutons d’édition dans le script de l’interface. Le test d’interface simule le DOM ; il ne constitue pas une vérification visuelle dans un navigateur.

## Nouveautés et mises à la une

L’onglet **Nouveautés** gère deux emplacements : le grand bandeau de l’accueil et les cartes qui défilent horizontalement. Pour chaque élément, choisir une image dans la bibliothèque, renseigner sa description alternative, les textes, le bouton et une destination interne (par exemple `/bonbons`). Le cadrage « contenir » conserve le produit entier ; « couvrir » remplit le visuel. Un numéro de position plus petit apparaît en premier. La case de publication permet de préparer un brouillon.

Deux mises à la une et trois découvertes reprennent les photographies et recettes existantes, sans annoncer de nouveaux produits fictifs. Ces exemples sont virtuels : leur lecture ne remplit pas la base. Ils peuvent être modifiés ou masqués ; un exemple masqué ne réapparaît pas au prochain chargement. Les titres de la section se modifient dans **Pages → Accueil**. Une image utilisée par une nouveauté, même en brouillon, est protégée contre la suppression.

Le bandeau avance toutes les sept secondes, avec commandes précédent/suivant, indicateurs et pause. Le focus, une navigation manuelle ou un onglet masqué suspendent la lecture ; la préférence de réduction des animations désactive l’avance automatique. Les cartes se parcourent par glissement, défilement natif ou boutons. Aucun contenu d’une autre enseigne n’est repris.

La migration `0004_typical_lady_deathstrike.sql` crée uniquement la table `highlights`. Elle doit être appliquée avant la publication du Worker. Les écritures conservent les contrôles d’identité, d’origine et de version de l’administration. Les liens sont limités au site et les textes sont échappés.

Vérification : 17 tests passent, dont la gestion des nouveautés, les destinations interdites, les images référencées, l’interface d’administration et le rendu serveur des carrousels. Le rendu serveur ne vérifie pas les gestes ni l’apparence dans un navigateur ; un contrôle visuel mobile reste à faire avant publication.

## Boutique et panier

`/boutique` présente uniquement les produits de vente publiés dont le prix est positif. Les recettes `bonbon-*` restent des découvertes sur `/bonbons`, avec un lien vers l’assortiment. Pour proposer l’assortiment, enregistrer et publier l’article **Bonbon** dans Produits et stocks et renseigner son stock en grammes. Un stock nul affiche une indisponibilité ; une base sans produit publié affiche un état d’attente.

Le visiteur ajoute un poids entier en grammes pour Bonbon (raccourcis 100, 250, 500 et 1 000 g) ou une quantité entière pour les autres produits. `/panier` permet de modifier les quantités, retirer un article ou vider la sélection. Les identifiants et quantités seuls sont conservés dans le navigateur sous `apg-panier-v1` ; les prix ne sont jamais repris du stockage local. Le panier se synchronise entre onglets, sans données personnelles ni création de compte. Un stockage indisponible est signalé.

`POST /api/panier` recalcule les montants à partir de D1 et contrôle publication et stock. Une sélection devenue indisponible reste visible pour être corrigée. Les réponses ne sont pas mises en cache et les requêtes d’une autre origine sont refusées. Cette route ne réserve pas de stock et ne crée aucune commande.

Retrait et expédition peuvent être choisis dans le récapitulatif. Le paiement reste explicitement indisponible jusqu’au raccordement du prestataire et à la configuration des frais/destinations. Aucun frais d’expédition fictif, aucune commande payée et aucun webhook ne sont créés par ce panier. La future étape de paiement devra revérifier prix et stocks et ne faire apparaître la commande dans l’administration qu’après confirmation vérifiée et idempotente du paiement.

Validation : quatre tests supplémentaires (`npm run test:cart`) couvrent la restauration, les quantités, les calculs au poids, les changements de prix/stock, la lecture SQLite et les erreurs HTTP. Les 17 tests de l’administration, TypeScript et la compilation passent. Aucun navigateur disponible pour tester visuellement les gestes et la persistance réelle. Aucune nouvelle migration.

## Présentation de l’administration

L’interface reprend les fonds crème, les tons chocolat et les accents orange `#FF6A00` du site. La navigation est latérale sur ordinateur et défile horizontalement sur mobile. Les contenus s’affichent en cartes, la bibliothèque en grille et les commandes en liste large. Les formulaires utilisent une fenêtre adaptée au mobile avec actions visibles en bas. Les styles sont intégrés à la page d’administration sous son nonce CSP, sans bibliothèque ni ressource externe supplémentaire. Les contrôles d’accès et les API conservent leur fonctionnement.

## Alertes de stock

Une bannière visible dans tous les onglets de l’administration signale Bonbon à **500 g ou moins** et les autres articles à **5 pièces ou moins**. Les stocks nuls portent la mention « rupture de stock ». Les recettes de découverte sont exclues. L’alerte se recalcule après les opérations, à la réouverture de l’onglet et toutes les 30 secondes pendant que l’administration est visible ; elle disparaît après réapprovisionnement. Le bouton « Gérer les stocks » ouvre les produits. Aucun courriel ou notification externe n’est envoyé.

## Éditeur d’apparence

Depuis **Admin → Apparence du site**, choisir le fond crème ou blanc, les espacements, le style et les angles des boutons, le côté de l’image du bandeau et le nombre de colonnes de la boutique sur ordinateur. Les textes et destinations des boutons Histoire et Collection sont modifiables ; ceux des diapositives restent dans Nouveautés. Les choix de colonnes s’adaptent automatiquement aux petits écrans.

Les six sections de l’accueil peuvent être réordonnées avec Monter/Descendre ou masquées sans supprimer leur contenu. Au moins une section doit rester visible. L’en-tête et le pied de page restent accessibles. Les pages historiques libres en texte brut gardent leur propre contenu : les convertir aux champs structurés de Pages pour bénéficier des sections de l’accueil.

L’aperçu ordinateur/téléphone reçoit les réglages uniquement dans son iframe de même origine ; aucun changement n’est enregistré avant le bouton « Enregistrer sur le site ». Une restauration remet les valeurs d’origine dans l’aperçu, puis demande le même enregistrement. Les changements non enregistrés déclenchent un avertissement à la fermeture. Les réglages enregistrés s’appliquent immédiatement, sans nouveau déploiement.

La migration `0005_pretty_thena.sql` ajoute `site_settings`. Les écritures de l’API `/admin/api/appearance` sont authentifiées, vérifient l’origine et la version et sont consignées dans l’historique. Les valeurs sont limitées aux options prévues et les destinations aux pages publiques internes. Aucun HTML, JavaScript ou CSS arbitraire n’est accepté. L’aperçu utilise les réglages uniquement dans la page affichée : il ne modifie pas les stocks, produits ou commandes.

Vérification : les tests couvrent l’autorisation, l’origine, les valeurs invalides, les conflits de version et la restauration. L’aperçu et les déplacements n’ont pas pu être essayés visuellement dans un navigateur.

## Boutons personnalisés

Dans **Apparence → Ajouter vos boutons**, créer jusqu’à 30 boutons. Chaque bouton possède un texte, une destination publique interne, une page, un emplacement, un alignement, une taille, un style (plein orange, contour ou lien texte) et une visibilité. Les flèches règlent l’ordre des boutons à un même emplacement ; la suppression reste dans l’aperçu jusqu’à l’enregistrement.

Sur les six pages principales (Accueil, Chocolats, Boutique, Maison, Savoir-faire et Panier), placer un bouton après l’en-tête ou avant le pied de page. L’accueil permet aussi de choisir avant/après chacune de ses six sections. Un bouton lié à une section masquée est masqué avec elle. Les pages libres personnalisées n’ont pas encore d’emplacements configurables.

L’aperçu reflète les changements sans les publier. Cliquer sur **Enregistrer sur le site** applique les réglages. Les boutons historiques Histoire/Collection et ceux de Nouveautés restent éditables à leurs emplacements habituels. Les couleurs orange et les protections de l’API sont conservées. Les réglages existants sans boutons personnalisés restent compatibles ; aucune migration supplémentaire ni bouton automatique n’est ajouté.


## Articles maison : fonctionnement actuel

La vente au kilo et le choix de poids sont retirés. La page Bonbons reste une découverte des recettes, sans composition d’assortiment ni prix au kilo. Le panier accepte uniquement des articles maison vendus à la pièce. Il retire l’ancien article `bonbon` des sélections locales et l’API refuse de le commander, même si un client envoie manuellement sa référence.

Dans **Produits et stocks → Ajouter**, le propriétaire crée chaque boîte, coffret ou autre article avec une référence propre, un nom libre, une description, une image, un prix et un stock en pièces. Publication, modification et suppression restent indépendantes pour chaque article. Aucun coffret fictif n’est ajouté automatiquement. Les recettes de découverte sont gérées dans leur onglet et ne constituent pas des articles achetables. Les alertes concernent les articles à cinq pièces ou moins.

La migration `0006_retire_weight_sales.sql` dépublie uniquement l’ancienne référence `bonbon`, sans convertir son stock en pièces ni modifier les commandes historiques. L’admin identifie l’ancien article comme retiré ; il peut être supprimé si les règles de protection des commandes le permettent. Il ne peut pas être réactivé sous cette référence. Créer une nouvelle référence pour les articles actuels. Les anciens brouillons au poids doivent être recréés avec les articles maison ; les commandes déjà confirmées peuvent terminer leur cycle ou être annulées en restituant correctement leur ancien stock.

Cette section remplace les indications historiques sur le tarif unique et les quantités en grammes présentes plus haut.


## Simplification de l’interface

Les titres et introductions au-dessus des listes d’administration sont masqués. Les informations des articles et les formulaires sont conservés. Sur l’accueil, les commandes Lecture/Pause et les flèches de navigation des nouveautés sont retirées. Les indicateurs du bandeau, le glissement tactile, les touches de navigation et le défilement natif de la rangée restent disponibles. Le focus et les interactions suspendent toujours l’avance automatique du bandeau.

## Éditeur visuel (interface principale)

**Admin → Éditeur visuel** ouvre `/admin/editeur`. Choisir l’une des six pages principales, puis cliquer sur un élément dans l’aperçu. Le panneau « Élément » permet de changer un texte simple, une destination de lien, une image de la bibliothèque ou téléversée, ses couleurs, sa police, ses dimensions, son alignement, ses marges et ses espacements. « Bloc parent » sélectionne le conteneur pour modifier la disposition en ligne, colonne ou grille. Les pages libres `/contenu/*` ne sont pas incluses dans ce constructeur.

« Blocs » propose l’ordre, la visibilité et le déplacement par glisser-déposer des sections de chaque page. Un bloc ajouté peut être glissé sur une section existante pour y être placé. Les flèches offrent une alternative accessible au glissement. Les blocs Texte, Image, Bouton et Espacement peuvent être ajoutés avant/après une section, après l’en-tête ou avant le pied de page. Les blocs ajoutés peuvent être dupliqués ou supprimés. Les éléments personnalisés disposent d’une restauration individuelle ; un élément masqué reste listé pour pouvoir le restaurer.

« Thème » règle les couleurs générales, la famille typographique, les symboles des liens (masqués par défaut), les boutons, le bandeau et les colonnes de la boutique. Le mode ordinateur/téléphone sert à vérifier la présentation ; le mode Naviguer permet de parcourir le site au lieu de sélectionner les éléments. Les prix, noms d’articles, stocks et quantités restent gérés par les écrans métier. Leur présentation est personnalisable sans substituer leurs données.

Annuler/Rétablir conserve jusqu’à 40 états en mémoire pendant la session. **Enregistrer sur le site** persiste les réglages avec contrôle de version. Rien n’est enregistré par une simple sélection ou un changement d’aperçu. Si une autre session a modifié les réglages, l’API refuse l’écrasement. La restauration globale remet l’apparence d’origine dans l’aperçu avant l’enregistrement. Les téléversements sont ajoutés à la bibliothèque immédiatement, mais leur utilisation visuelle nécessite un enregistrement. Les images encore référencées sont protégées contre la suppression.

Le format conserve les réglages précédents et utilise `site_settings` sans nouvelle migration. Il limite la personnalisation à 60 blocs ajoutés, 200 éléments modifiés et 60 000 caractères de JSON. Seules des propriétés de style prédéfinies et bornées sont acceptées. Les images restent locales ; les liens acceptent les pages publiques internes, HTTPS sans identifiants, courriels et téléphones. Aucun HTML, script ou CSS arbitraire n’est interprété. Les messages de l’aperçu doivent venir de sa fenêtre parente et de la même origine. La sélection ne permet aucune écriture serveur : l’API authentifiée reste nécessaire.

Les textes et styles appliqués à des éléments existants sont des surcharges visuelles après hydratation. Un changement structurel ultérieur du code peut nécessiter de resélectionner un élément ; les ancrages des sections restent stables lors des déplacements. Les blocs ajoutés sont rendus côté serveur par React avec échappement. Les tests de l’éditeur utilisent un DOM simulé et le rendu serveur : une vérification visuelle réelle du clic, du glissement et de l’aperçu reste nécessaire, faute de navigateur disponible dans cet environnement.

## Éditeur Puck

L’administration propose désormais **Éditeur Puck** (`/admin/puck`). Il s’agit de `@puckeditor/core`, intégré au site, sans compte Builder.io ni abonnement à un service d’édition externe. L’accès exige la même session administrateur que les autres fonctions. L’ancien lien `/admin/editeur` redirige vers Puck.

Choisissez une page en haut, puis glissez les blocs dans l’aperçu. Sélectionnez un bloc pour régler ses textes, images, liens, espacements, fond ou police. Les sections libres et colonnes permettent d’imbriquer et de déplacer plusieurs blocs. Les réglages « Page » contrôlent le logo, les couleurs, le menu et le pied de page. Le sélecteur d’image propose la bibliothèque existante et le téléversement. L’aperçu dispose de formats mobile et ordinateur, ainsi que de l’annulation/rétablissement de Puck.

**Enregistrer un brouillon** sauvegarde sans changer le site public ; **Publier** rend la page visible. Il n’y a pas d’enregistrement automatique. La première ouverture prépare une conversion en blocs du contenu actuel sans écrire en base ni remplacer son rendu. Vérifiez cette conversion avant sa première publication : elle reprend les contenus et l’ordre principal, mais ne reproduit pas exactement tous les styles et placements de l’ancien éditeur. Les options permettent de repartir du contenu actuel ou de restaurer l’ancien rendu (cette dernière action efface le document Puck de cette page, après confirmation).

Les six pages disponibles sont l’accueil, la maison, le savoir-faire, les recettes, la boutique et le panier. Les blocs Catalogue, Recettes et Panier utilisent les données actives ; les prix, stocks et lignes du panier ne sont pas figés dans les documents Puck. Dans l’éditeur, le panier est représenté par un emplacement explicatif. Le paiement reste à raccorder séparément. Après publication Puck, modifiez la présentation de cette page dans Puck ; les anciens formulaires Pages/Nouveautés restent destinés au rendu antérieur et à sa restauration.

La migration `0007_puck_pages.sql` ajoute une table distincte : document publié, document brouillon et version par chemin. Les lectures publiques ne prennent que `published`. Les écritures imposent l’origine, la session, les types de blocs autorisés, des limites de dimensions/profondeur/taille et une version optimiste. Les images utilisées dans un brouillon ou une page publiée ne peuvent pas être supprimées. Les opérations sont consignées dans l’historique.

Validation de l’intégration : 27 tests d’administration, 4 tests panier, TypeScript et compilation de production. Les tests Puck couvrent les six conversions, les brouillons/publications/restaurations, les conflits, les accès et origines refusés, les liens/styles dangereux, les références d’images et le rendu serveur réel de colonnes imbriquées. Aucun navigateur de contrôle disponible dans cet environnement : le glisser-déposer, l’édition en place et l’affichage mobile n’ont pas fait l’objet d’une vérification visuelle interactive.

## Page d’attente avant ouverture

Le mode d’attente est activé dans `site/prelaunch.mjs` (`prelaunchEnabled`). Les visiteurs voient le logo de la maison et « Notre boutique en ligne arrive bientôt ». Les routes de la boutique en construction redirigent temporairement vers l’accueil ; les images, l’authentification et l’administration restent disponibles. Aucun contenu existant n’est effacé ou remplacé dans D1.

Pour travailler, utilisez l’administration habituelle. « Voir le site » et « Voir la page » ouvrent un aperçu avec `?apercu=1`, réservé à un administrateur authentifié (liste d’accès ou activation D1). Le paramètre seul ne permet pas de contourner la page d’attente. Les nouvelles publications Puck restent derrière cette page jusqu’à l’ouverture complète. Désactiver `prelaunchEnabled`, puis publier le changement, rendra à nouveau le site complet accessible. Deux tests supplémentaires contrôlent la page publique, les redirections, les routes conservées et l’autorisation des aperçus.

## Paiement Stripe

L’intégration de paiement utilise Stripe Checkout hébergé (SDK officiel, appels serveur). La connexion du plugin Stripe dans ChatGPT ne transmet pas de clé API au serveur du site. Le propriétaire termine donc la liaison dans **Administration → Paiements Stripe** (`/admin/paiements`), sans publier de clé dans la conversation :

1. Ouvrir les clés API de son compte Stripe et commencer avec une clé secrète **de test** `sk_test_…`.
2. La saisir dans le formulaire protégé. Pour les essais, cocher « Activer le paiement dans le panier ». Définir les frais et pays d’expédition si ce mode de réception doit être proposé ; aucun tarif n’est inventé, le retrait est gratuit.
3. Enregistrer : le serveur vérifie le compte et crée automatiquement le webhook `https://auparraingenereux.fr/api/stripe/webhook`, avec son secret de signature. Le compte et le mode s’affichent ; les clés ne sont jamais renvoyées à l’écran. Les clés restreintes doivent autoriser les ressources utilisées (compte, sessions Checkout, produits/prix créés en ligne et webhooks) ; une clé privée classique fonctionne sans cette configuration granulaire.
4. Depuis l’aperçu administrateur du panier, tester un article réellement créé et publié avec un stock suffisant. En mode test, utiliser les cartes de test Stripe (par exemple `4242 4242 4242 4242`, une date future et un CVC de test), jamais une carte réelle. Vérifier la commande, les frais, l’adresse, le stock, l’abandon et l’expiration.
5. Après validation complète du parcours, remplacer la clé par une clé `sk_live_…` d’un compte Stripe activé pour encaisser. Le changement de mode est bloqué tant qu’il reste des sessions en cours. Ne pas confondre cette activation avec l’ouverture du site : la page d’attente reste active et les paiements restent réservés à l’aperçu administrateur jusqu’à sa désactivation dans le code.

Le formulaire chiffre les clés Stripe et la signature du webhook avec AES-GCM. La clé maîtresse `PAYMENT_CONFIG_ENCRYPTION_KEY` est un secret d’environnement Sites, généré lors de l’intégration, indépendant du dépôt et de D1. **Ne pas supprimer ou remplacer ce secret** sans migration : les réglages chiffrés ne seraient plus lisibles. Les audits ne contiennent ni clé, ni données de carte. Les données de carte sont saisies chez Stripe.

`POST /api/paiement/checkout` relit les prix, la publication et les stocks depuis D1. Un identifiant de tentative permet de réessayer sans créer une deuxième session. Le montant envoyé par le navigateur est ignoré. Les migrations `0008_tan_the_hood.sql` et `0009_stiff_cyclops.sql` ajoutent les réglages chiffrés, les tentatives de paiement, les marqueurs de remboursement, les informations Stripe des commandes et les contraintes de réservation. Les réservations décrémentent le stock dans une transaction avec contrôle de disponibilité ; une limite de cinq sessions actives par empreinte d’adresse réseau évite les créations répétées sans conserver l’adresse réseau brute.

Les commandes non payées ne sont pas insérées dans la liste des commandes. Après réception d’un webhook signé et récent, le serveur relit la session directement chez Stripe et vérifie son mode, sa devise et ses montants. Il crée une seule commande confirmée, avec « Payée via Stripe », le mode test/production, le retrait ou l’expédition, les frais et l’adresse si nécessaire. Le stock déjà réservé n’est pas décrémenté une deuxième fois. La page `/paiement` vérifie également l’état auprès du serveur ; un simple paramètre de redirection ne suffit jamais à valider un paiement. Elle efface uniquement un panier qui correspond encore exactement aux articles payés.

Une session expirée libère le stock **après confirmation de son expiration par Stripe**, pas sur la seule base de l’heure locale. Le retour d’annulation demande d’abord à Stripe de fermer la session. Une panne réseau à la création conserve la réservation tant que le résultat reste incertain. Le bouton « Vérifier auprès de Stripe » réconcilie jusqu’à trois sessions expirées à chaque action ; les webhooks restent la voie normale de confirmation, même si le client ne revient pas sur le site. Une réservation dont la création reste inconnue au-delà de la fenêtre d’idempotence Stripe peut nécessiter une vérification manuelle dans Stripe : elle n’est pas libérée aveuglément.

Un remboursement total effectué dans Stripe est synchronisé. Les commandes encore confirmées ou en préparation sont annulées et leur stock est restitué une fois ; celles déjà prêtes ou terminées ne remettent pas automatiquement les articles en stock. Les remboursements partiels restent gérés dans Stripe. L’administration ne permet pas d’annuler directement une commande payée sans remboursement confirmé. Le site ne déclenche ni remboursement, ni expédition, ni envoi de courriel lui-même.

Validation : 12 tests paiement (SQLite réel, chiffrage WebCrypto, vérification des signatures avec le SDK Stripe et réponses Stripe simulées dans les tests uniquement), 27 tests administration, 4 tests panier et 2 tests page d’attente, TypeScript et compilation. Les tests vérifient notamment les prix imposés côté serveur, les notifications répétées et désordonnées, les réservations concurrentes, les signatures invalides ou trop anciennes, les frais/adresses, les abandons, les pannes réseau et les remboursements. **Aucun paiement de bout en bout dans un vrai compte Stripe ni contrôle visuel interactif n’a été réalisé** : le compte doit encore être relié avec la clé de test dans l’administration avant ces essais. Aucun encaissement réel n’est activé automatiquement.

Documentation de référence : [Checkout et confirmation des commandes](https://docs.stripe.com/checkout/fulfillment), [création d’une session](https://docs.stripe.com/api/checkout/sessions/create), [webhooks signés](https://docs.stripe.com/webhooks).
