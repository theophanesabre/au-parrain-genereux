import type { Metadata } from "next";
import "./globals.css";
import "./gallery.css";
import "./multipage.css";

export const metadata: Metadata = {
  title: "Au Parrain Généreux | Chocolaterie artisanale au Havre",
  description: "Chocolaterie artisanale au Havre depuis 1890. Des recettes maison préparées avec de bons produits et un savoir-faire attentif.",
  openGraph: { title: "Au Parrain Généreux", description: "Le chocolat en héritage.", images: ["/og.png"], locale: "fr_FR", type: "website" },
  twitter: { card: "summary_large_image", title: "Au Parrain Généreux", description: "Le chocolat en héritage.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><head><link rel="stylesheet" href="/styles/globals.css"/><link rel="stylesheet" href="/styles/gallery.css"/><link rel="stylesheet" href="/styles/multipage.css"/></head><body>{children}</body></html>;
}
