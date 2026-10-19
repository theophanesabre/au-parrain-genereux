// A price per kilogram is information about a packaged item, not a return to weight-based sales.
export function netWeightGrams(value){if(typeof value!=='string')return null;const match=value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(g|kg)$/i);if(!match)return null;const grams=Number(match[1].replace(',','.'))*(match[2].toLowerCase()==='kg'?1000:1);return Number.isFinite(grams)&&grams>0?grams:null;}
export function pricePerKilogram(price,weight){const grams=netWeightGrams(weight);return grams&&Number.isSafeInteger(price)&&price>=0?Math.round(price*1000/grams):null;}
