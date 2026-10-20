# Notifications automatiques — blocage de connexion

Demandé par le propriétaire : email et SMS automatiques quand une commande est prête. Aucun fournisseur connecté ni envoi automatique n’existe actuellement. La promesse publique d’un envoi email/SMS n’est pas publiée tant que l’envoi ne fonctionne pas.

Stripe Directory installé mais la recherche renvoie « Invalid user agent. This endpoint can only be used by the Stripe CLI tool. ». Le catalogue Stripe Projects permet une recherche ; il retourne Customer.io pour SMS et plusieurs services pour email. Aucun compte, abonnement ou crédit payant créé.

Le précontrôle Stripe Projects retourne BROWSER_AUTH_REQUIRED : No Stripe session with a live-mode account is signed in. Connexion navigateur requise avant de continuer. Ne pas répéter le précontrôle ni initialiser le projet sans résolution de ce blocage.

Avant activation : choix du service et validation de ses coûts, compte connecté, adresse email / domaine validé, expéditeur SMS autorisé, conservation séparée du téléphone client fourni par Stripe (la colonne contact actuelle préfère l’email), file persistante par commande et canal, unicité sur commande/canal pour éviter les doublons, suivi des échecs et reprises, déclenchement seulement pour un retrait en boutique marqué prêt, protections serveur des réglages et secrets. Ne pas confondre acceptation de la demande par le prestataire et livraison au destinataire. Mettre à jour la confidentialité et les CGV lorsque le service est réellement actif.
