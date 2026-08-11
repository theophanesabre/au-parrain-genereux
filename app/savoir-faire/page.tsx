import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function SavoirFaire() {
  return <main className="inner-page focused-home savoir-faire-editorial">
    <SiteHeader />

    <section className="index-editorial">
      <div className="index-editorial__image"><Image src="/images/illustration-cabosse-fleur-v2.png" alt="Cabosse de cacao orange" fill priority quality={95} sizes="(max-width: 900px) 84vw, 560px" /></div>
      <div className="index-editorial__copy"><p>Le savoir-faire</p><h1>Le goût commence par le choix</h1><div className="index-editorial__rule"/><p>Nous sélectionnons des matières premières de qualité pour leur goût juste et leur fraîcheur : noisettes du Piémont, amandes soigneusement choisies et fruits travaillés au rythme des saisons.</p></div>
    </section>

    <section className="index-editorial index-editorial--chapter">
      <div className="index-editorial__image index-editorial__image--product"><Image src="/images/bonbons-nettoyes/3.png" alt="Bonbon de chocolat maison" fill quality={95} sizes="(max-width: 900px) 84vw, 560px" /></div>
      <div className="index-editorial__copy"><p>La matière</p><h2>Les chocolats Cacao Barry</h2><div className="index-editorial__rule"/><p>Nous travaillons les couvertures Cacao Barry pour leur richesse aromatique et leur régularité. Tempérage, enrobage et repos sont conduits avec précision afin d’obtenir une coque fine, un brillant naturel et une fonte délicate.</p><Link href="/bonbons">Découvrir les bonbons</Link></div>
    </section>

    <section className="index-editorial index-editorial--chapter">
      <div className="index-editorial__image index-editorial__image--product"><Image src="/images/bonbons-nettoyes/13.png" alt="Confiseries aux fruits réalisées dans notre atelier" fill quality={95} sizes="(max-width: 900px) 84vw, 560px" /></div>
      <div className="index-editorial__copy"><p>Dans notre atelier</p><h2>Les gourmandises maison</h2><div className="index-editorial__rule"/><p>Pâtes de fruits, pâtes à tartiner et caramels sont préparés dans notre atelier. Nous cuisons doucement les fruits, torréfions les fruits secs et surveillons chaque texture pour préserver des saveurs franches et généreuses.</p><Link href="/boutique">Découvrir la boutique</Link></div>
    </section>

    <SiteFooter />
  </main>;
}
