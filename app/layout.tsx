import { AppearanceShell } from "@/components/appearance";
import { getAppearance } from "@/components/site-data";
import { CartProvider } from "@/components/cart";
import type { Metadata } from "next";
import "./globals.css";
import "./gallery.css";
import "./multipage.css";
import "./highlights.css";
import "./cart.css";
import "./appearance.css";

export const metadata: Metadata = {
  title: "Au Parrain Généreux | Chocolaterie artisanale au Havre",
  description:
    "Chocolaterie artisanale au Havre depuis 1890. Des recettes maison préparées avec de bons produits et un savoir-faire attentif.",
  openGraph: {
    title: "Au Parrain Généreux",
    description: "Le chocolat en héritage.",
    images: ["/og.png"],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Au Parrain Généreux",
    description: "Le chocolat en héritage.",
    images: ["/og.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const appearance=await getAppearance();
  return (
    <html lang="fr">
      <body><AppearanceShell initial={appearance}><CartProvider>{children}</CartProvider></AppearanceShell></body>
    </html>
  );
}