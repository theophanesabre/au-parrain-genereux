import { SiteHeader, SiteFooter, PageIntro } from '@/components/site-chrome';
import { CartPage } from '@/components/cart';
export const dynamic='force-dynamic';
export const metadata={title:'Mon panier | Au Parrain Généreux',robots:{index:false,follow:false}};
export default function Basket(){return <main className="inner-page"><SiteHeader/><PageIntro index="06" kicker="Vos gourmandises" title="Mon panier."><p>Retrouvez votre sélection et ajustez vos quantités avant de passer commande.</p></PageIntro><CartPage/><SiteFooter/></main>;}
