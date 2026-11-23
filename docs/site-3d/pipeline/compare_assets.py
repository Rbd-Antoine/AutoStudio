"""Pictures of the home page's before/after comparator (chapter 3), public/compare/.

For each sample car: the "before" photo, and AutoStudio's real render of it on each of the
editor's four backgrounds (render.ts, the product's prompt and model, 2K), warped onto the photo's
frame (same similarity fit as prepare_v2.py). The comparator slides one over the other, so a
render is only kept if the car did not move: the fit must be a pure downscale by the photo/render
size ratio, with enough matching points. A render that fails is reported and left out.

Since 2026-11-23 the sample cars are premium cars whose "before" photos were generated for the
demo (render.ts --scene=coupe|suv|berline|sportive): generic designs, no brand, no plate text,
shot like a dealer's phone photo on his lot. The page says so.

Output, per car (2000 x 1500 for high-density screens, `-sm` at 1000 x 750, quality 84):
  public/compare/<car>/before.webp, <decor>.webp, thumb-<name>.webp (240 x 180)

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
from prepare_v2 import align_to_photo  # noqa: E402

OUT = ROOT / "public" / "compare"
DECORS = ["garage-neon", "hangar-industriel", "parking-souterrain", "piece-vide"]
CARS = ["coupe", "suv", "berline", "sportive"]
W, H = 2000, 1500
# Draws tried in order: a second draw ("q") replaces a first one that moved the car.
TAGS = ["p", "q", "r", "s"]
# Draws seen by eye and refused although aligned: the car changed. Never shown.
REJECTED = {
    "coupe__piece-vide__gemini-nano-banana-2.1__q.png": "emblème de marque ajouté sur le capot",
}


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def save(img: np.ndarray, path: Path) -> None:
    pil = Image.fromarray(img).resize((W, H), Image.Resampling.LANCZOS)
    pil.save(path.with_suffix(".webp"), quality=84, method=6)
    pil.resize((W // 2, H // 2), Image.Resampling.LANCZOS).save(path.parent / f"{path.stem}-sm.webp", quality=84, method=6)
    pil.resize((240, 180), Image.Resampling.LANCZOS).save(path.parent / f"thumb-{path.stem}.webp", quality=80, method=6)


def aligned(photo: np.ndarray, render_file: Path) -> np.ndarray | None:
    render = load(render_file)
    small = cv2.resize(photo, (1200, round(1200 * photo.shape[0] / photo.shape[1])), interpolation=cv2.INTER_AREA)
    m = align_to_photo(render, small)
    expected = small.shape[1] / render.shape[1]
    scale = float(np.hypot(m[0, 0], m[0, 1]))
    if abs(scale / expected - 1) > 0.008:
        print(f"  REFUSÉ {render_file.name} : la voiture a bougé (échelle {scale:.4f}, attendue {expected:.4f})")
        return None
    to_out = np.array([[W / small.shape[1], 0, 0], [0, H / small.shape[0], 0]], np.float64)
    m_out = to_out @ np.vstack([m, [0, 0, 1]])
    return cv2.warpAffine(render, m_out, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


def main() -> None:
    missing = 0
    for car in CARS:
        print(car)
        out = OUT / car
        out.mkdir(parents=True, exist_ok=True)
        photo = load(ROOT / "public" / "showcase" / "premium" / car / "before.webp")
        save(photo, out / "before")
        for d in DECORS:
            img = None
            for tag in TAGS:
                f = HERE / "renders" / f"{car}__{d}__gemini-nano-banana-2.1__{tag}.png"
                if f.name in REJECTED:
                    print(f"  REFUSÉ {f.name} : {REJECTED[f.name]}")
                    continue
                if f.exists() and (img := aligned(photo, f)) is not None:
                    break
            if img is None:
                missing += 1
                print(f"  MANQUANT {car} {d}")
            else:
                save(img, out / d)
    print("manquants :", missing)


if __name__ == "__main__":
    main()
