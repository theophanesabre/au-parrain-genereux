import { PageSections } from "@/components/appearance";
import { getPageContent, getImageSources, getImageDescriptions } from "@/components/site-data";
import { getManagedPage, ManagedPage } from "@/components/managed-page";
import Image from "next/image";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";

export const dynamic = "force-dynamic";
export default async function Maison() {
  const [managed,content,imageSources,imageAlts] = await Promise.all([getManagedPage("maison"),getPageContent("maison"),getImageSources(),getImageDescriptions()]);
  if (managed) return <ManagedPage page={managed}/>;
  return <main className="inner-page maison-page">
    <SiteHeader />
    <PageSections page="/maison" items={[
{id:'intro',content:(<><PageIntro index="01" kicker={content.kicker} title={content.title}>
      <p>{content.intro}</p>
    </PageIntro></>)},
{id:'signature',content:(<><section className="maison-signature" aria-label="APG Cacao Févier et Au Parrain Généreux">
      <Image src={imageSources["/images/apg-au-parrain-genereux-transparent.png"] || "/images/apg-au-parrain-genereux-transparent.png"} alt={imageAlts["/images/apg-au-parrain-genereux-transparent.png"] || "APG Cacao Févier et Au Parrain Généreux, deux savoir-faire havrais"} width={1672} height={941} quality={95} sizes="(max-width: 900px) 90vw, 1200px" />
    </section></>)}
]}/>
    <SiteFooter />
  </main>;
}
