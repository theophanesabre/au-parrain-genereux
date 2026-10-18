export type PhotoCrop={zoom:number;x:number;y:number};
export type CartLine={id:string;quantity:number};
export type SaleProduct={id:string;name:string;description:string;price_cents:number;stock:number;image:string;images?:string[];photo_crops?:Record<string,PhotoCrop>};
export type ProductDetail=SaleProduct&{weight:string;conservation:string;ingredients:string;allergens:string};
export type Quote={items:(CartLine&{name:string;unit:string;price_cents:number|null;line_cents:number|null;available:boolean})[];total_cents:number;valid:boolean};
