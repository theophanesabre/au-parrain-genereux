import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const bonbons = [
  { image: "/images/bonbons/2.png", name: "Baiser d’Ange" },
  { image: "/images/bonbons/4.png", name: "Rocher" },
  { image: "/images/bonbons/9.png", name: "Feuilletine" },
];

export default function Home() {
  return <main className="white-site vever-home focused-home">
    <SiteHeader />

    <section className="focused-hero">
      <Image src="/images/hero-chocolats.png" alt="Assortiment de chocolats artisanaux Au Parrain Généreux" fill priority quality={95} sizes="100vw" />
      <div><p>Chocolatier confiseur · Le Havre</p><h1>Le goût du beau.</h1><Link href="/bonbons">Découvrir nos chocolats</Link></div>
    </section>

    <section className="focused-house">
      <div className="focused-house__copy"><p>Depuis 1890</p><h2>La Maison</h2><div className="vever-rule"/><p>Au cœur du Havre, Au Parrain Généreux cultive depuis plusieurs générations le goût des confiseries et des chocolats faits maison.</p><Link href="/maison">Découvrir notre histoire</Link></div>
      <Link className="focused-house__image" href="/maison" aria-label="Découvrir la Maison"><Image src="/images/boutique-historique.jpeg" alt="La boutique historique Au Parrain Généreux au Havre" fill quality={95} sizes="(max-width: 800px) 100vw, 50vw" /></Link>
    </section>

    <section className="focused-bonbons">
      <header><p>La collection maison</p><h2>Les bonbons</h2><div className="vever-rule"/><p>Pralinés, pâtes d’amande, gianduja et confiseries composent une collection généreuse, façonnée dans notre atelier.</p></header>
      <div className="focused-bonbons__grid">{bonbons.map((item) => <Link href="/bonbons" key={item.name}><div><Image src={item.image} alt={item.name} fill quality={95} sizes="(max-width: 650px) 100vw, 33vw" /></div><span>{item.name}</span></Link>)}</div>
      <Link className="focused-bonbons__link" href="/bonbons">Voir toute la collection</Link>
    </section>
    <SiteFooter />
  </main>;
}
