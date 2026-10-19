import {imagePath,HttpError} from './core.mjs';
export const BONBON_ID = 'bonbon';
export const isRecipe = id => typeof id === 'string' && id.startsWith('bonbon-');
export const isSale = id => id!==BONBON_ID && !isRecipe(id);
export function productProfile(product) {
  if(isRecipe(product.id)){const {price_cents,stock,...recipe}=product;return {...recipe,kind:'recipe'};}
  if(product.id===BONBON_ID)return {...product,kind:'retired',published:0};
  return {...product,images:productGallery(product),photo_crops:productPhotoCrops(product),kind:'sale',unit:'piece'};
}
export function lineTotal(product, quantity) { return product.price_cents*quantity; }

export async function getStoreProduct(db,id) {
  if(!db||typeof id!=='string'||id.length>100||!isSale(id))return null;
  return db.prepare('SELECT id,name,description,price_cents,stock,image,images,photo_crops,weight,conservation,ingredients,allergens,food_name,nutrition FROM products WHERE id=? AND published=1 AND archived=0 AND price_cents>0').bind(id).first();
}

export function validateProductImages(images){
 if(!Array.isArray(images)||images.length>12)throw new HttpError(400,'Choisissez 12 photos maximum par article');
 return [...new Set(images.map(value=>{if(!value)throw new HttpError(400,'Photo invalide');return imagePath(value);} ))];
}
export function productGallery(product){
 let images=[];try{images=typeof product.images==='string'?JSON.parse(product.images):product.images||[];images=validateProductImages(images);}catch{images=[];}
 return [...new Set([product.image,...images].filter(Boolean))].slice(0,12);
}

export function validatePhotoCrops(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>12)throw new HttpError(400,'Réglages des photos invalides');
 return Object.fromEntries(Object.entries(value).map(([src,crop])=>{
  if(!src)throw new HttpError(400,'Photo invalide');imagePath(src);
  if(!crop||typeof crop!=='object'||Array.isArray(crop)||Object.keys(crop).some(key=>!['zoom','x','y'].includes(key)))throw new HttpError(400,'Cadrage invalide');
  for(const [key,min,max] of [['zoom',50,300],['x',-50,50],['y',-50,50]])if(typeof crop[key]!=='number'||!Number.isFinite(crop[key])||crop[key]<min||crop[key]>max)throw new HttpError(400,'Zoom ou position hors limites');
  return [src,{zoom:crop.zoom,x:crop.x,y:crop.y}];
 }));
}
export function productPhotoCrops(product,resolve=src=>src){
 let crops={};try{crops=validatePhotoCrops(typeof product.photo_crops==='string'?JSON.parse(product.photo_crops):product.photo_crops||{});}catch{/* Old or invalid settings use the centred view. */}
 return Object.fromEntries(Object.entries(crops).map(([src,crop])=>[resolve(src),crop]));
}
