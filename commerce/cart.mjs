import { isSale, lineTotal } from '../admin/products.mjs';
export const CART_KEY='apg-panier-v1';
export const MAX_QUANTITY=100000;
export function normalizeCart(value) {
  if(!Array.isArray(value))return [];
  const merged=new Map();
  for(const line of value.slice(0,100)){
    if(!line||typeof line.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(line.id)||!isSale(line.id)||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>MAX_QUANTITY)continue;
    merged.set(line.id,Math.min(MAX_QUANTITY,(merged.get(line.id)||0)+line.quantity));
  }
  return [...merged].slice(0,50).map(([id,quantity])=>({id,quantity}));
}
export function quoteCart(lines,products) {
  const byId=new Map(products.map(product=>[product.id,product]));
  const items=normalizeCart(lines).map(line=>{
    const product=byId.get(line.id);
    if(!product||!product.published||!isSale(product.id)||product.price_cents<=0)return {...line,name:'Article indisponible',unit:'piece',available:false,line_cents:null,price_cents:null};
    return {...line,name:product.name,unit:'piece',price_cents:product.price_cents,line_cents:lineTotal(product,line.quantity),available:product.stock>=line.quantity};
  });
  return {items,total_cents:items.reduce((sum,item)=>sum+(item.line_cents??0),0),valid:items.length>0&&items.every(item=>item.available)};
}
