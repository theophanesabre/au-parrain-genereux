# Pages légales — état de préparation

## Informations confirmées

Le propriétaire a confirmé SIRET 42827364300018, TVA FR69428273643, préparation de 2 jours et retrait sous 7 jours à partir de la disponibilité. L’Annuaire des Entreprises identifie AU PARRAIN GENEREUX, SARL, au 121 et 123 rue Maréchal Joffre, 76600 Le Havre. Le point de retrait demeure au 123. L’identité ne provient pas du titulaire du compte GitHub ou du domaine.

## Informations que le propriétaire ne possède pas encore

- Capital social à confirmer sur un extrait/statuts récents : les sources consultées présentent des montants contradictoires (4 000 / 8 000 €). Aucun montant choisi au hasard.
- Directeur de publication : nom du responsable légal à fournir, pas celui du développeur par défaut.
- Médiateur de la consommation : convention réelle, nom, adresse postale, URL. Aucune adhésion ni sélection d’organisme n’a été faite.

Les mentions et CGV affichent leur statut préparatoire. Cela ne constitue pas une certification de conformité ni des CGV finales. La page d’attente et le mode de paiement existants sont conservés. Pour finaliser : compléter site/legal.mjs et les passages concernés, retirer le statut préparatoire seulement après résolution des manquants, incrémenter LEGAL_VERSION à chaque changement contractuel et conserver les anciennes versions.

## Fonctionnement livré

- Pages publiques /mentions-legales, /conditions-generales-de-vente, /politique-de-confidentialite, /cookies et /retractation, accessibles depuis la page d’attente et les pieds de page.
- Aucune publicité, statistique ou bannière de faux consentement ajoutée. Le panneau Cookies décrit les stockages réels et permet d’effacer le panier sur cet appareil. Il ne supprime pas des cookies tiers ni n’annule une commande.
- Acceptation non précochée, vérifiée côté serveur pour les nouvelles tentatives Stripe ; version et horodatage enregistrés. Les tentatives antérieures, leur montant et leur règlement ne changent pas.
- Déclaration en deux étapes, sans compte et sans motif ; enregistrement daté/idempotent ; accusé texte téléchargeable proposé immédiatement. Aucun email automatique ni remboursement déclenché. Les administrateurs consultent les déclarations et marquent leur suivi dans Commandes → Rétractations ; ils doivent traiter la demande et répondre au client.
- Limitation des soumissions abusives, origine vérifiée, aucune consultation publique des demandes. Un identifiant technique journalier pseudonymisé sert à la limitation ; il est retiré des anciennes lignes lors d’une nouvelle soumission après 24 h.

## Avant d’ouvrir les ventes

1. Résoudre les informations obligatoires ci-dessus et faire vérifier les textes commerciaux, notamment l’encadré de garantie et la confirmation des contrats sur support durable, avec les pratiques effectives de l’entreprise. Les CGV sont imprimables mais aucun envoi automatique de contrat par courriel n’est installé.
2. Vérifier l’intégralité des ingrédients, allergènes, poids nets, conservation/date et les éventuelles exceptions à la rétractation par article. Ne pas exclure tous les chocolats par principe.
3. Organiser le suivi des rétractations, la disponibilité de leurs accusés sur support durable et la réponse au client. Le téléchargement fourni ne doit pas être confondu avec un email envoyé.
4. Appliquer réellement les durées de conservation annoncées : revue et effacement/archivage à accès limité. Aucun programme de purge globale des commandes ni journal légal automatique n’est ajouté par ce changement. Ne pas effacer des factures ou pièces nécessaires à une obligation légale.
5. Vérifier les contrats de sous-traitance et les garanties de transfert avec les prestataires réels. Infrastructure : Sites/OpenAI et Cloudflare ; le domaine chez Hostinger n’implique pas que les données applicatives y soient hébergées. Ne pas prétendre à un hébergement exclusivement UE.
6. Si un outil publicitaire/statistique ou contenu social intégré est ajouté, faire un inventaire et bloquer ses appels avant consentement valable ; le panneau actuel n’est pas un gestionnaire générique pour de futurs traceurs.

## Sources de travail

- https://annuaire-entreprises.data.gouv.fr/entreprise/au-parrain-genereux-428273643
- https://entreprendre.service-public.gouv.fr/vosdroits/F23455
- https://entreprendre.service-public.gouv.fr/vosdroits/F33527
- https://entreprendre.service-public.gouv.fr/vosdroits/F33338
- https://www.service-public.gouv.fr/particuliers/vosdroits/F10485
- https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/les-garanties-legales-de-conformite-et-contre-les-vices-caches
- https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi
- https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence
- https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees
- https://docs.stripe.com/payments/checkout/custom-components
