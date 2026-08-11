import Image from "next/image";
import { bonbons } from "@/data/bonbons";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function Bonbons(){return <main className="inner-page"><SiteHeader/><PageIntro index="04" kicker="La collection maison" title="Les bonbons de chocolat."><p>Pralinés, pâtes d’amande, gianduja et confiseries : quinze recettes emblématiques de la maison.</p></PageIntro><section className="bonbon-grid standalone">{bonbons.map((name,index)=><figure key={name}><Image src={`/images/bonbons-collection/${index+1}.png`} alt={`${name}, bonbon de chocolat maison`} width={1086} height={1448} quality={95} sizes="(max-width: 620px) 50vw, (max-width: 980px) 33vw, 20vw"/><figcaption><span>{String(index+1).padStart(2,"0")}</span><strong>{name}</strong></figcaption></figure>)}</section><SiteFooter/></main>}
