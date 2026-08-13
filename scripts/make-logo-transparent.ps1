$ErrorActionPreference = "Stop"
$python = "C:\Users\theophanesabre\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$source = Join-Path $PSScriptRoot "..\public\images\logo-boutique-le-havre-v3-orange.png"
$output = Join-Path $PSScriptRoot "..\public\images\logo-boutique-le-havre-v4-transparent.png"
$code = @'
from PIL import Image
from pathlib import Path
source = Path(r"__SOURCE__")
output = Path(r"__OUTPUT__")
im = Image.open(source).convert("RGBA")
px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, _ = px[x, y]
        luminance = 0.26*r + 0.62*g + 0.12*b
        darkness = max(0.0, 158.0 - luminance)
        # The red lettering has a much lower green channel than the pastel
        # orange paper; this retains it without retaining the background.
        red_ink = max(0.0, 118.0-g) if r > g*1.35 else 0.0
        alpha = max(0, min(255, int(max(darkness*7.0, red_ink*5.0))))
        if alpha < 10: alpha = 0
        px[x, y] = (r, g, b, alpha)
bbox = im.getbbox()
if bbox:
    l,t,r,b = bbox; pad = 34
    im = im.crop((max(0,l-pad),max(0,t-pad),min(im.width,r+pad),min(im.height,b+pad)))
im.save(output)
'@
$code = $code.Replace("__SOURCE__", $source).Replace("__OUTPUT__", $output)
$code | & $python -
