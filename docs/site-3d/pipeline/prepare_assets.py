"""Prepares the layers of the home page's 2.5D studio scene from real AutoStudio renders.

Input: public/showcase/voitures/voiture-01/{before,after}.webp (a real customer photo and its
real AutoStudio render). Output: public/site-3d/ (new files only).

1. Aligns the photo onto the render with a similarity fitted on the car, so that crossfading
   the two shows the decor changing around a car that does not move — the product's promise.
2. Mattes the car: where the aligned photo and render agree (the car, which AutoStudio leaves
   untouched) versus where they differ (the decor), refined with GrabCut.
3. Erases the grille badge (no brand logo on the site), on both pictures.
4. Writes: plates (photo and render, aligned, same frame), the car cut-out with alpha, a soft
   contact-shadow map, and per-plate versions with the car area filled for parallax.

Run from the repository root:  python docs/site-3d/pipeline/prepare_assets.py
Needs: numpy, opencv-python(-headless), pillow.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "public" / "showcase" / "voitures" / "voiture-01"
OUT = ROOT / "public" / "site-3d"
DEBUG = ROOT / "docs" / "site-3d" / "pipeline" / "debug"


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def save_debug(name: str, img: np.ndarray) -> None:
    DEBUG.mkdir(parents=True, exist_ok=True)
    Image.fromarray(img).save(DEBUG / name, quality=85)


def align(before: np.ndarray, after: np.ndarray) -> np.ndarray:
    """2x3 similarity mapping `before` pixels onto `after` pixels, fitted on ORB matches.

    The decor differs entirely between the two, so RANSAC keeps the matches on the car.
    """
    orb = cv2.ORB_create(nfeatures=6000)
    ga, gb = cv2.cvtColor(before, cv2.COLOR_RGB2GRAY), cv2.cvtColor(after, cv2.COLOR_RGB2GRAY)
    ka, da = orb.detectAndCompute(ga, None)
    kb, db = orb.detectAndCompute(gb, None)
    pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da, db, k=2)
    good = [p[0] for p in pairs if len(p) == 2 and p[0].distance < 0.75 * p[1].distance]
    pa = np.float32([ka[m.queryIdx].pt for m in good])
    pb = np.float32([kb[m.trainIdx].pt for m in good])
    m, inliers = cv2.estimateAffinePartial2D(pa, pb, method=cv2.RANSAC, ransacReprojThreshold=2.0)
    print(f"align: {len(good)} matches, {int(inliers.sum())} inliers, scale {np.hypot(m[0,0], m[0,1]):.4f}, "
          f"shift ({m[0,2]:.1f}, {m[1,2]:.1f})")
    return m


def matte(before_aligned: np.ndarray, after: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Car alpha (uint8) in the render's frame."""
    a = cv2.GaussianBlur(before_aligned, (0, 0), 2).astype(np.float32)
    b = cv2.GaussianBlur(after, (0, 0), 2).astype(np.float32)
    # Colour-normalised difference: the render may relight the car slightly.
    diff = np.linalg.norm(a - b, axis=2)
    same = (diff < 38) & valid
    diff_bin = ((diff > 70) | ~valid).astype(np.uint8)

    h, w = same.shape
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    # Largest connected "same" blob near the centre is the car: probable foreground.
    same_u8 = cv2.morphologyEx(same.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(same_u8)
    centre = labels[h // 2, w // 2]
    if centre == 0:
        centre = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    car_seed = labels == centre
    mask[car_seed] = cv2.GC_PR_FGD
    mask[cv2.erode(car_seed.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0] = cv2.GC_FGD
    mask[cv2.dilate(diff_bin, np.ones((3, 3), np.uint8)) > 0] = cv2.GC_PR_BGD
    mask[cv2.erode(diff_bin, np.ones((9, 9), np.uint8)) > 0] = cv2.GC_BGD
    # Frame borders are decor.
    mask[:6, :] = mask[-6:, :] = cv2.GC_BGD
    mask[:, :6] = mask[:, -6:] = cv2.GC_BGD

    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(after, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    car = np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
    # Keep the main blob, fill holes (windows show the decor through: they are decided below).
    n, labels, stats, _ = cv2.connectedComponentsWithStats(car)
    if n > 1:
        car = (labels == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    car = cv2.morphologyEx(car, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    filled = car.copy()
    contours, _ = cv2.findContours(car, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)
    alpha = (filled * 255).astype(np.uint8)
    # Soft 1.5 px edge.
    return cv2.GaussianBlur(alpha, (0, 0), 1.2)


# Floor kept by GrabCut under the car (the photo's shadowed asphalt and the render's floor look
# alike there): removed by hand, in the render frame. Polygons picked on a grid over the matte
# preview; the front tyre (an ellipse in this three-quarter view) is kept whole.
FLOOR_POLYGONS = [
    [(318, 565), (478, 612), (493, 640), (491, 680), (500, 720), (516, 748), (318, 748)],
    [(625, 668), (650, 668), (800, 652), (910, 630), (1000, 598), (1010, 770), (625, 770)],
]
UNDER_TYRE_BAND = (440, 700, 1010, 775)   # x0, y0, x1, y1: floor below the front tyre...
FRONT_TYRE = ((563, 668), (66, 76))       # ...except the tyre itself (ellipse: centre, half-axes)


def remove_floor(alpha: np.ndarray) -> np.ndarray:
    hard = (alpha > 127).astype(np.uint8)
    cut = np.zeros_like(hard)
    for poly in FLOOR_POLYGONS:
        cv2.fillPoly(cut, [np.int32(poly)], 1)
    x0, y0, x1, y1 = UNDER_TYRE_BAND
    cut[y0:y1, x0:x1] = 1
    tyre = np.zeros_like(hard)
    cv2.ellipse(tyre, FRONT_TYRE[0], FRONT_TYRE[1], 0, 0, 360, 1, -1)
    hard[(cut > 0) & (tyre == 0)] = 0
    return cv2.GaussianBlur((hard * 255).astype(np.uint8), (0, 0), 1.2)


def erase_badge(img: np.ndarray, centre: tuple[int, int], radius: int) -> np.ndarray:
    m = np.zeros(img.shape[:2], np.uint8)
    cv2.circle(m, centre, radius, 255, -1)
    out = cv2.inpaint(cv2.cvtColor(img, cv2.COLOR_RGB2BGR), m, 9, cv2.INPAINT_TELEA)
    return cv2.cvtColor(out, cv2.COLOR_BGR2RGB)


def fill_behind_car(img: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """The plate with the car area filled from its surroundings, for small parallax reveals."""
    hole = cv2.dilate((alpha > 8).astype(np.uint8) * 255, np.ones((21, 21), np.uint8))
    small = cv2.resize(cv2.cvtColor(img, cv2.COLOR_RGB2BGR), None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    hole_s = cv2.resize(hole, (small.shape[1], small.shape[0]), interpolation=cv2.INTER_NEAREST)
    filled_s = cv2.inpaint(small, hole_s, 15, cv2.INPAINT_TELEA)
    filled = cv2.resize(filled_s, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC)
    filled = cv2.cvtColor(filled, cv2.COLOR_BGR2RGB)
    k = (cv2.GaussianBlur(hole, (0, 0), 6) / 255.0)[..., None]
    return np.clip(img * (1 - k) + filled * k, 0, 255).astype(np.uint8)


# Where the wheels touch the floor, in the render frame: rear-left and front-left are visible,
# front-right sits under the bumper corner, rear-right is hidden behind the body (completed as
# a parallelogram). The quadrilateral is the car's footprint.
WHEELS = {"rear_left": (272, 588), "front_left": (566, 744), "front_right": (975, 642)}


def contact_shadow(alpha: np.ndarray) -> np.ndarray:
    """The car's shadow on the floor, so it never floats: the footprint between the four
    wheels (dense, softly blurred), tight dark spots where the visible tyres touch, and a wide
    soft halo for the ambient occlusion of a studio floor."""
    h, w = alpha.shape
    rl, fl, fr = (np.array(WHEELS[k], np.float32) for k in ("rear_left", "front_left", "front_right"))
    rr = rl + (fr - fl)
    footprint = np.zeros((h, w), np.float32)
    cv2.fillPoly(footprint, [np.int32([rl, fl, fr, rr])], 1.0)
    core = cv2.GaussianBlur(footprint, (0, 0), 16) * 0.9
    soft = cv2.GaussianBlur(cv2.dilate(footprint, np.ones((61, 61), np.uint8)), (0, 0), 45) * 0.45
    spots = np.zeros_like(footprint)
    for (x, y), (rx, ry) in ((WHEELS["rear_left"], (40, 8)), (WHEELS["front_left"], (62, 11))):
        cv2.ellipse(spots, (int(x), int(y)), (rx, ry), 0, 0, 360, 1.0, -1)
    spots = cv2.GaussianBlur(spots, (0, 0), 4)
    shadow = np.clip(np.maximum(np.maximum(core, soft), spots), 0, 1)
    return (shadow * 255).astype(np.uint8)


# The editor's four backgrounds, fitted to the scene frame: the line where the back wall meets
# the floor (fraction of the image height) lands behind the car, so its wheels stand on the floor.
# "garage-neon" uses the real AutoStudio render of this very car instead (its plate, car removed).
BACKGROUNDS = {
    "hangar-industriel": ("cb187f9b69244990a901aa51287240a3.jpeg", 0.65),
    "parking-souterrain": ("parking-souterrain-dans-centre-commercial_93675-134900.jpg", 0.60),
    "piece-vide": ("chambre-moderne-vide_23-2150528603.jpg", 0.67),
}
WALL_LINE_Y = 0.64  # in the scene frame


def fit_background(path: Path, wall_fraction: float, w: int, h: int) -> np.ndarray:
    img = load(path)
    bh, bw = img.shape[:2]
    target = WALL_LINE_Y * h
    s = max(w / bw, h / bh, target / (wall_fraction * bh), (h - target) / ((1 - wall_fraction) * bh))
    resized = cv2.resize(img, (round(bw * s), round(bh * s)), interpolation=cv2.INTER_CUBIC)
    oy = round(target - s * wall_fraction * bh)
    ox = round((resized.shape[1] - w) / 2)
    crop = resized[-oy:-oy + h, ox:ox + w]
    # A touch of depth of field: the sources are small, and a studio shot keeps the car sharpest.
    return cv2.GaussianBlur(crop, (0, 0), 1.1)


def write(name: str, img: np.ndarray, quality: int = 84, lossless_alpha: bool = False) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pil = Image.fromarray(img)
    pil.save(OUT / f"{name}.webp", quality=quality, method=6, **({"exact": True} if lossless_alpha else {}))
    small = pil.resize((pil.width // 2, pil.height // 2), Image.Resampling.LANCZOS)
    small.save(OUT / f"{name}-sm.webp", quality=quality, method=6)


def main() -> None:
    before, after = load(SRC / "before.webp"), load(SRC / "after.webp")
    h, w = after.shape[:2]
    m = align(before, after)
    before_al = cv2.warpAffine(before, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    valid = cv2.warpAffine(np.full(before.shape[:2], 255, np.uint8), m, (w, h)) > 0
    save_debug("before_aligned.jpg", before_al)

    alpha = remove_floor(matte(before_al, after, valid))
    save_debug("matte.jpg", alpha)
    preview = (after * (alpha[..., None] / 255.0) + np.array([255, 0, 255]) * (1 - alpha[..., None] / 255.0)).astype(np.uint8)
    save_debug("matte_preview.jpg", preview)

    params = json.loads((Path(__file__).parent / "badge.json").read_text()) if (Path(__file__).parent / "badge.json").exists() else None
    if params:
        cx, cy, r = params["after"]
        after = erase_badge(after, (cx, cy), r)
        before_al = erase_badge(before_al, (cx, cy), r)
    save_debug("after_badge.jpg", after[300:700, 700:1100])

    car_rgba = np.dstack([before_al, alpha])
    write("car", car_rgba, quality=90, lossless_alpha=True)
    write("plate-before", before_al)
    write("plate-after", after)
    write("plate-before-fill", fill_behind_car(before_al, alpha))
    write("plate-after-fill", fill_behind_car(after, alpha))
    shadow = contact_shadow(alpha)
    Image.fromarray(shadow).save(OUT / "shadow.webp", quality=80, method=6)
    for slug, (file, frac) in BACKGROUNDS.items():
        write(f"bg-{slug}", fit_background(ROOT / "public" / "background" / file, frac, w, h))
    # Stills: one image per chapter for reduced motion, the loading moment and no-WebGL browsers.
    def composite(plate: np.ndarray) -> np.ndarray:
        shaded = plate.astype(np.float32) * (1 - 0.86 * shadow[..., None] / 255.0)
        a = alpha[..., None] / 255.0
        return np.clip(shaded * (1 - a) + before_al * a, 0, 255).astype(np.uint8)

    write("still-avant", before_al)
    write("still-studio", after)
    write("still-garage-neon", after)
    decor_plates = {"garage-neon": fill_behind_car(after, alpha)}
    for slug, (file, frac) in BACKGROUNDS.items():
        plate = fit_background(ROOT / "public" / "background" / file, frac, w, h)
        decor_plates[slug] = plate
        write(f"still-{slug}", composite(plate))
    for slug, plate in decor_plates.items():
        Image.fromarray(cv2.resize(plate, (320, 240), interpolation=cv2.INTER_AREA)).save(OUT / f"thumb-{slug}.webp", quality=82, method=6)
    ys, xs = np.nonzero(alpha > 128)
    meta = {"width": w, "height": h, "carBox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]}
    (OUT / "scene.json").write_text(json.dumps(meta, indent=2))
    print("written", meta)


if __name__ == "__main__":
    sys.exit(main())
