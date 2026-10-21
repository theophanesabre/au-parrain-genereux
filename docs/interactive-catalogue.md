# Catalogue interactif APG

## Architecture et données

Page /catalogue, gestion propriétaire /admin/catalogue (Réglages → Catalogue & ballotins). Réutilise React/Vinext, D1, le panier, les articles, le stock web, Stripe et les autorisations existants. Aucune nouvelle dépendance ni authentification.

Migration 0038 : créations éditoriales en JSON validé et versionné, liens des formats vers les articles existants, compositions temporaires anonymes. Les 45 emplacements par défaut sont générés comme démonstrations : aucune fausse recette ni photo ni allergène ni tarif n’est inséré dans la base de production. On peut renseigner un emplacement, ajouter une référence et archiver les entrées. Les photos viennent de la médiathèque ou d’un import. Les utilisations de photos du catalogue sont protégées contre la suppression et prises en compte lors des remplacements.

Les 45 démonstrations contiennent des profils gustatifs illustratifs : les 15 premières réutilisent des visuels déjà présents sur le site, les autres affichent des silhouettes Photo à renseigner. Aucun visuel n’a été généré. Elles restent sélectionnables pour essayer le parcours, mais sont exclues de toute vente et de toute recommandation avec exclusions.

## Recommandations et livre

Double page sur ordinateur, page unique sur téléphone, flèches, clavier, gestes horizontaux, préférence de mouvement réduit. Six créations par page ; fiches de détail accessibles au clavier. Favoris conservés localement ; exclusions non conservées dans le navigateur.

Scores déterministes : famille, chocolat, textures, arômes, proximité d’intensité et de douceur. Répartition arrondie des préférences : 5/6, 10/12, 19/24, 29/36. Découvertes non sélectionnées et cohérentes (au moins 40 % du meilleur score), groupes distincts, pénalité progressive pour diversifier les répétitions. La rotation des découvertes est déterministe et conserve les pièces d’affinité. Le remplacement conserve le rôle de la pièce et refait les contrôles de disponibilité et d’exclusion.

Allergènes UE14, traces et exclusions d’ingrédients. Avec exclusions, toute création démo, recette absente, ingrédient/allergène/trace non vérifié est rejetée. Une exclusion libre d’ingrédient exclut aussi les créations signalant des traces, par prudence. Les correspondances d’ingrédients sont normalisées pour les accents et pluriels simples ; les données doivent être complètes et vérifiées par la maison. Aucune garantie médicale d’absence de contamination ; le client est invité à contacter la boutique pour une allergie sévère.

## Mise en vente

Renseigner les véritables créations et photographies ; confirmer ingrédients, allergènes et risques de traces ; décocher Démonstration. Créer les articles vendables de 6/12/24/36 dans Articles avec leurs vrais prix et stocks, puis les relier dans Formats et prix. Aucun prix n’a été inventé.

Le serveur revalide toutes les pièces, le format, les versions, les exclusions et le consentement exprès lors de l’ajout. Il crée une référence temporaire de composition, pas un faux produit. Le panier relit les prix et stocks existants et revalide la composition. Un changement alimentaire ou un archivage invalide les compositions précédentes. Les quantités de plusieurs compositions et des articles ordinaires d’un même produit sont agrégées AVANT les réservations Stripe, afin de réserver le stock une seule fois. La commande conserve les pièces et les quantités pour la préparation. Le catalogue ne déduit pas les ingrédients ou le stock laboratoire.

Les exclusions potentiellement sensibles nécessitent un accord exprès lors de leur transmission. Références temporaires valables 24 h, supprimées au prochain enregistrement ; refus et limite de fréquence côté serveur. La commande conserve les informations alimentaires des pièces mais pas la liste des allergies déclarées. La confidentialité est mise à jour.

## Vérification

Tests de sélection, quatre formats/arrondis/déterminisme, allergènes et traces, informations inconnues, indisponibilité, remplacement et nouvelles découvertes, catalogue vide/incomplet, gestion versionnée, authentification/origine, consentement, expiration, altération client du prix, revalidation des versions, agrégation du stock et achat Stripe avec préparation conservée. Aucun achat réel ni mouvement de stock de production effectué. La vérification navigateur/tactile réelle reste à effectuer : aucun outil de navigateur disponible dans cet environnement.
