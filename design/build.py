#!/usr/bin/env python3
"""Build the static UI prototype screens.

Reads  design/src/*.html  (templates)  and writes  design/screens/*.html.

Template tags:
  {{include:name}}                     -> contents of src/partials/name.html
  {{i:name}} / {{i:name:extra-class}}  -> inline SVG icon
  {{wave:seed:w:h:color:kind[:class]}} -> SVG waveform (kind = music | voice | quiet | noise | dyn | dyncomp)
  {{sampling:w:h:samples:bits}}        -> sampling-rate / resolution diagram
  {{pixscene:w:h:block}}               -> pixelated scene (low resolution / compression demo)
  <!--@NAME: value--> ... {{NAME}}     -> per-page variable (unset = empty)
  {{NAME|partial}}                     -> per-page variable, defaulting to a partial

Run:  python3 design/build.py
"""
import math
import pathlib
import random
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "screens"

FILLED = {"play", "rec", "pause", "stop"}
ICONS = {
    "play": '<path d="M7 4.5v15l12.5-7.5z"/>',
    "pause": '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    "stop": '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    "rec": '<circle cx="12" cy="12" r="7"/>',
    "skipb": '<path d="M19 20 9 12l10-8z"/><path d="M5 19V5"/>',
    "skipf": '<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
    "import": '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    "title": '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    "captions": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M13 15h4M7 11h10"/>',
    "credits": '<path d="M9 6h12M9 12h12M9 18h12"/><path d="m3 9 2.5-3L8 9"/><path d="M5.5 6v13"/>',
    "camera": '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    "scissors": '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    "split": '<path d="M12 3v18"/><path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
    "transition": '<rect x="3" y="6" width="11" height="12" rx="1.5"/><rect x="10" y="6" width="11" height="12" rx="1.5"/>',
    "undo": '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    "redo": '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    "export": '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
    "sliders": '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    "volx": '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
    "vol": '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    "lock": '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "help": '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    "chev": '<path d="m6 9 6 6 6-6"/>',
    "chevr": '<path d="m9 6 6 6-6 6"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "minus": '<path d="M5 12h14"/>',
    "copy": '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    "paste": '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    "trim": '<path d="M8 4H5v16h3M16 4h3v16h-3"/><path d="M10 12h4"/>',
    "silence": '<path d="M3 12h18"/><path d="M7 8v8M17 8v8"/>',
    "zoomin": '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
    "zoomout": '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
    "magnet": '<path d="M6 15V8a6 6 0 0 1 12 0v7"/><path d="M6 15h4v-4M14 11v4h4"/><path d="M6 19h4M14 19h4"/>',
    "film": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/>',
    "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    "music": '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    "mic": '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
    "wave": '<path d="M2 12h2M6 8v8M10 4v16M14 7v10M18 10v4M22 12h0"/>',
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "ibeam": '<path d="M9 4h6M9 20h6M12 4v16"/>',
    "move": '<path d="m5 9-3 3 3 3M19 9l3 3-3 3M2 12h20"/>',
    "folder": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    "fade": '<path d="M3 20 21 4v16z"/>',
    "sparkle": '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17v4M17 19h4"/>',
    "book": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    "calc": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>',
    "loop": '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    "aspect": '<rect x="2" y="6" width="20" height="12" rx="2"/>',
    "file": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    "save": '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    "unlink": '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/><path d="M3 3l18 18"/>',
    "mono": '<path d="M6 3v5a6 6 0 0 0 6 6M18 3v5a6 6 0 0 1-6 6v7"/>',
    "palette": '<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/>',
    "gauge": '<path d="M12 14 16 9"/><path d="M3.3 19a10 10 0 1 1 17.4 0z"/>',
    "dots": '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    "monitor": '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    "phone": '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
    "disc": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2.5"/>',
    "globe": '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    "crop": '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    "anchor": '<circle cx="12" cy="5" r="3"/><path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/>',
}


def icon(name: str, extra: str = "") -> str:
    body = ICONS[name]
    fill = ' style="fill:currentColor;stroke:none"' if name in FILLED else ""
    cls = f"i {extra}".strip()
    return f'<svg class="{cls}" viewBox="0 0 24 24"{fill}>{body}</svg>'


def wave(seed: str, w: str, h: str, color: str, kind: str, cls: str = "wave") -> str:
    """Mirrored amplitude envelope, like an Audacity/NLE waveform overview."""
    rnd = random.Random(seed)
    W, H = int(w), int(h)
    mid = H / 2
    step = 2
    top, bottom = [], []
    phase = rnd.random() * 10
    for x in range(0, W + 1, step):
        t = x / W
        if kind == "voice":
            # bursts = syllables / phrases, with gaps
            env = (0.35 + 0.65 * abs(math.sin(x / 3.1 + phase))) * (0.6 + 0.4 * math.sin(x / 11 + phase * 2))
            env *= 1.0 if math.sin(x / 13 + phase) > -0.6 else 0.05
        elif kind in ("dyn", "dyncomp"):
            # same shape, uneven loudness; "dyncomp" = after dynamic range compression
            env = (0.05 + 0.95 * abs(math.sin(x / 40 + phase)) ** 1.8) * (0.8 + 0.2 * math.sin(x / 4.1))
            if kind == "dyncomp":
                env = 0.85 * env ** 0.3
        elif kind == "quiet":
            env = 0.22 + 0.08 * math.sin(x / 13 + phase)
        elif kind == "noise":
            env = 0.08
        else:  # music
            env = 0.62 + 0.18 * math.sin(x / 23 + phase) + 0.14 * math.sin(x / 7.3 + phase * 3)
        a = max(0.02, min(0.98, env * (0.72 + 0.28 * rnd.random())))
        top.append(f"{x},{mid - a * mid:.1f}")
        bottom.append(f"{x},{mid + a * mid:.1f}")
    d = "M" + " L".join(top) + " L" + " L".join(reversed(bottom)) + " Z"
    return (f'<svg class="{cls}" viewBox="0 0 {W} {H}" preserveAspectRatio="none">'
            f'<path d="{d}" fill="{color}"/></svg>')


def sampling(w: str, h: str, samples: str, bits: str) -> str:
    """Analogue wave, its samples and the stepped digital result (Learn mode, T4)."""
    W, H, n, levels = int(w), int(h), int(samples), 2 ** int(bits)
    pad = 10

    def f(t: float) -> float:  # analogue signal in 0..1
        return 0.5 + 0.28 * math.sin(2 * math.pi * 1.6 * t) + 0.14 * math.sin(2 * math.pi * 4.3 * t + 1)

    def y(v: float) -> float:
        return pad + (1 - v) * (H - 2 * pad)

    grid = "".join(f'<line x1="0" x2="{W}" y1="{y(k / (levels - 1)):.1f}" y2="{y(k / (levels - 1)):.1f}" '
                   f'stroke="#2c323d" stroke-width="1"/>' for k in range(levels))
    curve = " L".join(f"{x},{y(f(x / W)):.1f}" for x in range(0, W + 1, 3))
    xs = [i * W / n for i in range(n + 1)]
    q = [round(f(x / W) * (levels - 1)) / (levels - 1) for x in xs]
    steps = "".join(f" L{xs[i]:.1f},{y(q[i]):.1f} L{xs[i + 1]:.1f},{y(q[i]):.1f}" for i in range(n))
    dots = "".join(f'<circle cx="{x:.1f}" cy="{y(v):.1f}" r="3.5" fill="#4f8cff" stroke="#101216" stroke-width="1.5"/>'
                   for x, v in zip(xs, q))
    return (f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" style="display:block">{grid}'
            f'<path d="M{curve}" fill="none" stroke="#a9b0bc" stroke-width="2" stroke-dasharray="5 4"/>'
            f'<path d="M{xs[0]:.1f},{y(q[0]):.1f}{steps}" fill="none" stroke="#4f8cff" stroke-width="2.5"/>'
            f"{dots}</svg>")


def pixscene(w: str, h: str, block: str) -> str:
    """Lake scene drawn with big pixels, to show low resolution / heavy compression (Learn mode)."""
    W, H, b = int(w), int(h), int(block)

    def colour(u: float, v: float) -> tuple:
        mix = lambda a, c, t: tuple(int(a[i] + (c[i] - a[i]) * t) for i in range(3))
        if (u - .62) ** 2 / .0016 + (v - .33) ** 2 / .006 < 1:
            return (59, 43, 31) if v > .3 else (243, 239, 230)
        hill = .40 + .04 * math.sin(u * 9)
        if v < hill:
            return mix((156, 198, 232), (205, 224, 234), v / hill)
        if v < .58:
            return mix((111, 143, 91), (77, 111, 67), (v - hill) / (.58 - hill))
        return mix((106, 160, 184), (52, 100, 130), (v - .58) / .42)

    rects = []
    for y in range(0, H, b):
        for x in range(0, W, b):
            r, g, bl = colour((x + b / 2) / W, (y + b / 2) / H)
            rects.append(f'<rect x="{x}" y="{y}" width="{b}" height="{b}" fill="#{r:02x}{g:02x}{bl:02x}"/>')
    return (f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" shape-rendering="crispEdges" '
            f'style="display:block;border-radius:4px">{"".join(rects)}</svg>')


TAG = re.compile(r"\{\{(include|i|wave|sampling|pixscene):([^}]*)\}\}")


def render(text: str, depth: int = 0) -> str:
    def sub(m: re.Match) -> str:
        kind, args = m.group(1), m.group(2).split(":")
        if kind == "include":
            return render((SRC / "partials" / f"{args[0]}.html").read_text(), depth + 1)
        if kind == "i":
            return icon(*args)
        if kind == "sampling":
            return sampling(*args)
        if kind == "pixscene":
            return pixscene(*args)
        return wave(*args)
    return TAG.sub(sub, text)


VAR_DEF = re.compile(r"<!--@([A-Z0-9_]+):(.*?)-->\n?")
VAR_USE = re.compile(r"\{\{([A-Z0-9_]+)(?:\|([\w-]+))?\}\}")


def build_page(text: str) -> str:
    """Pages set per-screen variables with <!--@NAME: value-->; unset variables become empty."""
    variables = {k: v.strip() for k, v in VAR_DEF.findall(text)}
    html = render(VAR_DEF.sub("", text))
    def sub(m: re.Match) -> str:
        name, default = m.group(1), m.group(2)
        if name in variables:
            return render(variables[name])
        return render(f"{{{{include:{default}}}}}") if default else ""
    for _ in range(5):  # defaults may themselves contain variables
        expanded = VAR_USE.sub(sub, html)
        if expanded == html:
            break
        html = expanded
    return html


def main() -> None:
    OUT.mkdir(exist_ok=True)
    shutil.copy(SRC / "styles.css", OUT / "styles.css")
    for page in sorted(SRC.glob("*.html")):
        (OUT / page.name).write_text(build_page(page.read_text()))
        print("built", page.name)


if __name__ == "__main__":
    main()
