export const BONBON_ID = 'bonbon';
export const BONBON_PRICE_CENTS_PER_KG = 10600;
export const isRecipe = id => typeof id === 'string' && id.startsWith('bonbon-');
export const defaultBonbon = {id:BONBON_ID,name:'Bonbon',description:'Assortiment de bonbons de chocolat de la maison.',price_cents:BONBON_PRICE_CENTS_PER_KG,stock:0,image:'',published:0,version:0};
export function productProfile(product) {
  if(isRecipe(product.id)){const {price_cents,stock,...recipe}=product;return {...recipe,kind:'recipe'};}
  return {...product,kind:'sale',unit:product.id===BONBON_ID?'kg':'piece'};
}
export function lineTotal(product, quantity) {
  return product.id===BONBON_ID ? Math.round(product.price_cents*quantity/1000) : product.price_cents*quantity;
}
