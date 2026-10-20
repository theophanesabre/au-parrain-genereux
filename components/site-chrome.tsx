import { PageButtons, StoreHeader, StoreFooter } from "./appearance";
import { getPageContent, getImageSources } from "./site-data";
export async function SiteHeader() {
  const imageSources=await getImageSources();
  return <><StoreHeader logo={imageSources["/images/logo-medaillon-orange-transparent.webp"] || "/images/logo-medaillon-orange-transparent.webp"}/><PageButtons location="page-top"/></>;
}

export async function SiteFooter() {
  const content=await getPageContent("accueil");
  return <><PageButtons location="page-bottom"/><StoreFooter title={content.footerTitle} text={content.footerText} address={[content.address,content.city].filter(Boolean).join(' · ')} hours={[content.days,content.hours].filter(Boolean).join(' · ')} phone={content.phone} email={content.email}/></>;
}

export function PageIntro({ index, kicker, title, children }: { index: string; kicker: string; title: string; children: React.ReactNode }) {
  return <header className="page-intro"><p className="section-index">{kicker}</p><h1>{title}</h1><div>{children}</div></header>;
}
