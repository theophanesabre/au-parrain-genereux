import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function Home() {
  return <main className="white-site vever-home focused-home">
    <SiteHeader />

    <section className="index-editorial">
      <Link className="index-editorial__image" href="/savoir-faire" aria-label="Découvrir notre savoir-faire"><Image src="/images/illustration-cabosse-fleur-v2.png" alt="Cabosse et fleur de cacaoyer" fill priority quality={95} sizes="(max-width: 900px) 84vw, 560px" /></Link>
      <div className="index-editorial__copy"><p>Chocolatier confiseur · Le Havre</p><h1>Le goût du beau</h1><div className="index-editorial__rule"/><p>Depuis 1890, la Maison façonne des chocolats et confiseries où le geste artisanal rencontre l’élégance.</p><Link href="/savoir-faire">Découvrir</Link></div>
    </section>

    <section className="focused-house">
      <div className="focused-house__copy"><p>Depuis 1890</p><h2>La Maison</h2><div className="vever-rule"/><p>Au cœur du Havre, Au Parrain Généreux cultive depuis plusieurs générations le goût des confiseries et des chocolats faits maison.</p><Link href="/maison">Découvrir notre histoire</Link></div>
      <Link className="focused-house__image" href="/maison" aria-label="Découvrir la Maison"><Image src="/images/boutique-historique.jpeg" alt="La boutique historique Au Parrain Généreux au Havre" fill quality={95} sizes="(max-width: 800px) 84vw, 430px" /></Link>
    </section>

    <section className="focused-bonbons focused-bonbons--feature">
      <Link className="focused-bonbons__image" href="/bonbons" aria-label="Découvrir les bonbons maison"><Image src="/images/bonbons/4.png" alt="Rocher, bonbon de chocolat maison" fill quality={95} sizes="(max-width: 800px) 84vw, 430px" /></Link>
      <div className="focused-bonbons__copy"><p>La collection maison</p><h2>Les bonbons</h2><div className="vever-rule"/><p>Pralinés, pâtes d’amande, gianduja et confiseries composent une collection généreuse, façonnée dans notre atelier.</p><Link className="focused-bonbons__link" href="/bonbons">Voir toute la collection</Link></div>
    </section>
    <SiteFooter />
  </main>;
}
