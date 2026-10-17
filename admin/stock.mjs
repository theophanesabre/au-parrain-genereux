export function stockAlerts(products) {
  return products.filter(product=>product.kind!=='recipe'&&product.id!=='bonbon'&&!product.id.startsWith('bonbon-')&&product.stock<=5).map(product=>({id:product.id,name:product.name,stock:product.stock,unit:'pièces',empty:product.stock===0}));
}
