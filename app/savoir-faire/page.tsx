import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const gestes = [
  ["Choisir", "Nous travaillons avec de bons ingrédients : chocolats Cacao Barry, noisettes du Piémont, amandes et fruits choisis avec soin."],
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
      <h1>Chaque chocolat passe par notre atelier.</h1>
      <div><p>Nous réalisons chaque étape nous-mêmes : tempérer, mouler, garnir et enrober. Le travail en petites séries nous permet de suivre chaque fabrication avec attention, de préserver la fraîcheur et de respecter l’équilibre de nos recettes.</p></div>
    </section>

    <section className="craft-process" aria-labelledby="gestes-title">
      <header><p>Les gestes</p><h2 id="gestes-title">De la matière au bonbon</h2></header>
      <div>{gestes.map(([titre, texte]) => <article key={titre}><h3>{titre}</h3><p>{texte}</p></article>)}</div>
    </section>

    <section className="craft-made">
      <p>Dans notre atelier</p><div><h2>Le savoir-faire se prolonge au-delà du chocolat.</h2><p>Nous préparons également nos pâtes de fruits, pâtes à tartiner et caramels. Les fruits cuisent doucement, les fruits secs sont torréfiés et les pralinés sont broyés sur place pour obtenir les textures et les goûts que nous recherchons.</p><Link href="/#nous-trouver">Venir nous rencontrer</Link></div>
    </section>
    <SiteFooter />
  </main>;
}
