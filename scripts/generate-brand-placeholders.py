#!/usr/bin/env python3
"""Generate placeholder brand assets for PKFIT Architect landing page.

Inputs:
- Source font: assets/fonts/bebas-neue-v16-latin-400.woff2 (decoded to TTF via fontTools)

Outputs:
- assets/img/og.png              1200x630
- assets/img/favicon.png         32x32
- assets/img/apple-touch-icon.png 180x180
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
WOFF2 = ROOT / "assets" / "fonts" / "bebas-neue-v16-latin-400.woff2"
IMG_DIR = ROOT / "assets" / "img"
IMG_DIR.mkdir(parents=True, exist_ok=True)

BG = (8, 8, 8)
GOLD = (200, 169, 110)
TEXT = (245, 245, 245)

# Decode woff2 -> TTF into a temp path Pillow can read.
TTF_PATH = IMG_DIR / ".bebas-neue-tmp.ttf"
f = TTFont(str(WOFF2))
f.flavor = None
f.save(str(TTF_PATH))


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(TTF_PATH), size=size)


def draw_centered(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont,
                  cx: int, cy: int, fill: tuple[int, int, int]) -> None:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=f)
    w = right - left
    h = bottom - top
    draw.text((cx - w / 2 - left, cy - h / 2 - top), text, font=f, fill=fill)


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start_size: int) -> ImageFont.FreeTypeFont:
    size = start_size
    while size > 10:
        f_ = font(size)
        left, _, right, _ = draw.textbbox((0, 0), text, font=f_)
        if right - left <= max_width:
            return f_
        size -= 2
    return font(size)


def make_og() -> None:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # Thin gold border frame, quiet.
    pad = 36
    draw.rectangle([pad, pad, W - pad - 1, H - pad - 1], outline=GOLD, width=2)

    title_max_width = W - pad * 2 - 80
    title_f = fit_font(draw, "THE ARCHITECT'S BLUEPRINT", title_max_width, 150)
    subtitle_f = font(56)

    draw_centered(draw, "THE ARCHITECT'S BLUEPRINT", title_f, W // 2, H // 2 - 50, GOLD)
    draw_centered(draw, "PKFIT", subtitle_f, W // 2, H // 2 + 90, TEXT)

    img.save(IMG_DIR / "og.png", "PNG", optimize=True)


def make_monogram(size: int, out_name: str) -> None:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)
    # Bebas ascent+descent sits roughly at 1.25x the requested size in FreeType.
    # Choose a font size so "PK" nearly fills the tile with small optical padding.
    fsize = int(size * 0.72)
    f_ = font(fsize)
    draw_centered(draw, "PK", f_, size // 2, size // 2, GOLD)
    img.save(IMG_DIR / out_name, "PNG", optimize=True)


make_og()
make_monogram(32, "favicon.png")
make_monogram(180, "apple-touch-icon.png")

TTF_PATH.unlink()  # clean up intermediate TTF
print("wrote og.png, favicon.png, apple-touch-icon.png")
