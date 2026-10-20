import { publishedPuckPage } from "@/components/puck/published";
import { HomeSections, HomeButton, PageButtons, StoreHeader, ContactCard } from "@/components/appearance";
import { SpotlightCarousel, NewsRail } from "@/components/home-highlights";
import { getPageContent, getImageSources, getImageDescriptions, getHighlights } from "@/components/site-data";
import { getManagedPage, ManagedPage } from "@/components/managed-page";
import Image from "next/image";
import { SiteFooter } from "@/components/site-chrome";

const chapters = [
  ["La collection", "Nos chocolats et confiseries maison", "/maison#nos-recettes"],
  ["La Maison", "Une chocolaterie havraise depuis 1890", "/maison"],
  ["Le savoir-faire", "Notre manière de travailler", "/maison#savoir-faire"],
  ["Nous trouver", "123 rue Maréchal Joffre · Le Havre", "/#nous-trouver"],
] as const;

export const dynamic = "force-dynamic";
export default async function Home() {
  const puck=await publishedPuckPage("/");if(puck)return puck;

  const [managed,content,imageSources,imageAlts,highlights] = await Promise.all([getManagedPage("accueil"),getPageContent("accueil"),getImageSources(),getImageDescriptions(),getHighlights()]);
  const slides=highlights.map(item=>({...item,image:imageSources[item.image]||item.image,alt:imageAlts[item.image]||item.alt}));
  if (managed) return <ManagedPage page={managed}/>;
  return <main className="heritage-home">
    <StoreHeader logo={imageSources["/images/logo-medaillon-orange-transparent.webp"] || "/images/logo-medaillon-orange-transparent.webp"}/>


    <PageButtons location="page-top"/>
    <HomeSections sections={[
{id:'spotlight',content:(<><SpotlightCarousel items={slides.filter(item=>item.placement==='hero')} label={content.spotlightLabel}/></>)},
{id:'news',content:(<><NewsRail items={slides.filter(item=>item.placement==='news')} title={content.newsTitle} kicker={content.newsKicker} intro={content.newsIntro}/></>)},
{id:'visit',content:(<><section className="heritage-map heritage-map--top" id="nous-trouver">
      <div><ContactCard address={[content.address,content.city].filter(Boolean).join(' · ')} hours={[content.days,content.hours].filter(Boolean).join(' · ')} phone={content.phone} email={content.email}/><div className="heritage-map__social" aria-label="Réseaux sociaux"><a href="https://www.instagram.com/au_parrain_genereux/" target="_blank" rel="noreferrer" aria-label="Instagram"><svg className="social-icon social-icon--instagram" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg><span>Instagram</span></a><a href="https://www.facebook.com/chocolatier.auparraingenereux/?locale=fr_FR" target="_blank" rel="noreferrer" aria-label="Facebook"><svg className="social-icon social-icon--facebook" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 8.2h2.2V5.1c-.4-.1-1.5-.2-2.8-.2-2.8 0-4.7 1.7-4.7 4.8v2.7H6v3.5h2.9V22h3.6v-6.1h3l.5-3.5h-3.5V10c0-1 .3-1.8 1.7-1.8Z"/></svg><span>Facebook</span></a></div></div>
      <figure><Image src={imageSources["/images/plan-boutique-le-havre-v4-transparent.png"] || "/images/plan-boutique-le-havre-v4-transparent.png"} alt={imageAlts["/images/plan-boutique-le-havre-v4-transparent.png"] || "Plan simplifié dessiné à la main indiquant la boutique Au Parrain Généreux, 123 rue Maréchal Joffre au Havre"} fill priority sizes="(max-width: 760px) 92vw, 520px" /></figure>
    </section></>)},
{id:'history',content:(<><section className="heritage-intro">
      <p>{content.heroKicker}</p>
      <h1 style={{whiteSpace:"pre-line"}}>{content.heroTitle}</h1>
      <div className="heritage-intro__story">
        <figure><Image src={imageSources["/images/boutique-historique.jpeg"] || "/images/boutique-historique.jpeg"} alt={imageAlts["/images/boutique-historique.jpeg"] || "La boutique historique Au Parrain Généreux"} fill priority sizes="(max-width: 760px) 82vw, 390px" /></figure>
        <div><p>{content.historyKicker}</p><h2>{content.historyTitle}</h2><span/>
          <p>{content.historyText}</p>
          <HomeButton kind="history"/>
        </div>
      </div>
    </section></>)},
{id:'chapters',content:(<><section className="heritage-chapters" aria-labelledby="chapters-title">
      <p>{content.chaptersKicker}</p><h2 id="chapters-title">{content.chaptersTitle}</h2>
      <div>{chapters.map(([title, subtitle, href], index) => <a href={href} key={href}><h3>{content[`chapter${index+1}Title`] || title}</h3><p>{content[`chapter${index+1}Subtitle`] || subtitle}</p><span>Découvrir →</span></a>)}</div>
    </section></>)},
{id:'collection',content:(<><section className="heritage-feature">
      <div><p>{content.collectionKicker}</p><h2>{content.collectionTitle}</h2><span/><p>{content.collectionText}</p><HomeButton kind="collection"/></div>
      <figure><Image src={imageSources["/images/bonbons-editorial-deep.webp"] || "/images/bonbons-editorial-deep.webp"} alt={imageAlts["/images/bonbons-editorial-deep.webp"] || "Bonbons de chocolat de la Maison photographiés dans l’atelier"} fill sizes="(max-width: 760px) 82vw, 430px" /></figure>
    </section></>)}
]}/>
    <SiteFooter />
  </main>;
}
