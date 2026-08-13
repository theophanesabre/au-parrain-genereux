$ErrorActionPreference = "Stop"
$python = "C:\Users\theophanesabre\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$root = Join-Path $PSScriptRoot "..\public\images"
$code = @'
from pathlib import Path
from PIL import Image

root=Path(r"__ROOT__")
source_dir=root/'bonbons-nettoyes'
target_dir=root/'bonbons-detoures-originaux'
target_dir.mkdir(exist_ok=True)

for source in sorted(source_dir.glob('*.png')):
    original=Image.open(source).convert('RGB')
    w,h=original.size
    rgb=original.load()
    mask=Image.new('L',(w,h),0); mp=mask.load()
    # Remove only the unmistakable saturated orange backdrop. Every other
    # pixel is fully opaque: no semi-transparency, recolouring or filtering.
    for y in range(h):
        for x in range(w):
            r,g,b=rgb[x,y]
            is_orange_backdrop = r > 145 and (r-g) > 72 and (g-b) > 18 and b < 92
            mp[x,y] = 0 if is_orange_backdrop else 255
    # Preserve original RGB values exactly. Only the alpha channel changes.
    rgba=original.convert('RGBA'); rgba.putalpha(mask)
    rgba.save(target_dir/source.name)
'@
$code=$code.Replace("__ROOT__",$root)
$code | & $python -
