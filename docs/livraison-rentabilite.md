# Livraison Colissimo — hypothèses et réglages

Grille client : 8,90 € sous 40 € de produits, 4,50 € dès 40 €, offerte dès 80 €. Retrait en boutique gratuit. Expédition à domicile en France métropolitaine uniquement. Les seuils sont inclus, calculés hors livraison sur les prix produits vérifiés par le serveur. Le tarif de base de 8,90 € est une hypothèse choisie faute de tarif fourni sous 40 € ; il est modifiable dans Commandes → Livraisons.

## Calculer le coût réel

Coût logistique = affranchissement selon le poids brut du colis + carton et protections + minutes de préparation / 60 × coût horaire + éventuelles options, assurance et autres coûts.

Part financée par la maison = coût logistique − participation facturée au client.

Contribution simplifiée = montant produits × taux de marge brute − part financée par la maison. Il s’agit du taux de marge rapporté au chiffre d’affaires, pas d’une majoration du coût d’achat. Utiliser des montants tous HT ou tous TTC ; convertir la TVA et ajouter frais de paiement, retours, pertes et autres charges pour une analyse comptable. Ce calcul simplifié ne représente pas un bénéfice net.

## Exemples indicatifs

Hypothèses : carton/protections 1,50 €, préparation 3 minutes à 20 €/heure, soit 1 €. Aucune de ces hypothèses n’a été fournie par la maison : les remplacer par les coûts observés. Grille domicile 2026 La Poste, arrondis au centime.

| Poids brut | Affranchissement sans remise | Logistique totale sans remise | Logistique totale avec remise de 15 % |
|---|---:|---:|---:|
| 500 g | 7,59 € | 10,09 € | 8,95 € |
| 1 kg | 9,59 € | 12,09 € | 10,65 € |
| 2 kg | 11,19 € | 13,69 € | 12,01 € |
| 5 kg | 17,39 € | 19,89 € | 17,28 € |

À 1 kg sans remise : la maison finance 3,19 € sous 40 €, 7,59 € au tarif réduit et 12,09 € à partir de 80 €. La gratuité coûte donc 15,1 % d’un panier de 80 €, avant les autres charges. À 2 kg, elle coûte 17,1 % ; à 5 kg, 24,9 %. À 50 % de marge brute hypothétique, un panier de 80 € conserve 27,91 € après cette seule logistique de 1 kg, avant les autres charges et les corrections de TVA.

Conclusion : grille plausible pour des colis légers et une marge suffisante, mais rentabilité non certifiable sans coûts réels. Vérifier les colis emballés de 40 € et 80 €, surveiller aussi les paniers lourds et les petites commandes. Le poids net des chocolats ne suffit pas ; cartons, calage et éventuels accumulateurs de froid comptent. Le site ne prétend pas calculer automatiquement le poids brut à partir de fiches produits incomplètes.

## Remise temporaire

Le contrat Facilité annonce -15 % comme offre de bienvenue de six mois (mois courant + cinq mois pleins), réservée aux nouveaux souscripteurs, avec exclusions. Ne pas supposer une remise permanente ni appliquer automatiquement -15 % à une grille différente de la base contractuelle. Le simulateur conserve 0 % par défaut et permet de comparer 15 %. Confirmer le tarif contractuel, sa base HT/TTC et l’éligibilité.

Sources consultées :
- https://www.laposte.fr/professionnel/colissimo-en-ligne/tarifs
- https://www.colissimo.entreprise.laposte.fr/offres-et-services/nos-contrats/contrat-facilite

## Mise en œuvre

Un réglage central indépendant des secrets Stripe alimente le panier et les nouveaux Checkout. Le serveur recalcule les seuils à partir des articles réels. Les paiements commencés gardent leurs frais et leur montant ; les webhooks vérifiés restent la seule source de création des commandes payées. La migration ne modifie ni secrets ni mode Stripe ni stocks. Les hypothèses de marge et de coût restent dans l’administration, jamais dans l’API publique.
