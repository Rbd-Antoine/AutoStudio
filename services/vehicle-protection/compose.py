"""Pixel-level composition for vehicle protection, independent of any model.

Adapted from the sister product Florelis (where it restores the client's house in a garden
render). Kept apart from modal_app.py so it can be tested on a laptop without a GPU
(see tests/test_compose.py). Every function works on numpy RGB uint8 arrays.

The live flow:
1. pick_main_vehicle: of the vehicles detected on the dealer's photo, the one being sold;
   other cars of the lot are background, to be replaced like the rest of it.
2. vehicle_mask: its pixel mask, pulled in slightly at the edges (so no strip of the old
   background is pasted around the body) and with the glass taken out (the old background
   seen through the windows would contradict the new scene).
3. estimate_alignment: homography from the photo to the render, fitted on the vehicle so it
   lands exactly where the render put it. Refuses when the camera or the car moved too much.
4. compose: warps the photo and the mask into the render's frame, matches the photo's colour
   grade to the render's (clamped: the paint colour never changes), feathers and blends. The
   render keeps its own background, ground, shadows and reflections.
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

WORK_SIDE = 1280


def pick_main_vehicle(boxes: list[list[float]], scores: list[float], shape: tuple[int, ...]) -> int | None:
    """Index of the vehicle being sold among the detected boxes (x0, y0, x1, y1), or None.

    A dealer frames the car for sale: the largest box, weighted towards the centre of the
    picture and by detection confidence. A box that covers the whole frame (a detection
    failure) or that is tiny (a car far behind) is never chosen.
    """
    h, w = shape[:2]
    best, best_value = None, 0.0
    for index, ((x0, y0, x1, y1), score) in enumerate(zip(boxes, scores)):
        area = max(0.0, x1 - x0) * max(0.0, y1 - y0) / float(w * h)
        if area < 0.02 or area > 0.97:
            continue
        cx, cy = (x0 + x1) / 2 / w, (y0 + y1) / 2 / h
        centrality = 1.0 - min(1.0, float(np.hypot(cx - 0.5, cy - 0.5)) / 0.7071)
        value = area * (0.5 + 0.5 * centrality) * float(score)
        if value > best_value:
            best, best_value = index, value
    return best


def vehicle_mask(body: np.ndarray, glass: np.ndarray | None = None, inset_px: int = 2) -> np.ndarray:
    """The pixels to restore: the vehicle's mask pulled in by inset_px, minus its glass.

    body, glass: uint8 masks in the photo's frame (255 = in). The inset keeps the render's own
    silhouette edge: a margin outwards, as for a house against the sky, would paste a thin
    strip of the old background (the dealer's lot) around the body.
    """
    mask = (body > 127).astype(np.uint8) * 255
    if inset_px > 0:
        kernel = np.ones((2 * inset_px + 1, 2 * inset_px + 1), np.uint8)
        mask = cv2.erode(mask, kernel)
    if glass is not None and glass.any():
        g = cv2.resize(glass, (mask.shape[1], mask.shape[0]), interpolation=cv2.INTER_NEAREST) > 127
        # A little margin so the window frame's inner edge keeps no old-background pixels.
        g = cv2.dilate(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        mask[g] = 0
    return mask


class AlignmentError(RuntimeError):
    """The render's camera (or the car in it) moved too much to restore source pixels safely."""


@dataclass
class Alignment:
    homography: np.ndarray  # 3x3, source full-res pixels -> generated full-res pixels
    diagnostics: dict


def _scale_matrix(factor: float) -> np.ndarray:
    return np.array([[factor, 0, 0], [0, factor, 0], [0, 0, 1]], dtype=np.float64)


def _work_scale(shape: tuple[int, ...]) -> float:
    return min(1.0, WORK_SIDE / max(shape[0], shape[1]))


def estimate_alignment(
    source: np.ndarray,
    generated: np.ndarray,
    focus_mask: np.ndarray | None = None,
) -> Alignment:
    """Homography mapping source pixels onto the generated render.

    focus_mask (source frame, uint8) restricts source keypoints to the vehicle: the
    background is meant to change, the car is meant to stay, so matches on the car give
    the transform that matters. Falls back to the whole frame when the car has too
    little texture (a plain white van side).
    """
    s_src, s_gen = _work_scale(source.shape), _work_scale(generated.shape)
    src_small = cv2.resize(source, None, fx=s_src, fy=s_src, interpolation=cv2.INTER_AREA)
    gen_small = cv2.resize(generated, None, fx=s_gen, fy=s_gen, interpolation=cv2.INTER_AREA)
    src_gray = cv2.cvtColor(src_small, cv2.COLOR_RGB2GRAY)
    gen_gray = cv2.cvtColor(gen_small, cv2.COLOR_RGB2GRAY)

    detector = cv2.ORB_create(nfeatures=3000, scaleFactor=1.2, nlevels=8)
    key_b, desc_b = detector.detectAndCompute(gen_gray, None)
    if desc_b is None:
        raise AlignmentError("Not enough visual features in the render")

    attempts = []
    if focus_mask is not None:
        focus = cv2.resize(focus_mask, (src_gray.shape[1], src_gray.shape[0]), interpolation=cv2.INTER_NEAREST)
        focus = cv2.dilate((focus > 127).astype(np.uint8) * 255, np.ones((25, 25), np.uint8))
        attempts.append(("vehicle", focus))
    attempts.append(("frame", None))

    last_error: Exception | None = None
    for scope, mask in attempts:
        try:
            homography_small, diag = _fit(detector, src_gray, gen_gray, key_b, desc_b, mask)
        except AlignmentError as exc:
            last_error = exc
            continue
        # Back to full resolution: gen_full = S_gen^-1 . H_small . S_src
        homography = np.linalg.inv(_scale_matrix(s_gen)) @ homography_small @ _scale_matrix(s_src)
        homography /= homography[2, 2]
        diag["scope"] = scope
        _check_motion(homography, source.shape, generated.shape, diag)
        return Alignment(homography, diag)
    raise last_error or AlignmentError("Could not estimate camera alignment")


def _fit(detector, src_gray, gen_gray, key_b, desc_b, mask):
    key_a, desc_a = detector.detectAndCompute(src_gray, mask)
    if desc_a is None or len(key_a) < 30:
        raise AlignmentError("Not enough visual features on the vehicle")
    pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(desc_a, desc_b, k=2)
    good = [p[0] for p in pairs if len(p) == 2 and p[0].distance < 0.75 * p[1].distance]
    if len(good) < 25:
        raise AlignmentError("Not enough matching features between photo and render")
    pts_a = np.float32([key_a[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    pts_b = np.float32([key_b[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    # A similarity (shift, rotation, uniform scale), not a full homography as for a house: the
    # render redraws the car at most slightly moved, a car is not a plane, and the 8 degrees of
    # freedom of a homography fitted on one car's features drifted by 3 to 9 px at its corners
    # in the synthetic tests, against under 1 px for a similarity.
    affine, inliers = cv2.estimateAffinePartial2D(pts_a, pts_b, method=cv2.RANSAC, ransacReprojThreshold=3.0)
    if affine is None or inliers is None:
        raise AlignmentError("Could not estimate camera alignment")
    homography = np.vstack([affine, [0.0, 0.0, 1.0]])
    inliers = inliers.ravel().astype(bool)
    count = int(inliers.sum())
    ratio = count / len(good)
    if count < 20 or ratio < 0.25:
        raise AlignmentError("Photo and render do not share enough stable points")
    projected = cv2.perspectiveTransform(pts_a[inliers], homography)
    residual = float(np.median(np.linalg.norm(projected - pts_b[inliers], axis=2)))
    if residual > 2.5:
        raise AlignmentError(f"Alignment too loose ({residual:.1f}px median residual)")
    return homography / homography[2, 2], {
        "matches": len(good), "inliers": count, "inlierRatio": round(ratio, 3),
        "medianResidualPx": round(residual, 2),
    }


def _check_motion(homography: np.ndarray, src_shape, gen_shape, diag: dict) -> None:
    """Small shifts are corrected by the warp; a real change of viewpoint is refused."""
    h, w = src_shape[:2]
    gh, gw = gen_shape[:2]
    corners = np.float32([[0, 0], [w, 0], [w, h], [0, h]]).reshape(-1, 1, 2)
    mapped = cv2.perspectiveTransform(corners, homography).reshape(-1, 2)
    # Compare in the render's frame, with the source scaled to it as a plain resize would.
    expected = corners.reshape(-1, 2) * np.array([gw / w, gh / h], dtype=np.float32)
    diagonal = float(np.hypot(gw, gh))
    displacement = float(np.max(np.linalg.norm(mapped - expected, axis=1)) / diagonal)
    area_ratio = float(cv2.contourArea(mapped) / (gw * gh))
    diag["cornerShift"] = round(displacement, 4)
    diag["areaRatio"] = round(area_ratio, 4)
    if displacement > 0.04 or not 0.9 <= area_ratio <= 1.1:
        raise AlignmentError("The render's viewpoint changed; source pixels not restored")


def harmonize(source: np.ndarray, generated: np.ndarray, region: np.ndarray) -> tuple[np.ndarray, dict]:
    """Bring the source's colour grade within reach of the render's, over the vehicle.

    The new scene's light is warmer, colder or brighter than the dealer's lot: pasting the
    untouched car would then look cut out. Means and spreads are matched in Lab, with
    clamped gains and shifts so a render that repainted the car cannot drag the real paint
    to another colour (a and b, the colour axes, move less than lightness).
    """
    selected = region > 0.5
    if selected.sum() < 500:
        return source, {"applied": False}
    src_lab = cv2.cvtColor(source, cv2.COLOR_RGB2LAB).astype(np.float32)
    gen_lab = cv2.cvtColor(generated, cv2.COLOR_RGB2LAB).astype(np.float32)
    out = src_lab.copy()
    limits = [(0.85, 1.15, 12.0), (0.9, 1.1, 5.0), (0.9, 1.1, 5.0)]  # L, a, b: gain range, max shift
    applied = []
    for channel, (g_lo, g_hi, max_shift) in enumerate(limits):
        s_vals = src_lab[..., channel][selected]
        g_vals = gen_lab[..., channel][selected]
        s_mean, s_std = float(s_vals.mean()), float(s_vals.std()) + 1e-3
        g_mean, g_std = float(g_vals.mean()), float(g_vals.std()) + 1e-3
        gain = float(np.clip(g_std / s_std, g_lo, g_hi))
        shift = float(np.clip(g_mean - s_mean, -max_shift, max_shift))
        out[..., channel] = (src_lab[..., channel] - s_mean) * gain + s_mean + shift
        applied.append({"gain": round(gain, 3), "shift": round(shift, 2)})
    out = np.clip(out, 0, 255).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_LAB2RGB), {"applied": True, "lab": applied}


def compose(
    source: np.ndarray,
    generated: np.ndarray,
    protect_mask: np.ndarray,
    occluder_mask: np.ndarray | None,
    homography: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, dict]:
    """Restore the vehicle from the source, in the render's frame and resolution.

    protect_mask: uint8, source frame, 255 = vehicle pixels to keep (see vehicle_mask).
    occluder_mask: uint8, render frame, 255 = anything the render legitimately put in front
    of the vehicle; those stay as generated. None for a background swap.
    Returns (image, final alpha mask as uint8, stats).
    """
    gh, gw = generated.shape[:2]
    warped_src = cv2.warpPerspective(source, homography, (gw, gh), flags=cv2.INTER_LINEAR,
                                     borderMode=cv2.BORDER_REPLICATE)
    warped_mask = cv2.warpPerspective(protect_mask, homography, (gw, gh), flags=cv2.INTER_LINEAR,
                                      borderValue=0)
    valid = cv2.warpPerspective(np.full(source.shape[:2], 255, np.uint8), homography, (gw, gh),
                                flags=cv2.INTER_NEAREST, borderValue=0)
    hard = (warped_mask > 127) & (valid > 0)

    occluded = np.zeros_like(hard)
    if occluder_mask is not None and occluder_mask.any():
        occ = cv2.resize(occluder_mask, (gw, gh), interpolation=cv2.INTER_NEAREST) > 127
        # A little margin so the occluder's edges keep the render's own pixels, not a pasted halo.
        occ = cv2.dilate(occ.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        occluded = occ & hard
        hard = hard & ~occ

    harmonized, colour = harmonize(warped_src, generated, hard.astype(np.float32))

    # Feather in proportion to the picture: about 0.25 % of its diagonal.
    radius = max(1.0, 0.0025 * float(np.hypot(gw, gh)))
    alpha = cv2.GaussianBlur(hard.astype(np.float32), (0, 0), sigmaX=radius)
    alpha = np.clip(alpha, 0.0, 1.0)[..., None]
    out = (generated.astype(np.float32) * (1 - alpha) + harmonized.astype(np.float32) * alpha)
    out = np.clip(np.rint(out), 0, 255).astype(np.uint8)

    protected_area = max(1, int(((warped_mask > 127) & (valid > 0)).sum()))
    stats = {
        "protectedCoverage": round(float(hard.mean()), 4),
        "occludedShare": round(float(occluded.sum()) / protected_area, 4),
        "featherPx": round(radius, 1),
        "colour": colour,
    }
    return out, (alpha[..., 0] * 255).astype(np.uint8), stats
