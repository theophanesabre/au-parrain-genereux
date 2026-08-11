import Image from "next/image";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function Maison() {
  return <main className="inner-page maison-page">
    <SiteHeader />
    <PageIntro index="01" kicker="La maison" title="Une maison de caractère.">
      <p>Au Parrain Généreux est une maison havraise attachée aux goûts francs, aux gestes artisanaux et aux plaisirs que l’on partage. Installée rue de Paris avant-guerre, elle a ensuite trouvé sa place au 123 rue Maréchal Joffre. Véritable institution pour les Havrais depuis 1890, sa gamme historique est aujourd’hui perpétuée avec patience par les artisans chocolatiers du Parrain Généreux, dans un esprit de simplicité, de générosité et de travail bien fait. Cet héritage sera prochainement complété par une ligne plus jeune et contemporaine de chocolats bean-to-bar, fabriquée au Havre par APG Cacao Févier.</p>
    </PageIntro>
    <section className="maison-signature" aria-label="APG Cacao Févier et Au Parrain Généreux">
      <Image src="/images/apg-au-parrain-genereux.jpg" alt="APG Cacao Févier et Au Parrain Généreux, deux savoir-faire havrais" width={1672} height={941} quality={95} sizes="(max-width: 900px) 90vw, 1200px" />
    </section>
    <SiteFooter />
  </main>;
}
