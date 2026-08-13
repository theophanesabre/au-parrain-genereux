$ErrorActionPreference = "Stop"
$python = "C:\Users\theophanesabre\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$root = Join-Path $PSScriptRoot "..\public\images"
$code = @'
from pathlib import Path
from PIL import Image, ImageFilter
import colorsys
root = Path(r"__ROOT__")
def save_alpha(source,target,alpha_fn,crop=False):
 im=Image.open(source).convert('RGBA'); rgb=im.convert('RGB'); alpha=Image.new('L',im.size); ap=alpha.load(); rp=rgb.load()
 for y in range(im.height):
  for x in range(im.width): ap[x,y]=max(0,min(255,int(alpha_fn(*rp[x,y]))))
 alpha=alpha.filter(ImageFilter.GaussianBlur(.8)).point(lambda a: 0 if a < 18 else a); im.putalpha(alpha)
 if crop and im.getbbox():
  l,t,r,b=im.getbbox(); p=24; im=im.crop((max(0,l-p),max(0,t-p),min(im.width,r+p),min(im.height,b+p)))
 im.save(target)
def orange_alpha(r,g,b):
 h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255); dark=max(0,(.67-v)/.30); non=max(0,min(1,abs(h-.045)/.10)) if s>.2 else 1
 return 255*max(dark,non*(1-v)*1.25)
out=root/'bonbons-transparents'; out.mkdir(exist_ok=True)
for source in sorted((root/'bonbons-nettoyes').glob('*.png')): save_alpha(source,out/source.name,orange_alpha)
def pale_alpha(r,g,b):
 lum=.299*r+.587*g+.114*b; chroma=max(r,g,b)-min(r,g,b); return max((226-lum)*9,(chroma-34)*6)
save_alpha(root/'bonbons-editorial.png',root/'bonbons-editorial-transparent.png',pale_alpha,True)
save_alpha(root/'plan-boutique-le-havre-v3-main.png',root/'plan-boutique-le-havre-v4-transparent.png',pale_alpha,True)
'@
$code=$code.Replace("__ROOT__",$root)
$code | & $python -
