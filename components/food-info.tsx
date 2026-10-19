import { pricePerKilogram } from '@/commerce/food-info.mjs';
export function UnitPrice({price,weight,reserve=false}:{price:number;weight?:string;reserve?:boolean}){const value=pricePerKilogram(price,weight);return value===null?(reserve?<p className="apg-unit-price" aria-hidden="true"/>:null):<p className="apg-unit-price">{weight} net · {(value/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}/kg</p>;}
// Emphasise only words present in the supplied ingredient text, without inferring a recipe or traces.
const allergenWords=/(?<!\p{L})(laits?|lactose|blé|seigle|orge|avoine|épeautre|gluten|crustacés?|poissons?|arachides?|soja|amandes?|noisettes?|noix(?: de (?:cajou|pécan|macadamia))?|pistaches?|céleri|moutarde|sésame|sulfites?|lupin|mollusques?|œufs?|oeufs?)(?!\p{L})/giu;
export function IngredientText({value}:{value:string}){return <p className="apg-ingredient-text">{value.split(allergenWords).map((part,index)=>index%2?<strong key={index}>{part}</strong>:part)}</p>;}
