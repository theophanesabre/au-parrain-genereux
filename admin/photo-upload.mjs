export const photoAccept='image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/gif';
export async function preparePhoto(file){
 if(!file||!file.size)throw Error('Choisissez une photo non vide.');
 if(file.size>30*1024*1024)throw Error('Photo trop lourde : 30 Mo maximum avant réduction.');
 const supported=['image/jpeg','image/png','image/webp'].includes(file.type)||/\.(jpe?g|png|webp)$/i.test(file.name||'');
 if(supported&&file.size<=5*1024*1024)return file;
 let image,localUrl;
 try{
  if(typeof createImageBitmap==='function')try{image=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{/* Try the browser image decoder. */}
  if(!image){localUrl=URL.createObjectURL(file);image=await new Promise((resolve,reject)=>{const element=new Image();element.onload=()=>resolve(element);element.onerror=()=>reject(Error('Lecture impossible'));element.src=localUrl;});}
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  if(!width||!height)throw Error('Dimensions illisibles');
  const ratio=Math.min(1,2048/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
  const context=canvas.getContext('2d');if(!context)throw Error('Conversion indisponible');context.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));
  if(!blob||blob.size>5*1024*1024)throw Error('Réduction insuffisante');
  const ext=blob.type==='image/webp'?'webp':blob.type==='image/jpeg'?'jpg':'png';
  return new File([blob],(file.name||'photo').replace(/\.[^.]+$/,'')+'.'+ext,{type:blob.type});
 }catch{throw Error('Cette photo ne peut pas être convertie sur ce navigateur. Choisissez une version JPEG, PNG ou WebP de moins de 5 Mo.');}
 finally{image?.close?.();if(localUrl)URL.revokeObjectURL(localUrl);}
}
