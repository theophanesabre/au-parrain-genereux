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
    if(!product||product.archived||!product.published||!isSale(product.id)||product.price_cents<=0)return {...line,name:'Article indisponible',unit:'piece',available:false,line_cents:null,price_cents:null};
    return {...line,...(product.stock_id?{stock_id:product.stock_id,ballotin:product.ballotin}:{}),name:product.name,unit:'piece',price_cents:product.price_cents,line_cents:lineTotal(product,line.quantity),available:product.stock>=line.quantity};
  });
  const totals=new Map();for(const item of items){const stockId=item.stock_id||item.id;totals.set(stockId,(totals.get(stockId)||0)+item.quantity);}for(const item of items){const product=byId.get(item.id);if(product&&totals.get(item.stock_id||item.id)>product.stock)item.available=false;}
  return {items,total_cents:items.reduce((sum,item)=>sum+(item.line_cents??0),0),valid:items.length>0&&items.every(item=>item.available)};
}

export function checkoutItems(items){const grouped=new Map();for(const item of items){const id=item.stock_id||item.id;let line=grouped.get(id);if(!line){line={id,name:item.name,quantity:0,price_cents:item.price_cents,line_total_cents:0,unit:'piece'};grouped.set(id,line);}line.quantity+=item.quantity;line.line_total_cents+=item.line_cents;if(item.ballotin){line.ballotins??=[];line.ballotins.push({size:item.ballotin.size,pieces:item.ballotin.pieces,quantity:item.quantity});}}return [...grouped.values()];}
