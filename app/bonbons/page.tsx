import Image from "next/image";
import { bonbons } from "@/data/bonbons";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function Bonbons() {
  return <main className="inner-page">
    <SiteHeader />
    <PageIntro index="04" kicker="La collection maison" title="Les bonbons de chocolat.">
      <p>Pralinés, pâtes d’amande, gianduja et confiseries : quinze recettes emblématiques de la maison.</p>
    </PageIntro>
    <section className="bonbon-grid standalone bonbon-collection">
      {bonbons.map((name, index) => <figure key={name}>
        <div className="bonbon-card__visual">
          <Image src={`/images/bonbons/${index + 1}.png`} alt={`${name}, bonbon de chocolat maison`} width={1334} height={2000} quality={95} sizes="(max-width: 620px) 90vw, (max-width: 980px) 45vw, 30vw" />
        </div>
      </figure>)}
    </section>
    <SiteFooter />
  </main>;
}
