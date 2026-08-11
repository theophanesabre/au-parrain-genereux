import Link from "next/link";

export function SiteHeader() {
  return <header className="site-header">
    <Link className="brand brand-logo" href="/" aria-label="Au Parrain Généreux — Accueil"><img src="/logo-au-parrain-genereux.png" alt="Au Parrain Généreux, chocolatier confiseur au Havre" /></Link>
    <nav aria-label="Navigation principale"><Link href="/bonbons">Chocolats</Link><Link href="/maison">La maison</Link><Link href="/savoir-faire">Savoir-faire</Link><Link href="/creations">Créations</Link></nav>
    <Link className="location" href="/boutique">Boutique · Le Havre</Link>
  </header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-brand"><span>Au Parrain</span><strong>Généreux</strong></div><p>Chocolaterie artisanale au Havre</p><div><Link href="/boutique">Nous trouver</Link><span>© 2026</span></div></footer>;
}

export function PageIntro({ index, kicker, title, children }: { index: string; kicker: string; title: string; children: React.ReactNode }) {
  return <header className="page-intro"><p className="section-index">{index} — {kicker}</p><h1>{title}</h1><div>{children}</div></header>;
}
