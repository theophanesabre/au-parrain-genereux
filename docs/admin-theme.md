# Apparence de l’administration

L’administration utilise un thème monochrome clair (fond blanc) ou sombre. Le choix est local à l’appareil et enregistré sous `apg-admin-theme` ; à défaut de choix, le fond est blanc. Le client partagé synchronise le cadre, les vues intégrées et les autres onglets de même origine. Les messages de synchronisation vérifient l’origine et la fenêtre émettrice. Le thème est retiré du document lorsque le cadre React est démonté pour préserver l’apparence publique du site.

Un seul logo est affiché, centré tout en haut. Le logo interne de Stocks est masqué quand cette vue est intégrée à l’administration ; l’accès direct conserve son propre logo centré et son interrupteur de thème. Les contenus et photos restent inchangés.

Le vert signale les ajouts, le rouge les retraits. Les validations de mouvements de stock suivent le sens de l’opération : entrée / retour web = vert, sortie / mise de côté web = rouge. Le libellé et le signe restent visibles : la couleur n’est pas le seul indicateur. La navigation et les enregistrements ordinaires restent neutres. Les permissions serveur, paiements et stocks ne sont pas modifiés.

Implémentation partagée : `admin/theme.mjs`, styles et client intégrés aux pages HTML avec leur nonce CSP existant, et au cadre React. Les tests `npm run test:admin-theme` vérifient la mémorisation, la synchronisation, l’isolation du site public, les marqueurs de boutons et les en-têtes des pages autonomes. Le rendu sur tablette réelle reste à vérifier : aucun outil de navigateur n’est disponible dans cette session.
