from pathlib import Path
from PIL import Image
import math

root = Path(__file__).resolve().parents[1]
source = root / "public" / "images" / "apg-au-parrain-genereux.jpg"
target = root / "public" / "images" / "apg-au-parrain-genereux-transparent.png"

image = Image.open(source).convert("RGBA")
pixels = image.load()
width, height = image.size
corners = [pixels[0, 0], pixels[width - 1, 0], pixels[0, height - 1], pixels[width - 1, height - 1]]
background = tuple(sum(pixel[channel] for pixel in corners) / len(corners) for channel in range(3))

for y in range(height):
    for x in range(width):
        r, g, b, _ = pixels[x, y]
        distance = math.sqrt(sum((value - reference) ** 2 for value, reference in zip((r, g, b), background)))
        if r > 220 and g > 210 and b > 205:
            alpha = 0
        else:
            alpha = max(0, min(255, round((distance - 12) * 255 / 30)))
        pixels[x, y] = (r, g, b, alpha)

image.save(target, optimize=True)
print(target)
