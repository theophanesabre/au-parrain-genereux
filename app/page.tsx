import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const univers = [
  { href: "/bonbons", image: "/images/bonbons/4.png", label: "Collection", title: "Les pralinés" },
  { href: "/creations", image: "/images/bonbons/5.png", label: "Maison", title: "Les créations" },
  { href: "/savoir-faire", image: "/images/bonbons/13.png", label: "Héritage", title: "Les confiseries" },
];

export default function Home() {
  return <main className="white-site vever-inspired">
    <SiteHeader />
    <section className="editorial-hero">
      <div className="editorial-hero__copy">
        <p className="eyebrow">Maison de chocolat · Le Havre</p>
        <h1>Le goût<br />du beau.</h1>
        <p className="hero-lead">Des chocolats maison façonnés avec patience, élégance et générosité.</p>
        <Link className="discover-link" href="/bonbons">Découvrir nos bonbons <span>→</span></Link>
      </div>
      <Link className="editorial-hero__visual" href="/bonbons" aria-label="Découvrir les bonbons de chocolat">
        <Image src="/images/bonbons/2.png" alt="Baiser d’Ange, bonbon de chocolat maison" fill priority sizes="(max-width: 900px) 100vw, 52vw" />
        <span>Collection maison — 01</span>
      </Link>
    </section>

    <section className="univers-section">
      <header><p>Nos signatures</p><h2>Les créations<br />de la Maison.</h2></header>
      <div className="univers-grid">{univers.map((item, index) =>
        <Link href={item.href} className="univers-card" key={item.title}>
          <div><Image src={item.image} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" /></div>
          <span>0{index + 1} — {item.label}</span><h3>{item.title}</h3><b>Explorer →</b>
        </Link>
      )}</div>
    </section>

    <section className="simple-visit"><div><p className="eyebrow">La boutique</p><h2>Retrouvez-nous au Havre.</h2><p>Découvrez nos chocolats et composez votre coffret en boutique.</p></div><Link href="/boutique">Informations pratiques →</Link></section>
    <SiteFooter />
  </main>;
}
