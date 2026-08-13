$ErrorActionPreference = "Stop"

$python = "C:\Users\theophanesabre\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$tiles = Join-Path $PSScriptRoot "..\public\images\osm-tiles"
$output = Join-Path $PSScriptRoot "..\public\images\osm-reference-boutique.png"

$script = @'
from pathlib import Path
from PIL import Image, ImageDraw

tiles = Path(r"__TILES__")
output = Path(r"__OUTPUT__")
xs = range(32789, 32792)
ys = range(22366, 22369)
canvas = Image.new("RGB", (768, 768), "white")
for col, x in enumerate(xs):
    for row, y in enumerate(ys):
        tile = Image.open(tiles / f"{x}-{y}.png").convert("RGB")
        canvas.paste(tile, (col * 256, row * 256))

# Exact geocoded storefront coordinates: 49.500088, 0.126079.
lon, lat, zoom = 0.126079, 49.500088, 16
import math
n = 2 ** zoom
px = ((lon + 180) / 360 * n - 32789) * 256
lat_rad = math.radians(lat)
py = ((1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2 * n - 22366) * 256
# Give the exact map a warmer, quieter heritage-paper treatment without
# changing any road geometry or label placement.
pixels = canvas.load()
for yy in range(canvas.height):
    for xx in range(canvas.width):
        r, g, b = pixels[xx, yy]
        gray = int(0.30 * r + 0.59 * g + 0.11 * b)
        # Preserve legibility while replacing the bright web-map palette.
        pixels[xx, yy] = (
            min(255, int(gray * 0.88 + 38)),
            min(255, int(gray * 0.84 + 35)),
            min(255, int(gray * 0.74 + 30)),
        )

draw = ImageDraw.Draw(canvas)
draw.ellipse((px - 11, py - 11, px + 11, py + 11), fill="#d86632", outline="#1d1814", width=3)
draw.rounded_rectangle((px + 16, py - 31, px + 238, py + 26), radius=7, fill="#fff8e9", outline="#1d1814", width=2)
draw.text((px + 29, py - 22), "AU PARRAIN GENEREUX", fill="#c95528")
draw.text((px + 29, py - 3), "123 RUE MARECHAL JOFFRE", fill="#1d1814")
canvas.save(output)
'@

$script = $script.Replace("__TILES__", $tiles).Replace("__OUTPUT__", $output)
$script | & $python -
