import { PageSections } from "@/components/appearance";
import { getPageContent } from "@/components/site-data";
import { getManagedPage, ManagedPage } from "@/components/managed-page";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const gestes = [
  ["Choisir", "Nous travaillons avec de bons ingrédients : chocolats Cacao Barry, noisettes du Piémont, amandes et fruits choisis avec soin."],
  ["Tempérer", "Le chocolat est chauffé, refroidi puis ramené à sa température de travail afin d’obtenir une texture nette, une belle cassure et un brillant naturel."],
  ["Mouler", "Nous coulons le chocolat dans les moules, formons des coques fines et régulières, puis laissons chaque pièce cristalliser avec patience."],
  ["Garnir", "Pralinés, ganaches, caramels et pâtes d’amande sont préparés dans l’atelier avant de venir garnir chaque chocolat."],
  ["Enrober", "Les intérieurs sont recouverts d’une fine couche de chocolat pour préserver leur fondant et créer un équilibre précis entre la coque et le cœur."],
  ["Finir", "Décors, assemblage et mise en coffret sont réalisés à la main. Chaque pièce est vérifiée avant de rejoindre la boutique."],
];

export const dynamic = "force-dynamic";
export default async function SavoirFaire() {
  const [managed,content] = await Promise.all([getManagedPage("savoir-faire"),getPageContent("savoir-faire")]);
  if (managed) return <ManagedPage page={managed}/>;
  return <main className="inner-page craft-page">
    <SiteHeader />
    <PageSections page="/savoir-faire" items={[
{id:'intro',content:(<><section className="craft-intro">
      <p className="section-index">{content.kicker}</p>
      <h1>{content.title}</h1>
      <div><p>{content.intro}</p></div>
    </section></>)},
{id:'process',content:(<><section className="craft-process" aria-labelledby="gestes-title">
      <header><p>{content.processKicker}</p><h2 id="gestes-title">{content.processTitle}</h2></header>
      <div>{gestes.map(([titre, texte], index) => <article key={titre}><h3>{content[`gesture${index+1}Title`] || titre}</h3><p>{content[`gesture${index+1}Text`] || texte}</p></article>)}</div>
    </section></>)},
{id:'workshop',content:(<><section className="craft-made">
      <p>{content.workshopKicker}</p><div><h2>{content.workshopTitle}</h2><p>{content.workshopText}</p><a href="/#nous-trouver">Venir nous rencontrer</a></div>
    </section></>)}
]}/>
    <SiteFooter />
  </main>;
}
