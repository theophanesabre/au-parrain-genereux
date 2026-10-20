# Notifications de commande — Brevo

Le propriétaire a confirmé disposer d’un compte Brevo. Connexion via /admin/notifications (Réglages → Emails & SMS), réservée au propriétaire. La clé API est chiffrée AES-GCM côté serveur et n’est jamais retournée par l’API. Aucune clé ni aucun message réel n’a été envoyé pendant le développement.

## Activation

Renseigner la clé API dans le formulaire sécurisé, une adresse email active vérifiée dans Brevo, le nom de la maison et un expéditeur SMS autorisé (3 à 11 caractères alphanumériques). Autoriser les services transactionnels Brevo et disposer de crédits SMS. L’activation vérifie l’adresse auprès de /v3/senders. L’état reste désactivé tant que ce réglage n’est pas enregistré. L’activation ne réexpédie pas d’anciennes commandes.

## Fonctionnement

Migrations 0036 et 0037 : email et téléphone séparés dans les commandes ; paramètres chiffrés ; file persistante par commande/événement/canal. Les déclencheurs SQL enregistrent atomiquement deux événements : création d’une commande réelle payée confirmée (SMS uniquement) ; passage à Prête (email et SMS). Le seul email envoyé par ce module est celui de commande prête. Les anciens emails de confirmation en attente ou refusés sont marqués non envoyés. Unicité par événement/canal, même lors d’un aller-retour de statut. Aucune notification pour les paiements test, brouillons ou remboursés. La sortie boutique/stock ne déclenche rien.

Les nouvelles commandes conservent le téléphone collecté par Stripe. Les anciennes commandes ne possédant qu’un email n’ont pas de téléphone récupérable : il n’est pas inventé. Un téléphone absent met le seul SMS en échec.

Après la réponse au webhook Stripe ou une modification autorisée dans l’administration, le Worker traite la file en arrière-plan (8 envois par lot). Un handler scheduled est fourni, mais aucun cron périodique n’est attaché à l’hébergement ; les éléments encore en attente sont traités à la prochaine mutation. Les refus définitifs sont visibles et relançables depuis l’écran de notifications. Les résultats incertains (coupure, 5xx, crash après réservation de l’envoi) ne sont jamais relancés aveuglément : vérifier Brevo. Une relance acceptée est auditée.

Une acceptation par Brevo est affichée Transmis, jamais Livré : aucun callback de livraison n’est configuré. Un retour READY pour une expédition indique Prête à être expédiée, pas remise au transporteur. La politique de confidentialité décrit Brevo et les messages transactionnels.

## Vérification avant première utilisation

Après connexion, effectuer une commande réelle contrôlée, avec email et téléphone appartenant au propriétaire, vérifier le SMS de confirmation dans Brevo puis passer la commande à Prête et contrôler l’email et le SMS. Cette vérification n’a pas été exécutée, faute de clé connectée. Ne jamais demander une clé dans la conversation.
