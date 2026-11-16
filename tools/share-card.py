# Builds the 1200x630 link preview card (share/card.jpg) from the title art.
# Run from the repo root: python3 tools/share-card.py
# Needs Pillow and fontTools (with brotli) to read the self-hosted Fredoka woff2.
import io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630
INK = (20, 33, 61)
GOLD = (255, 210, 63)


def fredoka(weight, size):
    f = TTFont(ROOT / f'fonts/fredoka-latin-{weight}-normal.woff2')
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, size)


def sticker_text(card, xy, text, font, fill, stroke=7, drop=5):
    """Fill, thick navy outline and a hard navy drop shadow: the app's sticker look."""
    layer = Image.new('RGBA', card.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    d.text((x, y + drop), text, font=font, fill=INK, stroke_width=stroke, stroke_fill=INK)
    d.text((x, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=INK)
    card.alpha_composite(layer)


def main():
    art = Image.open(ROOT / 'assets/title/wide.webp').convert('RGBA')
    art = art.resize((W, round(art.height * W / art.width)), Image.LANCZOS)
    card = art.crop((0, 24, W, 24 + H))

    # A soft sky-blue wash on the left so the words read clearly over the clouds.
    wash = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    for x in range(620):
        a = int(150 * (1 - x / 620) ** 1.6)
        wd.line([(x, 0), (x, H)], fill=(18, 70, 160, a))
    card.alpha_composite(wash)

    logo = Image.open(ROOT / 'assets/brand/logo.webp').convert('RGBA')
    lw = 500
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    shadow = Image.new('RGBA', logo.size, (0, 0, 0, 0))
    shadow.putalpha(logo.getchannel('A').point(lambda v: v * 0.35))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    card.alpha_composite(shadow, (34, 40))
    card.alpha_composite(logo, (30, 30))

    top = 30 + logo.height + 18
    sticker_text(card, (52, top), 'Answer times tables.', fredoka(700, 50), (255, 255, 255))
    sticker_text(card, (52, top + 72), 'Catch Kaimon.', fredoka(700, 66), GOLD, stroke=8, drop=6)

    # Small note for grown-ups, as a white sticker pill.
    note = 'Free  ·  No sign-up  ·  Works offline'
    nf = fredoka(600, 26)
    d = ImageDraw.Draw(card)
    tw = d.textlength(note, font=nf)
    px, py, ph = 52, H - 92, 54
    box = (px, py, px + tw + 44, py + ph)
    d.rounded_rectangle((box[0], box[1] + 5, box[2], box[3] + 5), radius=ph // 2, fill=INK)
    d.rounded_rectangle(box, radius=ph // 2, fill=(255, 255, 255), outline=INK, width=4)
    d.text((px + 22, py + ph / 2 + 1), note, font=nf, fill=INK, anchor='lm')

    out = ROOT / 'share/card.jpg'
    card.convert('RGB').save(out, 'JPEG', quality=84, optimize=True, progressive=True)
    print(out, out.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
