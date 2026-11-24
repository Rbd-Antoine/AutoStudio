"""Home page layers, version 3 (2026-11-23): the premium coupe instead of the white SUV.

Same method as prepare_v2.py, for a car with no badge to erase and no hand corrections: the
"before" photo (public/showcase/premium/coupe/before.webp, a generated example, shot like a
dealer's phone photo) and AutoStudio's real renders of it (render.ts, 2K), aligned on the photo's
frame. The car layer of chapter 2 is the matte of the car (where photo and studio render agree,
refined by GrabCut) with the studio render's pixels.

Output, public/site-3d/ (frame 1600 x 1200, `-sm` at 800 x 600): plate-before, decor-<slug>, car,
still-*, thumb-*, scene.json. Run from the repository root: python docs/site-3d/pipeline/prepare_v3.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from prepare_v2 import align_to_photo  # noqa: E402

OUT = ROOT / "public" / "site-3d"
DEBUG = HERE / "debug"
CAR = "coupe"
BEFORE = ROOT / "public" / "showcase" / "premium" / CAR / "before.webp"
# The home page's scene shows one studio: the evening showroom (since 2026-11-24, the editor's
# premium backgrounds). The other backgrounds are shown by the comparator (compare_assets.py).
RENDERS = {
    "showroom-nuit": f"{CAR}__showroom-nuit__gemini-nano-banana-2.1__n.png",
}
W, H = 1600, 1200
K = W / 1200

# Hand correction, in the output frame (1600 x 1200): the dark floor that photo and render share
# under the car (its shadow) is cut below the sill and the bumper, the two tyres kept whole.
FLOOR_LINE = [(0, 704), (120, 704), (236, 690), (280, 644), (586, 806), (600, 840), (686, 984),
              (800, 960), (826, 946), (1334, 906), (1466, 866), (1600, 840)]
TYRES = [((170, 580), (70, 116)), ((700, 800), (106, 180))]


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def matte(photo: np.ndarray, studio: np.ndarray) -> np.ndarray:
    """The car: where the photo and the studio render agree (AutoStudio leaves the car untouched)."""
    a = cv2.GaussianBlur(photo, (0, 0), 2.5).astype(np.float32)
    b = cv2.GaussianBlur(studio, (0, 0), 2.5).astype(np.float32)
    diff = np.linalg.norm(a - b, axis=2)
    same = cv2.morphologyEx((diff < 38).astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    different = (diff > 70).astype(np.uint8)
    h, w = same.shape
    n, labels, stats, _ = cv2.connectedComponentsWithStats(same)
    centre = labels[int(h * 0.55), w // 2] or 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    car = labels == centre
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    mask[car] = cv2.GC_PR_FGD
    mask[cv2.erode(car.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0] = cv2.GC_FGD
    mask[cv2.erode(different, np.ones((11, 11), np.uint8)) > 0] = cv2.GC_BGD
    mask[:8, :] = mask[-8:, :] = cv2.GC_BGD
    mask[:, :8] = mask[:, -8:] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(studio, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    out = np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(out)
    if n > 1:
        out = (labels == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    out = cv2.morphologyEx(out, cv2.MORPH_CLOSE, np.ones((13, 13), np.uint8))
    filled = out.copy()
    contours, _ = cv2.findContours(out, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)
    cut = np.zeros_like(filled)
    cv2.fillPoly(cut, [np.int32(FLOOR_LINE + [(w, h), (0, h)])], 1)
    tyres = np.zeros_like(filled)
    for centre, axes in TYRES:
        cv2.ellipse(tyres, centre, axes, 0, 0, 360, 1, -1)
    filled[(cut > 0) & (tyres == 0)] = 0
    return cv2.GaussianBlur((filled * 255).astype(np.uint8), (0, 0), 1.4)


def write(name: str, img: np.ndarray, quality: int = 86, alpha: bool = False) -> None:
    pil = Image.fromarray(img)
    pil.save(OUT / f"{name}.webp", quality=quality, method=6, **({"exact": True} if alpha else {}))
    pil.resize((pil.width // 2, pil.height // 2), Image.Resampling.LANCZOS).save(OUT / f"{name}-sm.webp", quality=quality, method=6)


def main() -> None:
    DEBUG.mkdir(parents=True, exist_ok=True)
    photo_src = load(BEFORE)
    photo = cv2.resize(photo_src, (W, H), interpolation=cv2.INTER_LANCZOS4)
    photo_small = cv2.resize(photo_src, (1200, 900), interpolation=cv2.INTER_AREA)
    to_out = np.array([[K, 0, 0], [0, K, 0]], np.float64)
    plates: dict[str, np.ndarray] = {}
    for slug, file in RENDERS.items():
        print(slug)
        render = load(HERE / "renders" / file)
        m = align_to_photo(render, photo_small)
        plates[slug] = cv2.warpAffine(render, to_out @ np.vstack([m, [0, 0, 1]]), (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REFLECT)

    studio = plates["showroom-nuit"]
    alpha = matte(photo, studio)
    preview = (studio * (alpha[..., None] / 255.0) + np.array([255, 0, 255]) * (1 - alpha[..., None] / 255.0)).astype(np.uint8)
    Image.fromarray(preview).save(DEBUG / "v3_matte_preview.jpg", quality=85)

    write("plate-before", photo)
    write("still-avant", photo)
    for slug, plate in plates.items():
        write(f"decor-{slug}", plate)
        write(f"still-{slug}", plate)
        Image.fromarray(cv2.resize(plate, (320, 240), interpolation=cv2.INTER_AREA)).save(OUT / f"thumb-{slug}.webp", quality=82, method=6)
    write("still-studio", studio)
    write("car", np.dstack([studio, alpha]), quality=90, alpha=True)
    ys, xs = np.nonzero(alpha > 128)
    meta = {"frame": [1200, 900], "car": CAR, "carBox": [round(xs.min() / K), round(ys.min() / K), round(xs.max() / K), round(ys.max() / K)]}
    (OUT / "scene.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta))


if __name__ == "__main__":
    main()
