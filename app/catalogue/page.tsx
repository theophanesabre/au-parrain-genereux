import {env} from 'cloudflare:workers';
import {SiteHeader,SiteFooter} from '@/components/site-chrome';
import {ChocolateBook} from '@/components/catalogue/book';
import {readCreations} from '@/catalogue/model.mjs';
import {readFormats} from '@/catalogue/service.mjs';
import './catalogue.css';
export const dynamic='force-dynamic';
export const metadata={title:'Le catalogue & votre ballotin | Au Parrain Généreux',description:'Feuilletez la collection de la maison et imaginez un ballotin selon vos envies.'};
export default async function Catalogue(){const [creations,formats]=await Promise.all([readCreations(env.DB),readFormats(env.DB)]);return <><SiteHeader/><main><ChocolateBook creations={creations} formats={formats}/></main><SiteFooter/></>;}
