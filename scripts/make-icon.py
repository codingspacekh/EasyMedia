# Draws the app icon (build-resources/icon.png, 1024 x 1024): a play button over sound bars on a
# film strip, in the app's blue to teal. electron-builder makes the .icns and .ico from it.
# Usage: python3 scripts/make-icon.py   (needs Pillow)
from PIL import Image, ImageDraw

S = 1024
BODY = 824  # macOS icon grid: the rounded square, centred, with a margin
OFF = (S - BODY) // 2
TOP, BOTTOM = (79, 140, 255), (20, 184, 166)

base = Image.new('RGBA', (S, S), (0, 0, 0, 0))
grad = Image.new('RGBA', (BODY, BODY))
g = ImageDraw.Draw(grad)
for y in range(BODY):
    t = y / (BODY - 1)
    g.line([(0, y), (BODY, y)], fill=tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)) + (255,))
mask = Image.new('L', (BODY, BODY), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, BODY - 1, BODY - 1], radius=185, fill=255)
base.paste(grad, (OFF, OFF), mask)

over = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(over)
holes, pitch, w = 7, 92, 44
start = S // 2 - ((holes - 1) * pitch + w) // 2
for k in range(holes):
    x = start + k * pitch
    d.rounded_rectangle([x, OFF + 46, x + w, OFF + 80], radius=9, fill=(255, 255, 255, 70))
    d.rounded_rectangle([x, OFF + BODY - 80, x + w, OFF + BODY - 46], radius=9, fill=(255, 255, 255, 70))
bars = [50, 100, 160, 120, 190, 140, 90, 120, 60]
bw, gap = 30, 22
x0 = S // 2 - (len(bars) * bw + (len(bars) - 1) * gap) // 2
for i, h in enumerate(bars):
    x = x0 + i * (bw + gap)
    d.rounded_rectangle([x, 700 - h // 2, x + bw, 700 + h // 2], radius=bw // 2, fill=(255, 255, 255, 150))
base = Image.alpha_composite(base, over)

play = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(play).polygon([(S // 2 - 105, 260), (S // 2 - 105, 560), (S // 2 + 165, 410)], fill=(255, 255, 255, 255))
Image.alpha_composite(base, play).save('build-resources/icon.png')
