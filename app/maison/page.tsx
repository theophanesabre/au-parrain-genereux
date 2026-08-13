import Image from "next/image";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function Maison() {
  return <main className="inner-page maison-page">
    <SiteHeader />
    <PageIntro index="01" kicker="La maison" title="Une chocolaterie havraise.">
      <p>Au Parrain Généreux accompagne les Havrais depuis 1890. Installée rue de Paris avant-guerre, la boutique se trouve aujourd’hui au 123 rue Maréchal Joffre. Nous poursuivons les recettes de la maison avec de bons produits, des gestes maîtrisés et une attention constante portée au goût. Une nouvelle gamme bean-to-bar, fabriquée au Havre par APG Cacao Févier, viendra peu à peu compléter cette histoire.</p>
    </PageIntro>
    <section className="maison-signature" aria-label="APG Cacao Févier et Au Parrain Généreux">
      <Image src="/images/apg-au-parrain-genereux-transparent.png" alt="APG Cacao Févier et Au Parrain Généreux, deux savoir-faire havrais" width={1672} height={941} quality={95} sizes="(max-width: 900px) 90vw, 1200px" />
    </section>
    <SiteFooter />
  </main>;
}
