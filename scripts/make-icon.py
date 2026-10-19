# Draws the app icon (build-resources/icon.png, 1024 x 1024): a play button over sound bars on a
# film strip, in the app's blue to teal. electron-builder makes the .icns and .ico from it; the
# app uses it as its window and Dock icon when run with `npm run app`.
# Drawn 4 x larger and scaled down, so the edges are smooth.
# Usage: python3 scripts/make-icon.py   (needs Pillow)
from PIL import Image, ImageChops, ImageDraw, ImageFilter

K = 4  # supersampling
S = 1024 * K
BODY = 824 * K  # macOS icon grid: the rounded square, centred, with a margin
OFF = (S - BODY) // 2
RADIUS = 185 * K
TOP_LEFT, BOTTOM_RIGHT = (86, 132, 255), (16, 190, 160)


def px(v):
    return int(v * K)


def body_mask():
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([OFF, OFF, OFF + BODY - 1, OFF + BODY - 1], radius=RADIUS, fill=255)
    return mask


def diagonal_gradient():
    # A small gradient scaled up is smooth and quick to make.
    n = 256
    small = Image.new('RGB', (n, n))
    for y in range(n):
        for x in range(n):
            t = (x + y) / (2 * (n - 1))
            small.putpixel((x, y), tuple(int(TOP_LEFT[i] + (BOTTOM_RIGHT[i] - TOP_LEFT[i]) * t) for i in range(3)))
    return small.resize((S, S), Image.BICUBIC).convert('RGBA')


def layer():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))


mask = body_mask()

# Soft shadow under the rounded square.
shadow = layer()
shadow.putalpha(mask.point(lambda a: a * 0.35))
shadow = shadow.transform(shadow.size, Image.AFFINE, (1, 0, 0, 0, 1, -px(10)))
shadow = shadow.filter(ImageFilter.GaussianBlur(px(16)))

icon = layer()
icon = Image.alpha_composite(icon, shadow)
body = diagonal_gradient()
body.putalpha(mask)
icon = Image.alpha_composite(icon, body)

# A gentle light from the top.
light = Image.new('L', (S, S), 0)
ImageDraw.Draw(light).ellipse([OFF - px(200), OFF - px(560), OFF + BODY + px(200), OFF + px(300)], fill=46)
light = light.filter(ImageFilter.GaussianBlur(px(90)))  # blur the strength only, so it stays white
shine = Image.new('RGBA', (S, S), (255, 255, 255, 255))
shine.putalpha(ImageChops.multiply(light, mask))
icon = Image.alpha_composite(icon, shine)

# Film-strip holes along the top and bottom.
strip = layer()
d = ImageDraw.Draw(strip)
holes, pitch, w, h = 7, px(92), px(46), px(32)
start = S // 2 - ((holes - 1) * pitch + w) // 2
for k in range(holes):
    x = start + k * pitch
    for y in (OFF + px(52), OFF + BODY - px(52) - h):
        d.rounded_rectangle([x, y, x + w, y + h], radius=px(10), fill=(255, 255, 255, 64))
icon = Image.alpha_composite(icon, strip)

# Sound bars.
bars = [50, 96, 150, 116, 186, 136, 88, 118, 58]
bw, gap, mid = px(30), px(22), px(712)
x0 = S // 2 - (len(bars) * bw + (len(bars) - 1) * gap) // 2
wave = layer()
d = ImageDraw.Draw(wave)
for i, bh in enumerate(bars):
    x = x0 + i * (bw + gap)
    d.rounded_rectangle([x, mid - px(bh) // 2, x + bw, mid + px(bh) // 2], radius=bw // 2, fill=(255, 255, 255, 165))
icon = Image.alpha_composite(icon, wave)

# The play button: a triangle with rounded corners (a thick round-joined outline), with a shadow.
cx, cy = S // 2 + px(22), px(408)
tri = [(cx - px(118), cy - px(150)), (cx - px(118), cy + px(150)), (cx + px(142), cy)]
play_mask = Image.new('L', (S, S), 0)
pd = ImageDraw.Draw(play_mask)
pd.polygon(tri, fill=255)
pd.line(tri + [tri[0]], fill=255, width=px(44), joint='curve')
for p in tri:
    pd.ellipse([p[0] - px(22), p[1] - px(22), p[0] + px(22), p[1] + px(22)], fill=255)

play_shadow = layer()
play_shadow.putalpha(play_mask.point(lambda a: a * 0.28))
play_shadow = play_shadow.transform(play_shadow.size, Image.AFFINE, (1, 0, 0, 0, 1, -px(12)))
play_shadow = play_shadow.filter(ImageFilter.GaussianBlur(px(18)))
icon = Image.alpha_composite(icon, play_shadow)
play = Image.new('RGBA', (S, S), (255, 255, 255, 255))
play.putalpha(play_mask)
icon = Image.alpha_composite(icon, play)

icon.resize((1024, 1024), Image.LANCZOS).save('build-resources/icon.png')
