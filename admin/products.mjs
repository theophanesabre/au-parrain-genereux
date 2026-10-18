import {imagePath,HttpError} from './core.mjs';
export const BONBON_ID = 'bonbon';
export const isRecipe = id => typeof id === 'string' && id.startsWith('bonbon-');
export const isSale = id => id!==BONBON_ID && !isRecipe(id);
export function productProfile(product) {
  if(isRecipe(product.id)){const {price_cents,stock,...recipe}=product;return {...recipe,kind:'recipe'};}
  if(product.id===BONBON_ID)return {...product,kind:'retired',published:0};
  return {...product,images:productGallery(product),kind:'sale',unit:'piece'};
}
export function lineTotal(product, quantity) { return product.price_cents*quantity; }

export async function getStoreProduct(db,id) {
  if(!db||typeof id!=='string'||id.length>100||!isSale(id))return null;
  return db.prepare('SELECT id,name,description,price_cents,stock,image,images,weight,conservation,ingredients,allergens FROM products WHERE id=? AND published=1 AND archived=0 AND price_cents>0').bind(id).first();
}

export function validateProductImages(images){
 if(!Array.isArray(images)||images.length>12)throw new HttpError(400,'Choisissez 12 photos maximum par article');
 return [...new Set(images.map(value=>{if(!value)throw new HttpError(400,'Photo invalide');return imagePath(value);} ))];
}
export function productGallery(product){
 let images=[];try{images=typeof product.images==='string'?JSON.parse(product.images):product.images||[];images=validateProductImages(images);}catch{images=[];}
 return [...new Set([product.image,...images].filter(Boolean))].slice(0,12);
}
