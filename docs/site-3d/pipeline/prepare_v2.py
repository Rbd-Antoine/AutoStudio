"""Home page layers from real AutoStudio renders of one photo on the four editor backgrounds.

Version 2 (2026-11-22): the four renders were made with the product's own prompt and model
(render.ts, gemini-nano-banana-2.1, 2K). Each is the customer photo at twice the size with only
the decor replaced (measured: scale 0.5000, shift about 2 px), so every layer is aligned on the
photo's frame and the car stays in place from one decor to the next. Nothing is composited any
more: chapter 3 shows the four real renders.

Output, public/site-3d/ (frame 1600 x 1200, `-sm` variants at 800 x 600):
  plate-before        the customer photo (upscaled), badge erased
  decor-<slug>        each real render aligned on the photo, badge erased (garage-neon = studio)
  car                 the car's matte with the studio render's pixels (the car layer of chapter 2)
  still-*, thumb-*    still images (reduced motion, loading) and the picker's thumbnails
  scene.json          frame, car box and the studio's light positions (scene units 1200 x 900)

Run from the repository root:  python docs/site-3d/pipeline/prepare_v2.py
"""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / "public" / "site-3d"
DEBUG = HERE / "debug"
BEFORE = ROOT / "public" / "showcase" / "voitures" / "voiture-01" / "before.webp"
RENDERS = {
    "garage-neon": "voiture-01__garage-neon__gemini-nano-banana-2.1__a.png",
    "hangar-industriel": "voiture-01__hangar-industriel__gemini-nano-banana-2.1__a.png",
    "parking-souterrain": "voiture-01__parking-souterrain__gemini-nano-banana-2.1__a.png",
    "piece-vide": "voiture-01__piece-vide__gemini-nano-banana-2.1__b.png",
}
W, H = 1600, 1200
K = W / 1200  # output pixels per scene unit (the scene is described in the photo's 1200 x 900 frame)

# Hand corrections, in the photo's frame (1200 x 900), carried over from version 1 (whose frame
# was the old render's, 87 px lower): the floor that GrabCut keeps under the car, the front tyre
# kept whole, and the grille badge (no brand logo on the site).
DY = -87.1
FLOOR_POLYGONS = [
    [(318, 565), (478, 612), (493, 640), (491, 680), (500, 720), (516, 748), (318, 748)],
    [(625, 668), (650, 668), (800, 652), (910, 630), (1000, 598), (1010, 770), (625, 770)],
]
UNDER_TYRE_BAND = (440, 700, 1010, 775)
FRONT_TYRE = ((563, 668), (66, 76))
BADGE = (930, 478, 25)


def to_out(x: float, y: float) -> tuple[int, int]:
    return int(round((x + 0.8) * K)), int(round((y + DY) * K))


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def align_to_photo(render: np.ndarray, photo: np.ndarray) -> np.ndarray:
    """2x3 similarity from the render's pixels to the photo's, fitted on ORB matches (the car)."""
    orb = cv2.ORB_create(nfeatures=8000)
    ka, da = orb.detectAndCompute(cv2.cvtColor(render, cv2.COLOR_RGB2GRAY), None)
    kb, db = orb.detectAndCompute(cv2.cvtColor(photo, cv2.COLOR_RGB2GRAY), None)
    pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da, db, k=2)
    good = [p[0] for p in pairs if len(p) == 2 and p[0].distance < 0.75 * p[1].distance]
    pa = np.float32([ka[m.queryIdx].pt for m in good])
    pb = np.float32([kb[m.trainIdx].pt for m in good])
    m, inliers = cv2.estimateAffinePartial2D(pa, pb, method=cv2.RANSAC, ransacReprojThreshold=2.0)
    print(f"  align: {len(good)} matches, {int(inliers.sum())} inliers, scale {np.hypot(m[0, 0], m[0, 1]):.4f}, shift {m[:, 2].round(1)}")
    return m


def erase_badge(img: np.ndarray) -> np.ndarray:
    cx, cy = to_out(BADGE[0], BADGE[1])
    mask = np.zeros(img.shape[:2], np.uint8)
    cv2.circle(mask, (cx, cy), int(BADGE[2] * K), 255, -1)
    out = cv2.inpaint(cv2.cvtColor(img, cv2.COLOR_RGB2BGR), mask, 9, cv2.INPAINT_TELEA)
    return cv2.cvtColor(out, cv2.COLOR_BGR2RGB)


def matte(photo: np.ndarray, studio: np.ndarray) -> np.ndarray:
    """The car: where the photo and the render agree (AutoStudio leaves the car untouched)."""
    a = cv2.GaussianBlur(photo, (0, 0), 2.5).astype(np.float32)
    b = cv2.GaussianBlur(studio, (0, 0), 2.5).astype(np.float32)
    diff = np.linalg.norm(a - b, axis=2)
    same = (diff < 40).astype(np.uint8)
    different = (diff > 75).astype(np.uint8)
    h, w = same.shape
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    same = cv2.morphologyEx(same, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(same)
    centre = labels[h // 2, w // 2] or 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    car = labels == centre
    mask[car] = cv2.GC_PR_FGD
    mask[cv2.erode(car.astype(np.uint8), np.ones((33, 33), np.uint8)) > 0] = cv2.GC_FGD
    mask[cv2.erode(different, np.ones((11, 11), np.uint8)) > 0] = cv2.GC_BGD
    mask[:8, :] = mask[-8:, :] = cv2.GC_BGD
    mask[:, :8] = mask[:, -8:] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(studio, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    car = np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(car)
    if n > 1:
        car = (labels == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    car = cv2.morphologyEx(car, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    filled = car.copy()
    contours, _ = cv2.findContours(car, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)
    # The hand corrections under the car.
    cut = np.zeros_like(filled)
    for poly in FLOOR_POLYGONS:
        cv2.fillPoly(cut, [np.int32([to_out(x, y) for x, y in poly])], 1)
    x0, y0 = to_out(UNDER_TYRE_BAND[0], UNDER_TYRE_BAND[1])
    x1, y1 = to_out(UNDER_TYRE_BAND[2], UNDER_TYRE_BAND[3])
    cut[y0:y1, x0:x1] = 1
    tyre = np.zeros_like(filled)
    (tx, ty), (rx, ry) = to_out(*FRONT_TYRE[0]), (int(FRONT_TYRE[1][0] * K), int(FRONT_TYRE[1][1] * K))
    cv2.ellipse(tyre, (tx, ty), (rx, ry), 0, 0, 360, 1, -1)
    filled[(cut > 0) & (tyre == 0)] = 0
    return cv2.GaussianBlur((filled * 255).astype(np.uint8), (0, 0), 1.4)


def lights(studio: np.ndarray) -> list[dict]:
    """The studio's lamps: bright compact blobs in the top half and tall bluish strips at the sides."""
    lum = studio.astype(np.float32).mean(axis=2)
    found: list[dict] = []
    top = ((lum > 238).astype(np.uint8))
    top[int(H * 0.36):, :] = 0
    n, _, stats, cents = cv2.connectedComponentsWithStats(top)
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area > 250 * K * K and w > 1.6 * h:
            found.append({"kind": "point", "at": [round(cents[i][0] / K), round(cents[i][1] / K)], "area": int(area)})
    blue = ((studio[..., 2].astype(int) > 205) & (studio[..., 2].astype(int) - studio[..., 0].astype(int) > 20)).astype(np.uint8)
    n, _, stats, _ = cv2.connectedComponentsWithStats(blue)
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if h > 280 * K and w < 60 * K:
            found.append({"kind": "segment", "a": [round((x + w / 2) / K), round(y / K)], "b": [round((x + w / 2) / K), round((y + h) / K)], "area": int(area)})
    return found


def write(name: str, img: np.ndarray, quality: int = 84, alpha: bool = False) -> None:
    pil = Image.fromarray(img)
    pil.save(OUT / f"{name}.webp", quality=quality, method=6, **({"exact": True} if alpha else {}))
    pil.resize((pil.width // 2, pil.height // 2), Image.Resampling.LANCZOS).save(OUT / f"{name}-sm.webp", quality=quality, method=6)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    DEBUG.mkdir(parents=True, exist_ok=True)
    photo_small = load(BEFORE)
    photo = cv2.resize(photo_small, (W, H), interpolation=cv2.INTER_LANCZOS4)
    to_photo_out = np.array([[K, 0, 0], [0, K, 0]], np.float64)

    plates: dict[str, np.ndarray] = {}
    for slug, file in RENDERS.items():
        print(slug)
        render = load(HERE / "renders" / file)
        m = align_to_photo(render, photo_small)
        m_out = to_photo_out @ np.vstack([m, [0, 0, 1]])
        plates[slug] = cv2.warpAffine(render, m_out, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REFLECT)

    studio = plates["garage-neon"]
    alpha = matte(photo, studio)
    preview = (studio * (alpha[..., None] / 255.0) + np.array([255, 0, 255]) * (1 - alpha[..., None] / 255.0)).astype(np.uint8)
    Image.fromarray(preview).save(DEBUG / "v2_matte_preview.jpg", quality=85)

    photo = erase_badge(photo)
    for slug in plates:
        plates[slug] = erase_badge(plates[slug])

    write("plate-before", photo)
    write("still-avant", photo)
    for slug, plate in plates.items():
        write(f"decor-{slug}", plate)
        write(f"still-{slug}", plate)
        Image.fromarray(cv2.resize(plate, (320, 240), interpolation=cv2.INTER_AREA)).save(OUT / f"thumb-{slug}.webp", quality=82, method=6)
    write("still-studio", plates["garage-neon"])
    write("car", np.dstack([plates["garage-neon"], alpha]), quality=90, alpha=True)

    ys, xs = np.nonzero(alpha > 128)
    meta = {
        "frame": [1200, 900],
        "carBox": [round(xs.min() / K), round(ys.min() / K), round(xs.max() / K), round(ys.max() / K)],
        "lights": lights(plates["garage-neon"]),
    }
    (OUT / "scene.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
