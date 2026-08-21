export function SiteHeader() {
  return <header className="site-header">
    <a className="brand brand-logo" href="/" aria-label="Au Parrain Généreux — Accueil"><img src="/images/logo-boutique-neon.webp" alt="Enseigne Au Parrain Généreux sur la façade de la boutique" /></a>
    <nav aria-label="Navigation principale"><a href="/bonbons">Chocolats</a><a href="/maison">La maison</a><a href="/savoir-faire">Savoir-faire</a><a href="/#nous-trouver">Nous trouver</a></nav>
    <details className="mobile-menu">
      <summary aria-label="Ouvrir le menu"><span/><span/><span/></summary>
      <nav aria-label="Navigation mobile"><a href="/bonbons">Chocolats</a><a href="/maison">La maison</a><a href="/savoir-faire">Savoir-faire</a><a href="/#nous-trouver">Nous trouver</a><a href="https://www.instagram.com/au_parrain_genereux/" target="_blank" rel="noreferrer">Instagram</a></nav>
    </details>
  </header>;
}

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer__history"><p>Depuis 1890</p><h2>Une chocolaterie havraise</h2><p>Nous choisissons de bons produits et cultivons un savoir-faire attentif, fidèle aux recettes et à l’identité de la maison.</p></div>
    <div className="site-footer__useful">
      <nav aria-label="Liens de bas de page"><h3>Liens utiles</h3><a href="/bonbons">Les chocolats</a><a href="/maison">La maison</a><a href="/savoir-faire">Le savoir-faire</a><a href="/#nous-trouver">Nous trouver</a><a href="https://www.instagram.com/au_parrain_genereux/" target="_blank" rel="noreferrer">Instagram</a></nav>
      <address><h3>Contact</h3><span>123 rue Maréchal Joffre<br/>76600 Le Havre</span><span>Du mardi au samedi<br/>9h–12h · 14h–19h</span><a href="tel:+33235423275">02 35 42 32 75</a><a href="mailto:genereuxparrain@gmail.com">genereuxparrain@gmail.com</a></address>
    </div>
    <p className="site-footer__legal">© 2026 Au Parrain Généreux</p>
  </footer>;
}

export function PageIntro({ index, kicker, title, children }: { index: string; kicker: string; title: string; children: React.ReactNode }) {
  return <header className="page-intro"><p className="section-index">{kicker}</p><h1>{title}</h1><div>{children}</div></header>;
}
