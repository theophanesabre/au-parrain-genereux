import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function Home() {
  return <main className="white-site vever-home focused-home">
    <SiteHeader />

    <section className="index-editorial">
      <Link className="index-editorial__image" href="/savoir-faire" aria-label="Découvrir notre savoir-faire"><Image src="/images/illustration-cabosse-fleur-v2.png" alt="Cabosse de cacao orange" fill priority quality={95} sizes="(max-width: 900px) 84vw, 560px" /></Link>
      <div className="index-editorial__copy"><p>Chocolatier confiseur · Le Havre</p><h1>Le goût du beau</h1><div className="index-editorial__rule"/><p>Depuis 1890, la Maison façonne des chocolats et confiseries où le geste artisanal rencontre l’élégance.</p><Link href="/savoir-faire">Découvrir</Link></div>
    </section>

    <section className="index-editorial index-editorial--chapter">
      <Link className="index-editorial__image" href="/maison" aria-label="Découvrir la Maison"><Image src="/images/boutique-historique.jpeg" alt="La boutique historique Au Parrain Généreux, rue de Paris au Havre" fill quality={95} sizes="(max-width: 900px) 84vw, 560px" /></Link>
      <div className="index-editorial__copy"><p>Depuis 1890</p><h2>La Maison</h2><div className="index-editorial__rule"/><p>Au cœur du Havre, Au Parrain Généreux cultive depuis plusieurs générations le goût des confiseries et des chocolats faits maison.</p><Link href="/maison">Découvrir notre histoire</Link></div>
    </section>

    <section className="index-editorial index-editorial--chapter">
      <Link className="index-editorial__image" href="/bonbons" aria-label="Découvrir les bonbons maison"><Image src="/images/bonbons-editorial.png" alt="Sélection de bonbons de chocolat maison" fill quality={95} sizes="(max-width: 900px) 84vw, 560px" /></Link>
      <div className="index-editorial__copy"><p>La collection maison</p><h2>Les bonbons</h2><div className="index-editorial__rule"/><p>Pralinés, pâtes d’amande, gianduja et confiseries composent une collection généreuse, façonnée dans notre atelier.</p><Link href="/bonbons">Voir la collection</Link></div>
    </section>
    <SiteFooter />
  </main>;
}
