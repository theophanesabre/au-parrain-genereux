import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const gestes = [
  ["Sélectionner", "Nous choisissons des matières premières de qualité : chocolats Cacao Barry, noisettes du Piémont, amandes et fruits soigneusement sélectionnés."],
  ["Tempérer", "Le chocolat est chauffé, refroidi puis ramené à sa température de travail afin d’obtenir une texture nette, une belle cassure et un brillant naturel."],
  ["Mouler", "Nous coulons le chocolat dans les moules, formons des coques fines et régulières, puis laissons chaque pièce cristalliser avec patience."],
  ["Garnir", "Pralinés, ganaches, caramels et pâtes d’amande sont préparés dans l’atelier avant de venir garnir chaque chocolat."],
  ["Enrober", "Les intérieurs sont recouverts d’une fine couche de chocolat pour préserver leur fondant et créer un équilibre précis entre la coque et le cœur."],
  ["Finir", "Décors, assemblage et mise en coffret sont réalisés à la main. Chaque pièce est vérifiée avant de rejoindre la boutique."],
];

export default function SavoirFaire() {
  return <main className="inner-page craft-page">
    <SiteHeader />
    <section className="craft-intro">
      <p className="section-index">Le savoir-faire</p>
      <h1>Tout est fabriqué dans notre atelier.</h1>
      <div><p>De la sélection des ingrédients à la dernière finition, nous réalisons chaque étape nous-mêmes. Nous tempérons, moulons, garnissons et enrobons nos chocolats en petites séries afin de préserver leurs textures, leur fraîcheur et le caractère de chaque recette.</p></div>
    </section>

    <section className="craft-process" aria-labelledby="gestes-title">
      <header><p>Les gestes</p><h2 id="gestes-title">De la matière au bonbon</h2></header>
      <div>{gestes.map(([titre, texte]) => <article key={titre}><h3>{titre}</h3><p>{texte}</p></article>)}</div>
    </section>

    <section className="craft-made">
      <p>Au-delà du chocolat</p><div><h2>Nos gourmandises sont également maison.</h2><p>Nous préparons aussi nos pâtes de fruits, pâtes à tartiner et caramels. Les fruits sont cuits doucement, les fruits secs torréfiés, les pralinés broyés et les caramels surveillés jusqu’à obtenir la texture juste.</p><Link href="/boutique">Venir découvrir la boutique</Link></div>
    </section>
    <SiteFooter />
  </main>;
}
