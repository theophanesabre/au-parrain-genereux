import type { Data } from '@puckeditor/core';
import type { SaleProduct } from '../cart-types';
export type PuckDocument=Data;
export type LibraryImage={id:string;alt:string;url?:string;original?:string;static?:boolean};
export type Storefront={products:SaleProduct[];recipes:{id:string;name:string;description:string;image:string}[]};
export type BlockStyle={background:string;color:string;padding:number;paddingX:number;margin:number;radius:number;maxWidth:number;align:string;font:string;size:number;gap:number};
