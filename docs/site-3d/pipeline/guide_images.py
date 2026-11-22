"""Illustrations of the SEO guides (public/guides/images/<slug>.webp, 1200 x 900).

Every picture is either a customer photo as taken (public/showcase/voitures/*/before.webp) or a
real AutoStudio render of it (render.ts, gemini-nano-banana-2.1), never a composite pretending to
be one. "Split" pictures put the photo's left half beside the render's right half: the render is
aligned on the photo (same similarity fit as prepare_v2.py), so the car runs across the line and
only the decor changes. Each guide's caption says which is which.

Run from the repository root:  python docs/site-3d/pipeline/guide_images.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from prepare_v2 import align_to_photo  # noqa: E402

OUT = ROOT / "public" / "guides" / "images"
CARS = ROOT / "public" / "showcase" / "voitures"
SITE = ROOT / "public" / "site-3d"
W, H = 1200, 900

# The grille badge of voiture-04 that the renders sharpen back into a letter (the photos' badges
# are already blank): its centre and the radius to fill, in render pixels.
BADGE_FIX = {"voiture-04": ((655, 1065), 19)}


def photo(car: str) -> np.ndarray:
    return np.asarray(Image.open(CARS / car / "before.webp").convert("RGB"))


def render(car: str, decor: str, tag: str = "g") -> np.ndarray:
    img = np.asarray(Image.open(HERE / "renders" / f"{car}__{decor}__gemini-nano-banana-2.1__{tag}.png").convert("RGB")).copy()
    if car in BADGE_FIX:
        (cx, cy), r = BADGE_FIX[car]
        mask = np.zeros(img.shape[:2], np.uint8)
        cv2.circle(mask, (cx, cy), r, 255, -1)
        img = cv2.inpaint(img, mask, 7, cv2.INPAINT_TELEA)
    return img


def site(name: str) -> np.ndarray:
    return np.asarray(Image.open(SITE / f"{name}.webp").convert("RGB"))


def fit(img: np.ndarray) -> np.ndarray:
    return cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)


def aligned(car: str, decor: str) -> np.ndarray:
    """The render warped onto the photo's 1200 x 900 frame."""
    base = photo(car)
    r = render(car, decor)
    m = align_to_photo(r, base)
    return cv2.warpAffine(r, m, (base.shape[1], base.shape[0]), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REFLECT)


def split(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    a, b = fit(left), fit(right)
    out = a.copy()
    out[:, W // 2:] = b[:, W // 2:]
    out[:, W // 2 - 1:W // 2 + 1] = (242, 169, 59)  # the site's amber accent, a 2 px line
    return out


def grid(images: list[np.ndarray]) -> np.ndarray:
    out = np.full((H, W, 3), 12, np.uint8)
    gap = 8
    w, h = (W - gap) // 2, (H - gap) // 2
    for i, img in enumerate(images):
        x, y = (i % 2) * (w + gap), (i // 2) * (h + gap)
        out[y:y + h, x:x + w] = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pictures = {
        "photographier-voiture-pour-vendre": lambda: split(site("plate-before"), site("decor-garage-neon")),
        "changer-fond-photo-voiture": lambda: split(photo("voiture-04"), aligned("voiture-04", "parking-souterrain")),
        "enlever-arriere-plan-photo-voiture": lambda: split(photo("voiture-02"), aligned("voiture-02", "garage-neon")),
        "logiciel-retouche-photo-voiture": lambda: split(photo("voiture-03"), aligned("voiture-03", "hangar-industriel")),
        "meilleur-angle-photo-voiture": lambda: fit(photo("voiture-02")),
        "photo-voiture-smartphone": lambda: fit(site("plate-before")),
        "nettoyage-voiture-avant-vente": lambda: fit(photo("voiture-03")),
        "photo-interieur-voiture": lambda: fit(photo("voiture-04")),
        "studio-photo-voiture": lambda: fit(site("decor-hangar-industriel")),
        "photo-voiture-fond-blanc": lambda: fit(render("voiture-02", "piece-vide")),
        "eclairage-photo-voiture": lambda: fit(render("voiture-02", "garage-neon")),
        "retouche-photo-voiture-ia": lambda: fit(render("voiture-03", "garage-neon")),
        "photo-voiture-fond-noir": lambda: fit(render("voiture-04", "garage-neon")),
        "photo-voiture-concession": lambda: fit(site("decor-parking-souterrain")),
        "photo-annonce-voiture": lambda: fit(site("decor-piece-vide")),
        "nombre-photos-annonce-voiture": lambda: grid([
            site("decor-garage-neon"), render("voiture-03", "hangar-industriel"),
            render("voiture-04", "parking-souterrain"), render("voiture-02", "piece-vide"),
        ]),
    }
    for slug, make in pictures.items():
        Image.fromarray(make()).save(OUT / f"{slug}.webp", quality=82, method=6)
        print(slug)


if __name__ == "__main__":
    main()
