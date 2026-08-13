import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-chrome";

const chapters = [
  ["La collection", "Nos chocolats et confiseries maison", "/bonbons"],
  ["La Maison", "Une chocolaterie havraise depuis 1890", "/maison"],
  ["Le savoir-faire", "Notre manière de travailler", "/savoir-faire"],
  ["Nous trouver", "123 rue Maréchal Joffre · Le Havre", "/#nous-trouver"],
] as const;

export default function Home() {
  return <main className="heritage-home">
    <header className="heritage-header">
      <nav aria-label="Navigation principale">
        <Link href="/maison">La Maison</Link><Link href="/savoir-faire">Savoir-faire</Link>
        <Link className="heritage-header__logo" href="/" aria-label="Au Parrain Généreux — Accueil"><Image src="/images/logo-boutique-le-havre-v4-transparent.png" alt="Au Parrain Généreux, Le Havre" width={280} height={280} priority /></Link>
        <Link href="/bonbons">Les chocolats</Link><Link href="#nous-trouver">Nous trouver</Link>
      </nav>
    </header>

    <section className="heritage-map heritage-map--top" id="nous-trouver">
      <div><p>La boutique au Havre</p><h2>Venez nous rencontrer</h2><span/><p>Nous vous accueillons en boutique pour vous faire découvrir nos chocolats, nos confiseries et les recettes de la maison.</p><address>123 rue Maréchal Joffre · 76600 Le Havre<br/>Du mardi au samedi · 9h–12h et 14h–19h<br/><a href="tel:+33235423275">02 35 42 32 75</a><br/><a href="mailto:genereuxparrain@gmail.com">genereuxparrain@gmail.com</a></address></div>
      <figure><Image src="/images/plan-boutique-le-havre-v4-transparent.png" alt="Plan simplifié dessiné à la main indiquant la boutique Au Parrain Généreux, 123 rue Maréchal Joffre au Havre" fill priority sizes="(max-width: 760px) 92vw, 520px" /></figure>
    </section>

    <section className="heritage-intro">
      <p>Chocolatier · Confiseur</p>
      <h1>Le chocolat artisanal,<br/>au cœur du Havre.</h1>
      <div className="heritage-intro__story">
        <figure><Image src="/images/boutique-historique.jpeg" alt="La boutique historique Au Parrain Généreux" fill priority sizes="(max-width: 760px) 82vw, 390px" /></figure>
        <div><p>Depuis 1890</p><h2>Fidèles à notre manière de faire</h2><span/>
          <p>Nous choisissons de bons produits et accordons la même attention à chaque étape. Nos chocolats et nos confiseries sont préparés avec soin, dans le respect des recettes et de l’identité de la maison.</p>
          <Link href="/maison">Découvrir notre histoire</Link>
        </div>
      </div>
    </section>

    <section className="heritage-chapters" aria-labelledby="chapters-title">
      <p>Découvrir la maison</p><h2 id="chapters-title">Ce que nous faisons</h2>
      <div>{chapters.map(([title, subtitle, href]) => <Link href={href} key={href}><h3>{title}</h3><p>{subtitle}</p><span>Découvrir →</span></Link>)}</div>
    </section>

    <section className="heritage-feature">
      <div><p>La collection maison</p><h2>Des recettes qui nous ressemblent</h2><span/><p>Pralinés, gianduja, pâtes d’amande et confiseries sont préparés dans notre atelier. Découvrez ici une partie de la collection, et retrouvez l’ensemble de nos créations en boutique.</p><Link href="/bonbons">Voir les bonbons</Link></div>
      <figure><Image src="/images/bonbons-editorial-transparent.png" alt="Bonbons de chocolat de la Maison" fill sizes="(max-width: 760px) 82vw, 430px" /></figure>
    </section>
    <SiteFooter />
  </main>;
}
