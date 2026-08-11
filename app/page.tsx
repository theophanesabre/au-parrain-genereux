import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const signatures = [
  { href: "/bonbons", image: "/images/bonbons/4.png", kicker: "Collection maison", title: "Les pralinés", text: "Des intérieurs fondants, des fruits secs torréfiés et un chocolat au caractère franc." },
  { href: "/creations", image: "/images/bonbons/5.png", kicker: "Créations", title: "Les incontournables", text: "Les recettes emblématiques de la Maison, façonnées en petites séries au Havre." },
  { href: "/savoir-faire", image: "/images/bonbons/13.png", kicker: "Héritage", title: "Le savoir-faire", text: "Orangettes, nougats et confiseries perpétuent des gestes précis et généreux." },
];

export default function Home() {
  return <main className="white-site vever-home">
    <SiteHeader />

    <Link className="vever-hero" href="/maison" aria-label="Découvrir l’histoire de la Maison">
      <Image src="/images/boutique-historique.jpeg" alt="La boutique historique Au Parrain Généreux, rue de Paris au Havre" fill priority quality={95} sizes="100vw" />
      <div><p>Le Havre · Depuis 1890</p><h1>Une maison de goût.</h1><span>Découvrir notre histoire</span></div>
    </Link>

    <section className="vever-intro">
      <p>Chocolatier confiseur</p>
      <h2>Chocolats d’art et de générosité depuis 1890</h2>
      <div className="vever-rule" />
      <p className="vever-intro__text">Au Parrain Généreux imagine au Havre des chocolats sincères, travaillés avec patience et conçus pour être partagés.</p>
    </section>

    <section className="vever-features">{signatures.map((item, index) =>
      <Link className="vever-feature" href={item.href} key={item.title}>
        <div className="vever-feature__image"><Image src={item.image} alt="" fill quality={95} sizes="(max-width: 760px) 100vw, 50vw" /></div>
        <div className="vever-feature__copy"><p>{item.kicker}</p><h2>{item.title}</h2><div className="vever-rule"/><p className="vever-feature__text">{item.text}</p><span>Découvrir</span></div>
      </Link>
    )}</section>

    <section className="vever-story"><p>La Maison</p><h2>Au cœur du Havre</h2><div className="vever-rule"/><p>Une chocolaterie patrimoniale attachée aux belles matières, aux recettes lisibles et au plaisir d’offrir.</p><Link href="/maison">Plongez dans notre histoire</Link></section>

    <section className="simple-visit"><div><p className="eyebrow">La boutique</p><h2>Retrouvez-nous au Havre.</h2><p>Découvrez nos chocolats et composez votre coffret en boutique.</p></div><Link href="/boutique">Informations pratiques →</Link></section>
    <SiteFooter />
  </main>;
}
