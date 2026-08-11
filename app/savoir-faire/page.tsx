import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const gestes = [
  ["01", "Sélectionner", "Nous choisissons des matières premières de qualité : chocolats Cacao Barry, noisettes du Piémont, amandes et fruits soigneusement sélectionnés."],
  ["02", "Tempérer", "Le chocolat est chauffé, refroidi puis ramené à sa température de travail afin d’obtenir une texture nette, une belle cassure et un brillant naturel."],
  ["03", "Mouler", "Nous coulons le chocolat dans les moules, formons des coques fines et régulières, puis laissons chaque pièce cristalliser avec patience."],
  ["04", "Garnir", "Pralinés, ganaches, caramels et pâtes d’amande sont préparés dans l’atelier avant de venir garnir chaque chocolat."],
  ["05", "Enrober", "Les intérieurs sont recouverts d’une fine couche de chocolat pour préserver leur fondant et créer un équilibre précis entre la coque et le cœur."],
  ["06", "Finir", "Décors, assemblage et mise en coffret sont réalisés à la main. Chaque pièce est vérifiée avant de rejoindre la boutique."],
];

export default function SavoirFaire() {
  return <main className="inner-page craft-page">
    <SiteHeader />
    <section className="craft-intro">
      <p className="section-index">02 — Le savoir-faire</p>
      <h1>Tout est fabriqué dans notre atelier.</h1>
      <div><p>De la sélection des ingrédients à la dernière finition, nous réalisons chaque étape nous-mêmes. Nous tempérons, moulons, garnissons et enrobons nos chocolats avec le même soin, en petites séries.</p><p>Cette maîtrise de toute la fabrication nous permet de préserver les textures, la fraîcheur et le caractère de chaque recette.</p></div>
    </section>

    <section className="craft-process" aria-labelledby="gestes-title">
      <header><p>Les gestes</p><h2 id="gestes-title">De la matière au bonbon</h2></header>
      <div>{gestes.map(([numero, titre, texte]) => <article key={numero}><span>{numero}</span><h3>{titre}</h3><p>{texte}</p></article>)}</div>
    </section>

    <section className="craft-made">
      <p>Au-delà du chocolat</p><div><h2>Nos gourmandises sont également maison.</h2><p>Nous préparons aussi nos pâtes de fruits, pâtes à tartiner et caramels. Les fruits sont cuits doucement, les fruits secs torréfiés, les pralinés broyés et les caramels surveillés jusqu’à obtenir la texture juste.</p><Link href="/boutique">Venir découvrir la boutique</Link></div>
    </section>
    <SiteFooter />
  </main>;
}
