# Administration sécurisée et préparation des commandes

Au Parrain Généreux dispose désormais d’un espace `/admin` aux couleurs orange `#FF6A00`, réservé côté serveur aux identifiants ChatGPT explicitement autorisés. Il permet de gérer produits, prix et stocks, publier des pages, téléverser des images et suivre des commandes internes.

Les données sont persistées dans D1 et les images dans R2. Les commandes réservent le stock atomiquement à la confirmation et le restituent lors d’une annulation autorisée. Les contrôles d’origine, de version concurrente et de format d’image protègent les écritures. Le catalogue public lit les produits publiés, et les pages sont consultables à `/contenu/<référence>`.

Avant fusion : consulter `docs/ADMINISTRATION.md`, valider la liste des administrateurs, préparer le catalogue initial et vérifier le proxy d’identité. Aucun déploiement ni paiement activé.

Validation : tests de sécurité, CRUD, médias et cycle des commandes sur SQLite ; vérification TypeScript ; compilation Vinext ; application réussie des deux migrations sur D1 local. Les tests obsolètes du squelette de démarrage sont remplacés par les tests de l’administration. Essai de bout en bout sur hébergement et vérification visuelle à faire avant publication.
