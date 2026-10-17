import type { CSSProperties } from 'react';
import type { VisualStyle } from './visual-types';
export const visualFonts:Record<string,string>={classic:'Georgia, "Times New Roman", serif',modern:'Arial, Helvetica, sans-serif',editorial:'"Palatino Linotype", "Book Antiqua", Palatino, serif'};
export function visualStyle(style:VisualStyle):CSSProperties{
 const {font,layout,columns,width,objectFit,textAlign,...rest}=style;
 const result:CSSProperties={...rest,objectFit:objectFit as CSSProperties['objectFit'],textAlign:textAlign as CSSProperties['textAlign'],fontFamily:font?visualFonts[font]:undefined,width:width===undefined?undefined:width+'%'};
 if(layout==='row'||layout==='column'){result.display='flex';result.flexDirection=layout;result.flexWrap=layout==='row'?'wrap':undefined;}
 if(layout==='grid'){result.display='grid';result.gridTemplateColumns=`repeat(${columns||2},minmax(0,1fr))`;}
 return result;
}
