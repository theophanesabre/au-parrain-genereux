import { HttpError } from './core.mjs';
export const defaultShop={presentation:'square',layout:'grid',columns:3,tabletColumns:2,mobileColumns:2,imageHeight:300,imageFit:'cover',gap:26,cardPadding:24,radius:0,maxWidth:1440,titleSize:28,textSize:14,align:'left',cardBackground:'#fffdf8'};
export function validateShop(value){
 if(value!==undefined&&(!value||typeof value!=='object'||Array.isArray(value)))throw new HttpError(400,'Présentation de la boutique invalide');
 const source={...defaultShop,...value},result={...defaultShop};
 for(const [key,min,max] of [['columns',1,4],['tabletColumns',1,3],['mobileColumns',1,2],['imageHeight',100,800],['gap',0,80],['cardPadding',8,64],['radius',0,80],['maxWidth',320,2400],['titleSize',16,54],['textSize',12,24]]){const v=source[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(['columns','tabletColumns','mobileColumns'].includes(key)&&!Number.isInteger(v)))throw new HttpError(400,'Dimension des articles invalide');result[key]=v;}
 for(const [key,options] of [['presentation',['square','detailed']],['layout',['grid','list']],['imageFit',['contain','cover']],['align',['left','center','right']]]){if(!options.includes(source[key]))throw new HttpError(400,'Mise en page des articles invalide');result[key]=source[key];}
 if(typeof source.cardBackground!=='string'||!/^#[a-fA-F0-9]{6}$/.test(source.cardBackground))throw new HttpError(400,'Fond des articles invalide');result.cardBackground=source.cardBackground;
 return result;
}
