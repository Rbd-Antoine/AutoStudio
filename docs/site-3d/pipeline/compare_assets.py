"""Pictures of the home page's before/after comparator (chapter 3), public/compare/.

For each sample car: the customer photo as taken, and AutoStudio's real render of it on each of
the editor's four backgrounds, warped onto the photo's frame (same similarity fit as
prepare_v2.py). The comparator slides one over the other, so a render is only kept if the car
did not move: the fit must be a pure 2x downscale (the model returns the photo at twice the size)
with enough matching points. A render that fails is reported and left out; draw it again.

voiture-01 reuses the home page's layers (public/site-3d, already aligned, badge erased).

Output, per car (1600 x 1200, `-sm` at 800 x 600, quality 82):
  public/compare/<car>/before.webp, <decor>.webp, and thumb-<decor>.webp / thumb.webp (240 x 180)

Run from the repository root:  python docs/site-3d/pipeline/compare_assets.py
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
from guide_images import photo, render, site  # noqa: E402
from prepare_v2 import align_to_photo  # noqa: E402

OUT = ROOT / "public" / "compare"
DECORS = ["garage-neon", "hangar-industriel", "parking-souterrain", "piece-vide"]
W, H = 1600, 1200
# The render kept for each car and decor, by tag, first match wins (renders/ is not committed).
TAGS = ["c", "g"]


def save(img: np.ndarray, path: Path) -> None:
    pil = Image.fromarray(img)
    pil.save(path.with_suffix(".webp"), quality=82, method=6)
    pil.resize((W // 2, H // 2), Image.Resampling.LANCZOS).save(path.parent / f"{path.stem}-sm.webp", quality=82, method=6)
    pil.resize((240, 180), Image.Resampling.LANCZOS).save(path.parent / f"thumb-{path.stem}.webp", quality=80, method=6)


def aligned(car: str, decor: str) -> np.ndarray | None:
    base = photo(car)
    for tag in TAGS:
        if not (HERE / "renders" / f"{car}__{decor}__gemini-nano-banana-2.1__{tag}.png").exists():
            continue
        r = render(car, decor, tag)
        m = align_to_photo(r, base)
        scale = float(np.hypot(m[0, 0], m[0, 1]))
        if abs(scale - 0.5) > 0.004:
            print(f"  REFUSÉ {car} {decor} {tag} : la voiture a bougé (échelle {scale:.4f})")
            continue
        to_out = np.array([[W / base.shape[1], 0, 0], [0, H / base.shape[0], 0]], np.float64)
        m_out = to_out @ np.vstack([m, [0, 0, 1]])
        return cv2.warpAffine(r, m_out, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REFLECT)
    print(f"  MANQUANT {car} {decor}")
    return None


def main() -> None:
    missing = 0
    for car in ["voiture-01", "voiture-02", "voiture-03", "voiture-04"]:
        print(car)
        out = OUT / car
        out.mkdir(parents=True, exist_ok=True)
        if car == "voiture-01":
            save(site("plate-before"), out / "before")
            for d in DECORS:
                save(site(f"decor-{d}"), out / d)
            continue
        save(cv2.resize(photo(car), (W, H), interpolation=cv2.INTER_LANCZOS4), out / "before")
        for d in DECORS:
            img = aligned(car, d)
            if img is None:
                missing += 1
            else:
                save(img, out / d)
    print("manquants :", missing)


if __name__ == "__main__":
    main()
