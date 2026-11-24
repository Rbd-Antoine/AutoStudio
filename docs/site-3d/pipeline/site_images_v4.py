"""Site pictures on the editor's premium backgrounds (2026-11-24).

Every picture is a real AutoStudio render of a premium "before" photo (generated examples) from
public/compare (framed on the photo, for before/after splits) or public/renders (whole renders):
  public/features/{generation,kit-marketing}.webp, public/styles/<decor>.jpg (the user guide's
  background cards), public/guides/images/<slug>.webp for the guides showing renders.
Run from the repository root:  python docs/site-3d/pipeline/site_images_v4.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[3]
PUB = ROOT / "public"


def img(path: str) -> Image.Image:
    return Image.open(PUB / path).convert("RGB")


def split(car: str, decor: str, size=(1600, 1200)) -> Image.Image:
    a = img(f"compare/{car}/before.webp").resize(size, Image.Resampling.LANCZOS)
    b = img(f"compare/{car}/{decor}.webp").resize(size, Image.Resampling.LANCZOS)
    w = size[0] // 2
    a.paste(b.crop((w, 0, size[0], size[1])), (w, 0))
    arr = np.asarray(a).copy()
    arr[:, w - 1:w + 1] = (242, 169, 59)
    return Image.fromarray(arr)


def whole(car: str, decor: str, size=(1600, 1200)) -> Image.Image:
    im = img(f"renders/{car}/{decor}.webp")
    # 2000 x 1493 to 4:3: a sliver off the bottom.
    return im.crop((0, 0, im.width, round(im.width * 3 / 4))).resize(size, Image.Resampling.LANCZOS)


def save(im: Image.Image, rel: str, quality: int = 84) -> None:
    out = PUB / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.suffix == ".jpg":
        im.save(out, quality=quality, optimize=True)
    else:
        im.save(out, quality=quality, method=6)


def kit(car: str, decor: str) -> Image.Image:
    src = img(f"renders/{car}/{decor}.webp")
    sw, sh = src.size

    def crop(r: float, cx: float = 0.5) -> Image.Image:
        if sw / sh > r:
            h, w = sh, int(sh * r)
        else:
            w, h = sw, int(sw / r)
        x = int(min(max(cx * sw - w / 2, 0), sw - w))
        y = int((sh - h) / 2)
        return src.crop((x, y, x + w, y + h))

    def story(w: int, h: int) -> Image.Image:
        bg = crop(w / h).resize((w, h)).filter(ImageFilter.GaussianBlur(24)).point(lambda v: int(v * 0.45))
        fg = src.resize((w, int(w * sh / sw)), Image.Resampling.LANCZOS)
        bg.paste(fg, (0, (h - fg.height) // 2))
        return bg

    W, H, k = 1600, 1200, 1600 / 1200
    c = Image.new("RGB", (W, H), (12, 13, 15))
    d = ImageDraw.Draw(c)
    f = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", int(20 * k))
    lw, x0, y0 = int(700 * k), int(80 * k), int(110 * k)
    lh = int(lw * 9 / 16)
    c.paste(crop(16 / 9).resize((lw, lh), Image.Resampling.LANCZOS), (x0, y0))
    d.text((x0, y0 - int(32 * k)), "PAYSAGE 16:9", font=f, fill=(242, 169, 59))
    sq = int(330 * k)
    c.paste(crop(1).resize((sq, sq), Image.Resampling.LANCZOS), (x0, int(550 * k)))
    d.text((x0, int(518 * k)), "CARRÉ 1:1", font=f, fill=(242, 169, 59))
    stw, sth, sx = int(700 * k * 9 / 16), int(700 * k), int(820 * k)
    c.paste(story(stw, sth), (sx, y0))
    d.text((sx, y0 - int(32 * k)), "REEL ET STORY 9:16", font=f, fill=(242, 169, 59))
    for (x, y, w, h) in [(x0, y0, lw, lh), (x0, int(550 * k), sq, sq), (sx, y0, stw, sth)]:
        d.rectangle((x, y, x + w - 1, y + h - 1), outline=(42, 45, 49), width=2)
    return c


def grid(pairs: list[tuple[str, str]]) -> Image.Image:
    W, H, gap = 1600, 1200, 10
    out = Image.new("RGB", (W, H), (12, 13, 15))
    w, h = (W - gap) // 2, (H - gap) // 2
    for i, (car, decor) in enumerate(pairs):
        out.paste(whole(car, decor, (w, h)), ((i % 2) * (w + gap), (i // 2) * (h + gap)))
    return out


def main() -> None:
    save(split("coupe", "showroom-nuit"), "features/generation.webp")
    save(kit("coupe", "showroom-nuit"), "features/kit-marketing.webp")
    for decor, (car) in {"showroom-lumiere": "coupe", "studio-noir": "suv", "studio-blanc": "coupe", "showroom-nuit": "coupe"}.items():
        save(whole(car, decor, (800, 600)), f"styles/{decor}.jpg", quality=86)
    guides = {
        "photographier-voiture-pour-vendre": split("coupe", "showroom-nuit"),
        "changer-fond-photo-voiture": split("sportive", "studio-noir"),
        "enlever-arriere-plan-photo-voiture": split("suv", "studio-noir"),
        "logiciel-retouche-photo-voiture": split("berline", "showroom-lumiere"),
        "studio-photo-voiture": whole("coupe", "studio-blanc"),
        "photo-voiture-fond-blanc": whole("berline", "studio-blanc"),
        "eclairage-photo-voiture": whole("suv", "showroom-nuit"),
        "retouche-photo-voiture-ia": whole("sportive", "showroom-nuit"),
        "photo-voiture-fond-noir": whole("sportive", "studio-noir"),
        "photo-voiture-concession": whole("suv", "showroom-lumiere"),
        "photo-annonce-voiture": whole("coupe", "showroom-lumiere"),
        "nombre-photos-annonce-voiture": grid([("coupe", "showroom-nuit"), ("suv", "studio-noir"), ("berline", "showroom-lumiere"), ("sportive", "studio-blanc")]),
    }
    for slug, im in guides.items():
        save(im, f"guides/images/{slug}.webp")
    print("ok")


if __name__ == "__main__":
    main()
