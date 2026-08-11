import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const univers = [
  { href: "/bonbons", image: "/images/bonbons/4.png", label: "Pralinés", title: "Brut" },
  { href: "/creations", image: "/images/bonbons/5.png", label: "Créations", title: "Singulier" },
  { href: "/savoir-faire", image: "/images/bonbons/13.png", label: "Confiseries", title: "Vivant" },
];

export default function Home() {
  return <main className="white-site">
    <SiteHeader />
    <section className="editorial-hero">
      <div className="editorial-hero__copy">
        <p className="eyebrow">Chocolatier au Havre · Depuis 1985</p>
        <h1>L’instinct<br />généreux.</h1>
        <p className="hero-lead">Une maison artisanale où le chocolat se travaille avec franchise, patience et gourmandise.</p>
        <Link className="discover-link" href="/bonbons">Découvrir nos bonbons <span>→</span></Link>
      </div>
      <Link className="editorial-hero__visual" href="/bonbons" aria-label="Découvrir les bonbons de chocolat">
        <Image src="/images/bonbons/2.png" alt="Baiser d’Ange, bonbon de chocolat maison" fill priority sizes="(max-width: 900px) 100vw, 52vw" />
        <span>Collection maison — 01</span>
      </Link>
    </section>

    <section className="statement">
      <p>La maison</p>
      <h2>Le chocolat comme<br />matière d’émotion.</h2>
      <div><p>Des recettes lisibles. Des textures franches. Une fabrication en petites séries, au cœur du Havre.</p><Link href="/maison">Notre histoire →</Link></div>
    </section>

    <section className="univers-section">
      <header><p>Les sens de la création</p><h2>Trois façons<br />de succomber.</h2></header>
      <div className="univers-grid">{univers.map((item, index) =>
        <Link href={item.href} className="univers-card" key={item.title}>
          <div><Image src={item.image} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" /></div>
          <span>0{index + 1} — {item.label}</span><h3>{item.title}</h3><b>Explorer →</b>
        </Link>
      )}</div>
    </section>

    <section className="experience-panel"><div><p>Boutique</p><h2>Une expérience<br />au Havre.</h2><Link href="/boutique">Pousser la porte →</Link></div><div className="experience-mark">APG</div></section>
    <SiteFooter />
  </main>;
}
