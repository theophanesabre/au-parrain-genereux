import Image from "next/image";
import Link from "next/link";
import { bonbons } from "@/data/bonbons";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";

const descriptions = [
  "Pâte d’amande et praliné maison, enrobés de chocolat noir ou au lait.",
  "Praliné onctueux, délicatement enrobé de chocolat noir.",
  "Praliné noisette et chocolat blanc, enrobé de chocolat noir, au lait ou blanc.",
  "Praliné à l’ancienne aux éclats d’amandes grillées, enrobé de chocolat.",
  "Gianduja surmonté d’une fleur cristallisée de violette ou de mimosa.",
  "Praliné lisse d’amande, enrobé de chocolat noir ou au lait.",
  "Praliné à l’ancienne, enrobé de chocolat noir, au lait ou blanc.",
  "Praliné à l’ancienne et paillettes de chocolat, sous un fin enrobage.",
  "Biscuit dentelle au beurre et praliné, enrobés de chocolat noir ou au lait.",
  "Biscuit spéculoos mêlé au praliné, enrobé de chocolat noir ou au lait.",
  "Pâte d’amande fondante, enrobée de chocolat noir ou au lait.",
  "Un godet de chocolat garni d’un gianduja généreux.",
  "Zestes de citron et d’orange confits, délicatement enrobés de chocolat.",
  "Confiserie d’œuf, de miel et d’amande, enrobée de chocolat noir ou au lait.",
  "Praliné lisse d’amande, enrobé de chocolat au lait ou noir.",
];

export default function Bonbons() {
  return <main className="inner-page">
    <SiteHeader />
    <PageIntro index="04" kicker="La collection maison" title="Les bonbons de chocolat.">
      <p>Cette sélection présente quelques recettes de la maison. Notre collection évolue au fil des saisons et de nos fabrications ; retrouvez les autres chocolats en boutique. <Link className="inline-text-link" href="/#nous-trouver">Consulter nos informations pratiques</Link>.</p>
    </PageIntro>
    <section className="bonbon-grid standalone bonbon-collection">
      {bonbons.map((name, index) => <figure key={name}>
        <div className="bonbon-card__visual">
          <Image src={`/images/bonbons-detoures-originaux/${index + 1}.png`} alt={`${name}, bonbon de chocolat maison`} width={1055} height={1055} quality={100} sizes="(max-width: 620px) 90vw, (max-width: 980px) 45vw, 30vw" />
        </div>
        <figcaption><strong>{name}</strong><p>{descriptions[index]}</p></figcaption>
      </figure>)}
    </section>
    <SiteFooter />
  </main>;
}
