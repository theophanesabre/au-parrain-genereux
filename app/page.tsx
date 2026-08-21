import Image from "next/image";
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
      <nav className="heritage-header__desktop-nav" aria-label="Navigation principale">
        <a href="/maison">La Maison</a><a href="/savoir-faire">Savoir-faire</a>
        <a className="heritage-header__logo" href="/" aria-label="Au Parrain Généreux — Accueil"><Image src="/images/logo-boutique-neon.webp" alt="Enseigne Au Parrain Généreux sur la façade de la boutique" width={1536} height={1024} priority /></a>
        <a href="/bonbons">Les chocolats</a><a href="#nous-trouver">Nous trouver</a>
      </nav>
      <details className="heritage-mobile-menu">
        <summary aria-label="Ouvrir le menu" title="Menu"><span /><span /><span /></summary>
        <nav className="heritage-mobile-menu__nav" aria-label="Navigation mobile">
          <a href="/maison">La Maison</a>
          <a href="/savoir-faire">Savoir-faire</a>
          <a href="/bonbons">Les chocolats</a>
          <a href="#nous-trouver">Nous trouver</a>
          <a href="https://www.instagram.com/au_parrain_genereux/" target="_blank" rel="noreferrer">Instagram</a>
        </nav>
      </details>
    </header>

    <section className="heritage-map heritage-map--top" id="nous-trouver">
      <div><p>La boutique au Havre</p><h2>Venez nous rencontrer</h2><span/><p>Nous vous accueillons en boutique pour vous faire découvrir nos chocolats, nos confiseries et les recettes de la maison.</p><address>123 rue Maréchal Joffre · 76600 Le Havre<br/>Du mardi au samedi · 9h–12h et 14h–19h<br/><a href="tel:+33235423275">02 35 42 32 75</a><br/><a href="mailto:genereuxparrain@gmail.com">genereuxparrain@gmail.com</a></address><div className="heritage-map__social" aria-label="Réseaux sociaux"><a href="https://www.instagram.com/au_parrain_genereux/" target="_blank" rel="noreferrer" aria-label="Instagram"><svg className="social-icon social-icon--instagram" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg><span>Instagram</span></a><a href="https://www.facebook.com/chocolatier.auparraingenereux/?locale=fr_FR" target="_blank" rel="noreferrer" aria-label="Facebook"><svg className="social-icon social-icon--facebook" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 8.2h2.2V5.1c-.4-.1-1.5-.2-2.8-.2-2.8 0-4.7 1.7-4.7 4.8v2.7H6v3.5h2.9V22h3.6v-6.1h3l.5-3.5h-3.5V10c0-1 .3-1.8 1.7-1.8Z"/></svg><span>Facebook</span></a></div></div>
      <figure><Image src="/images/plan-boutique-le-havre-v4-transparent.png" alt="Plan simplifié dessiné à la main indiquant la boutique Au Parrain Généreux, 123 rue Maréchal Joffre au Havre" fill priority sizes="(max-width: 760px) 92vw, 520px" /></figure>
    </section>

    <section className="heritage-intro">
      <p>Chocolatier · Confiseur</p>
      <h1>Le chocolat artisanal,<br/>au cœur du Havre.</h1>
      <div className="heritage-intro__story">
        <figure><Image src="/images/boutique-historique.jpeg" alt="La boutique historique Au Parrain Généreux" fill priority sizes="(max-width: 760px) 82vw, 390px" /></figure>
        <div><p>Depuis 1890</p><h2>Fidèles à notre manière de faire</h2><span/>
          <p>Nous choisissons de bons produits et accordons la même attention à chaque étape. Nos chocolats et confiseries sont préparés avec soin, dans le respect des recettes et de l’identité de la maison.</p>
          <a href="/maison">Découvrir notre histoire</a>
        </div>
      </div>
    </section>

    <section className="heritage-chapters" aria-labelledby="chapters-title">
      <p>Découvrir la maison</p><h2 id="chapters-title">Ce que nous faisons</h2>
      <div>{chapters.map(([title, subtitle, href]) => <a href={href} key={href}><h3>{title}</h3><p>{subtitle}</p><span>Découvrir →</span></a>)}</div>
    </section>

    <section className="heritage-feature">
      <div><p>La collection maison</p><h2>Des recettes qui nous ressemblent</h2><span/><p>Pralinés, gianduja, pâtes d’amande et confiseries sont préparés dans notre atelier. Découvrez ici une partie de la collection, et retrouvez l’ensemble de nos créations en boutique.</p><a href="/bonbons">Voir les bonbons</a></div>
      <figure><Image src="/images/bonbons-editorial-deep.webp" alt="Bonbons de chocolat de la Maison photographiés dans l’atelier" fill sizes="(max-width: 760px) 82vw, 430px" /></figure>
    </section>
    <SiteFooter />
  </main>;
}
