"""Composition checks on synthetic scenes, no GPU or model needed.

Run from the repository root:
    python -m pytest services/vehicle-protection/tests -q
"""
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import compose  # noqa: E402

SRC_W, SRC_H = 1600, 1200
GEN_W, GEN_H = 1200, 900
CAR = (350, 450, 1250, 950)  # x0, y0, x1, y1 in the source
WINDOW = (650, 480, 950, 600)  # the side windows, inside the car


def textured(seed: int, w: int, h: int, base: tuple[int, int, int]) -> np.ndarray:
    rng = np.random.default_rng(seed)
    img = np.full((h, w, 3), base, np.uint8)
    for _ in range(900):
        x, y = int(rng.integers(0, w)), int(rng.integers(0, h))
        dx, dy = int(rng.integers(8, 60)), int(rng.integers(8, 60))
        colour = tuple(int(c) for c in rng.integers(0, 255, 3))
        cv2.rectangle(img, (x, y), (x + dx, y + dy), colour, -1 if rng.random() < 0.5 else 2)
    noise = rng.normal(0, 6, img.shape)
    return np.clip(img + noise, 0, 255).astype(np.uint8)


def box_mask(box, w=SRC_W, h=SRC_H) -> np.ndarray:
    mask = np.zeros((h, w), np.uint8)
    x0, y0, x1, y1 = box
    mask[y0:y1, x0:x1] = 255
    return mask


def source_scene():
    """The dealer's photo: a textured car on a textured parking lot."""
    lot = textured(1, SRC_W, SRC_H, (110, 110, 115))
    car = textured(2, SRC_W, SRC_H, (180, 30, 30))
    mask = box_mask(CAR)
    return np.where(mask[..., None] > 0, car, lot), mask


def camera(shift=(9.0, -6.0), scale=1.012, angle=0.4):
    """Source pixels -> render pixels: a resize to the render's size plus a small camera move."""
    resize = np.diag([GEN_W / SRC_W, GEN_H / SRC_H, 1.0])
    centre = np.array([[1, 0, -GEN_W / 2], [0, 1, -GEN_H / 2], [0, 0, 1]], float)
    a = np.radians(angle)
    move = np.array([[scale * np.cos(a), -scale * np.sin(a), 0], [scale * np.sin(a), scale * np.cos(a), 0], [0, 0, 1]])
    back = np.array([[1, 0, GEN_W / 2 + shift[0]], [0, 1, GEN_H / 2 + shift[1]], [0, 0, 1]], float)
    return back @ move @ centre @ resize


def render_of(source, car_mask, homography):
    """What a generator returns: the same car slightly moved and re-graded, a new showroom
    background, and a wheel redrawn (the change the protection must undo)."""
    warped = cv2.warpPerspective(source, homography, (GEN_W, GEN_H))
    car_gen = cv2.warpPerspective(car_mask, homography, (GEN_W, GEN_H)) > 127
    showroom = textured(3, GEN_W, GEN_H, (225, 225, 230))
    render = np.where(car_gen[..., None], warped, showroom).astype(np.int16)
    render = np.clip(render + 10, 0, 255).astype(np.uint8)  # warmer, brighter grade
    corner = cv2.perspectiveTransform(np.float32([[[CAR[0], CAR[3]]]]), homography)[0, 0]
    wx, wy = int(corner[0]) + 80, int(corner[1]) - 150
    cv2.circle(render, (wx, wy), 55, (240, 240, 240), -1)  # the redrawn wheel
    return render, car_gen, (wx, wy)


def test_restores_the_car_and_keeps_the_new_background():
    source, car_mask = source_scene()
    truth = camera()
    render, car_gen, wheel = render_of(source, car_mask, truth)
    protect = compose.vehicle_mask(car_mask)

    alignment = compose.estimate_alignment(source, render, focus_mask=protect)
    corners = np.float32([[CAR[0], CAR[1]], [CAR[2], CAR[1]], [CAR[2], CAR[3]], [CAR[0], CAR[3]]]).reshape(-1, 1, 2)
    error = np.linalg.norm(cv2.perspectiveTransform(corners, alignment.homography) - cv2.perspectiveTransform(corners, truth), axis=2)
    assert error.max() < 2.0, f"car corners off by {error.max():.2f}px"
    assert alignment.diagnostics["scope"] == "vehicle"

    out, _alpha, stats = compose.compose(source, render, protect, None, alignment.homography)
    assert out.shape == render.shape

    # The redrawn wheel is back to the photographed one.
    wx, wy = wheel
    patch = (slice(wy - 25, wy + 25), slice(wx - 25, wx + 25))
    expected = cv2.warpPerspective(source, truth, (GEN_W, GEN_H))[patch].astype(float) + 10
    assert np.abs(out[patch].astype(float) - expected).mean() < 12
    assert np.abs(out[patch].astype(float) - render[patch].astype(float)).mean() > 40

    # The new background is untouched, away from the feathered edge.
    background = cv2.erode((~car_gen).astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
    assert np.abs(out[background].astype(int) - render[background].astype(int)).max() <= 1

    # The car was brought towards the render's grade (+10), within the clamp.
    assert stats["colour"]["applied"] and stats["colour"]["lab"][0]["shift"] > 2
    assert stats["occludedShare"] == 0


def test_glass_and_edges_are_left_to_the_render():
    source, car_mask = source_scene()
    glass = box_mask(WINDOW)
    protect = compose.vehicle_mask(car_mask, glass, inset_px=2)
    # The old lot seen through the windows is not restored...
    assert not protect[WINDOW[1] + 5:WINDOW[3] - 5, WINDOW[0] + 5:WINDOW[2] - 5].any()
    # ...nor the body's outermost pixels, where the old background bleeds in.
    assert not protect[CAR[1], CAR[0] + 100] and not protect[CAR[3] - 1, CAR[0] + 100]
    assert protect[CAR[1] + 10, CAR[0] + 100] == 255


def test_picks_the_car_for_sale_not_the_one_behind():
    shape = (SRC_H, SRC_W)
    boxes = [
        [1300, 300, 1550, 420],  # a car parked far behind, at the edge
        list(CAR),               # the car being sold, large and central
        [0, 0, SRC_W, SRC_H],    # a detection of the whole frame
    ]
    assert compose.pick_main_vehicle(boxes, [0.9, 0.6, 0.95], shape) == 1
    assert compose.pick_main_vehicle([[10, 10, 40, 30]], [0.9], shape) is None  # too small
    assert compose.pick_main_vehicle([], [], shape) is None


def test_refuses_a_moved_car_or_viewpoint():
    source, car_mask = source_scene()
    render, *_ = render_of(source, car_mask, camera(shift=(60, 40), scale=1.12, angle=7))
    with pytest.raises(compose.AlignmentError):
        compose.estimate_alignment(source, render, focus_mask=compose.vehicle_mask(car_mask))


def test_unrelated_picture_is_refused():
    source, car_mask = source_scene()
    other = textured(42, GEN_W, GEN_H, (90, 90, 90))
    with pytest.raises(compose.AlignmentError):
        compose.estimate_alignment(source, other, focus_mask=car_mask)


def test_colour_match_is_clamped():
    """A render that repainted the car blue cannot turn the real red paint blue."""
    source, car_mask = source_scene()
    blue = source.copy()
    blue[..., 2] = 255
    region = (car_mask > 0).astype(np.float32)
    out, info = compose.harmonize(source, blue, region)
    assert abs(info["lab"][2]["shift"]) <= 5.0
    lab_in = cv2.cvtColor(source, cv2.COLOR_RGB2LAB)[..., 2][car_mask > 0].mean()
    lab_out = cv2.cvtColor(out, cv2.COLOR_RGB2LAB)[..., 2][car_mask > 0].mean()
    assert abs(lab_out - lab_in) <= 6
