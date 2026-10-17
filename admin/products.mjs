export const BONBON_ID = 'bonbon';
export const isRecipe = id => typeof id === 'string' && id.startsWith('bonbon-');
export const isSale = id => id!==BONBON_ID && !isRecipe(id);
export function productProfile(product) {
  if(isRecipe(product.id)){const {price_cents,stock,...recipe}=product;return {...recipe,kind:'recipe'};}
  if(product.id===BONBON_ID)return {...product,kind:'retired',published:0};
  return {...product,kind:'sale',unit:'piece'};
}
export function lineTotal(product, quantity) { return product.price_cents*quantity; }

export async function getStoreProduct(db,id) {
  if(!db||typeof id!=='string'||id.length>100||!isSale(id))return null;
  return db.prepare('SELECT id,name,description,price_cents,stock,image,weight,conservation,ingredients,allergens FROM products WHERE id=? AND published=1 AND price_cents>0').bind(id).first();
}
