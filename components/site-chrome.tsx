import Link from "next/link";

export function SiteHeader() {
  return <header className="site-header">
    <Link className="brand brand-logo" href="/" aria-label="Au Parrain Généreux — Accueil"><img src="/logo-au-parrain-genereux.png" alt="Au Parrain Généreux, chocolatier confiseur au Havre" /><small>Depuis 1890</small></Link>
    <nav aria-label="Navigation principale"><Link href="/bonbons">Chocolats</Link><Link href="/maison">La maison</Link><Link href="/savoir-faire">Savoir-faire</Link></nav>
    <Link className="location" href="/boutique">Boutique · Le Havre</Link>
  </header>;
}

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer__history"><p>Depuis 1890</p><h2>Une maison havraise</h2><p>Au Parrain Généreux perpétue au Havre une tradition de chocolaterie et de confiserie artisanales, guidée par la simplicité, le goût et le partage.</p></div>
    <div className="site-footer__useful">
      <nav aria-label="Liens de bas de page"><h3>Liens utiles</h3><Link href="/bonbons">Les chocolats</Link><Link href="/maison">La maison</Link><Link href="/savoir-faire">Le savoir-faire</Link><Link href="/boutique">La boutique</Link></nav>
      <address><h3>Contact</h3><span>Le Havre, Normandie</span><a href="mailto:bonjour@auparraingenereux.fr">bonjour@auparraingenereux.fr</a><Link href="/boutique">Horaires et accès</Link></address>
    </div>
    <p className="site-footer__legal">© 2026 Au Parrain Généreux</p>
  </footer>;
}

export function PageIntro({ index, kicker, title, children }: { index: string; kicker: string; title: string; children: React.ReactNode }) {
  return <header className="page-intro"><p className="section-index">{index} — {kicker}</p><h1>{title}</h1><div>{children}</div></header>;
}
