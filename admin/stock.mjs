export function stockAlerts(products) {
  return products.filter(product=>product.kind!=='recipe'&&!product.id.startsWith('bonbon-')&&product.stock<=(product.id==='bonbon'?500:5)).map(product=>({id:product.id,name:product.name,stock:product.stock,unit:product.id==='bonbon'?'g':'pièces',empty:product.stock===0}));
}
