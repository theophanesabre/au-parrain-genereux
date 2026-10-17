import { getPageContent, getImageSources, getImageDescriptions } from "./site-data";
export async function SiteHeader() {
  const [imageSources,imageAlts]=await Promise.all([getImageSources(),getImageDescriptions()]);
  return <header className="site-header">
    <a className="brand brand-logo" href="/" aria-label="Au Parrain Généreux — Accueil"><img src={imageSources["/images/logo-boutique-neon.webp"] || "/images/logo-boutique-neon.webp"} alt={imageAlts["/images/logo-boutique-neon.webp"] || "Enseigne Au Parrain Généreux sur la façade de la boutique"} /></a>
    <nav aria-label="Navigation principale"><a href="/bonbons">Chocolats</a><a href="/maison">La maison</a><a href="/savoir-faire">Savoir-faire</a><a href="/#nous-trouver">Nous trouver</a></nav>
    <details className="mobile-menu">
      <summary aria-label="Ouvrir le menu"><span/><span/><span/></summary>
      <nav aria-label="Navigation mobile"><a href="/bonbons">Chocolats</a><a href="/maison">La maison</a><a href="/savoir-faire">Savoir-faire</a><a href="/#nous-trouver">Nous trouver</a><a href="https://www.instagram.com/au_parrain_genereux/" target="_blank" rel="noreferrer">Instagram</a></nav>
    </details>
  </header>;
}

export async function SiteFooter() {
  const content=await getPageContent("accueil");
  return <footer className="site-footer">
    <div className="site-footer__history"><p>Depuis 1890</p><h2>{content.footerTitle}</h2><p>{content.footerText}</p></div>
    <div className="site-footer__useful">
      <nav aria-label="Liens de bas de page"><h3>Liens utiles</h3><a href="/bonbons">Les chocolats</a><a href="/maison">La maison</a><a href="/savoir-faire">Le savoir-faire</a><a href="/#nous-trouver">Nous trouver</a><a href="https://www.instagram.com/au_parrain_genereux/" target="_blank" rel="noreferrer">Instagram</a></nav>
      <address><h3>Contact</h3><span>{content.address}<br/>{content.city}</span><span>{content.days}<br/>{content.hours}</span><a href={`tel:${content.phone.replace(/[^+0-9]/g, "")}`}>{content.phone}</a><a href={`mailto:${content.email}`}>{content.email}</a></address>
    </div>
    <p className="site-footer__legal">© 2026 Au Parrain Généreux</p>
  </footer>;
}

export function PageIntro({ index, kicker, title, children }: { index: string; kicker: string; title: string; children: React.ReactNode }) {
  return <header className="page-intro"><p className="section-index">{kicker}</p><h1>{title}</h1><div>{children}</div></header>;
}
