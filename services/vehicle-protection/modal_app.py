"""AutoStudio vehicle protection: the car comes back exactly as photographed.

A background swap asks Gemini to leave the vehicle untouched, and it mostly does — but a
generator redraws every pixel, so badges, wheel spokes, the grille or the plate can drift.
This service puts the photographed car back into the render: Grounding DINO finds the
vehicles, the one being sold is kept (the largest, most central; other cars of the lot are
background), SAM 2.1 gives its pixel mask, the glass is taken out (the new scene must show
through the windows), and compose.py aligns, matches colours and blends. Adapted from the
sister product Florelis, whose service restores a house in a garden render.

POST /segment, contract version 2 (docs/vehicle-protection.md):
- with only imageBase64: returns the vehicle mask in the photo's frame (benchmark mode);
- with imageBase64 and generatedImageBase64: returns the render with the vehicle restored
  from the photo, in the render's frame and resolution.
"""
import base64
import hmac
import io
import os
import time
from pathlib import Path
from typing import Any

import modal
from fastapi import FastAPI, HTTPException, Request

APP_NAME = "autostudio-vehicle-protection"
GROUNDING_MODEL = os.getenv("GROUNDING_MODEL_ID", "IDEA-Research/grounding-dino-base")
SAM_MODEL = os.getenv("SAM_MODEL_ID", "facebook/sam2.1-hiera-large")
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
MAX_SIDE = int(os.getenv("SCENE_MAX_SIDE", "1280"))
BOX_THRESHOLD = float(os.getenv("GROUNDING_BOX_THRESHOLD", "0.30"))
TEXT_THRESHOLD = float(os.getenv("GROUNDING_TEXT_THRESHOLD", "0.25"))
GLASS_THRESHOLD = float(os.getenv("GLASS_BOX_THRESHOLD", "0.30"))
# "1": the glass is restored too (the old background stays visible through the windows).
KEEP_GLASS = os.getenv("KEEP_GLASS", "0") == "1"
# Pixels the body mask is pulled in by, at SAM's working resolution scale (see vehicle_mask).
INSET_PX = int(os.getenv("VEHICLE_MASK_INSET_PX", "2"))
MAX_BOXES = 12
# Keeping one container warm removes the cold start but costs a GPU around the clock
# (an L4 is roughly 0.80 USD an hour). 0 until the feature is live for clients.
MIN_CONTAINERS = int(os.getenv("SCENE_MIN_CONTAINERS", "0"))

VEHICLE_PHRASES = ["a car.", "a vehicle.", "a van.", "a truck.", "a motorcycle."]
GLASS_PHRASES = ["a car window.", "a windshield.", "a rear window."]

HF_CACHE = "/models"


def download_weights() -> None:
    """Runs once at image build: the weights live in the image, not fetched per cold start."""
    from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor, Sam2Model, Sam2Processor

    AutoProcessor.from_pretrained(GROUNDING_MODEL)
    AutoModelForZeroShotObjectDetection.from_pretrained(GROUNDING_MODEL)
    Sam2Processor.from_pretrained(SAM_MODEL)
    Sam2Model.from_pretrained(SAM_MODEL)


app = modal.App(APP_NAME)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "torch>=2.6,<2.8",
        "transformers>=4.57.1,<5",
        "accelerate>=1.2",
        "safetensors>=0.4",
        "pillow>=11",
        "numpy>=1.26,<2",
        "opencv-python-headless>=4.10",
        "fastapi>=0.115",
    )
    .env({"HF_HOME": HF_CACHE, "HF_HUB_DISABLE_TELEMETRY": "1"})
    .run_function(download_weights)
    .env({"HF_HUB_OFFLINE": "1"})
    .add_local_file(Path(__file__).parent / "compose.py", "/root/compose.py")
)

_models: dict[str, Any] | None = None


def load_models() -> dict[str, Any]:
    global _models
    if _models is not None:
        return _models

    import torch
    from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor, Sam2Model, Sam2Processor

    if not torch.cuda.is_available():
        raise RuntimeError("A CUDA GPU is required for vehicle protection")

    # float32 on purpose: the processors return float32 tensors, and Grounding DINO's
    # deformable attention is fragile in half precision. Both models fit an L4 easily.
    _models = {
        "torch": torch,
        "grounding_processor": AutoProcessor.from_pretrained(GROUNDING_MODEL),
        "grounding_model": AutoModelForZeroShotObjectDetection.from_pretrained(GROUNDING_MODEL).to("cuda").eval(),
        "sam_processor": Sam2Processor.from_pretrained(SAM_MODEL),
        "sam_model": Sam2Model.from_pretrained(SAM_MODEL).to("cuda").eval(),
    }
    return _models


def decode_image(payload: dict[str, Any], key: str):
    """Full-resolution RGB array, EXIF orientation applied."""
    import numpy as np
    from PIL import Image, ImageOps

    encoded = payload.get(key)
    if not isinstance(encoded, str) or not encoded:
        raise ValueError(f"{key} is required")
    if len(encoded) > (MAX_UPLOAD_BYTES * 4 // 3 + 16):
        raise ValueError("Image payload exceeds 12 MB")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError(f"{key} is not valid base64") from exc
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ValueError("Image payload exceeds 12 MB")
    picture = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    return np.asarray(picture)


def _small(rgb):
    from PIL import Image

    h, w = rgb.shape[:2]
    scale = min(1.0, MAX_SIDE / max(h, w))
    small = Image.fromarray(rgb)
    if scale < 1.0:
        small = small.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.LANCZOS)
    return small, scale


def detect(small, phrases: list[str], threshold: float, models: dict[str, Any]):
    """Boxes (in `small`'s pixels), scores and labels of every detected phrase, best first."""
    torch = models["torch"]
    inputs = models["grounding_processor"](images=small, text=" ".join(phrases), return_tensors="pt").to("cuda")
    with torch.inference_mode():
        outputs = models["grounding_model"](**inputs)
    post = models["grounding_processor"].post_process_grounded_object_detection
    target = [(small.height, small.width)]
    try:
        result = post(outputs, inputs.input_ids, threshold=threshold, text_threshold=TEXT_THRESHOLD, target_sizes=target)[0]
    except TypeError:  # transformers before the box_threshold -> threshold rename
        result = post(outputs, inputs.input_ids, box_threshold=threshold, text_threshold=TEXT_THRESHOLD, target_sizes=target)[0]
    labels = result.get("text_labels", result.get("labels"))
    kept = sorted(
        [(box, float(score), str(label)) for box, score, label in
         zip(result["boxes"].float().cpu().tolist(), result["scores"].float().cpu().tolist(), labels)
         if float(score) >= threshold],
        key=lambda item: item[1], reverse=True,
    )[:MAX_BOXES]
    return kept


def segment(small, boxes: list[list[float]], models: dict[str, Any]):
    """Union of SAM's masks for the boxes, uint8 at `small`'s size."""
    import numpy as np

    torch = models["torch"]
    union = np.zeros((small.height, small.width), np.uint8)
    if not boxes:
        return union
    sam_inputs = models["sam_processor"](images=small, input_boxes=[boxes], return_tensors="pt").to("cuda")
    with torch.inference_mode():
        sam_out = models["sam_model"](**sam_inputs, multimask_output=False)
    masks = models["sam_processor"].post_process_masks(sam_out.pred_masks.float().cpu(), sam_inputs["original_sizes"])[0]
    for index in range(min(len(boxes), masks.shape[0])):
        union |= (masks[index, 0].numpy() > 0).astype(np.uint8) * 255
    return union


def png_base64(array) -> str:
    from PIL import Image

    buffer = io.BytesIO()
    Image.fromarray(array).save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def vehicle_protect_mask(source, models: dict[str, Any]):
    """The main vehicle's mask to restore (photo frame, full resolution), and diagnostics."""
    import cv2
    import numpy as np

    import compose

    h, w = source.shape[:2]
    small, scale = _small(source)
    vehicles = detect(small, VEHICLE_PHRASES, BOX_THRESHOLD, models)
    main = compose.pick_main_vehicle([b for b, _, _ in vehicles], [s for _, s, _ in vehicles], (small.height, small.width))
    if main is None:
        raise RuntimeError("No vehicle detected; nothing to protect")
    box = vehicles[main][0]
    body = segment(small, [box], models)

    glass = None
    glass_detections: list[dict[str, Any]] = []
    if not KEEP_GLASS:
        x0, y0, x1, y1 = box
        # Only windows of the main vehicle: their centre inside its box.
        windows = [g for g in detect(small, GLASS_PHRASES, GLASS_THRESHOLD, models)
                   if x0 <= (g[0][0] + g[0][2]) / 2 <= x1 and y0 <= (g[0][1] + g[0][3]) / 2 <= y1]
        glass_detections = [{"label": label, "score": round(score, 4)} for _, score, label in windows]
        # SAM on a window box can spill onto the body around it: bounded by the body mask.
        glass = segment(small, [b for b, _, _ in windows], models) & body if windows else None

    protect = compose.vehicle_mask(body, glass, inset_px=INSET_PX)
    if scale < 1.0:
        protect = cv2.resize(protect, (w, h), interpolation=cv2.INTER_LINEAR)
        protect = ((protect > 127) * 255).astype(np.uint8)
    coverage = float((protect > 127).mean())
    if coverage < 0.01:
        raise RuntimeError(f"Vehicle too small to protect: {coverage:.3f}")
    if coverage > 0.9:
        raise RuntimeError(f"Implausible vehicle coverage: {coverage:.3f}")
    return protect, {
        "vehicleDetections": [{"label": label, "score": round(score, 4)} for _, score, label in vehicles],
        "mainVehicle": main,
        "glassDetections": glass_detections,
        "glassKept": KEEP_GLASS,
        "vehicleCoverage": round(coverage, 4),
        "groundingModel": GROUNDING_MODEL,
        "samModel": SAM_MODEL,
    }


def infer(payload: dict[str, Any]) -> dict[str, Any]:
    import compose

    started = time.perf_counter()
    models = load_models()
    source = decode_image(payload, "imageBase64")
    protect, diagnostics = vehicle_protect_mask(source, models)

    if not payload.get("generatedImageBase64"):
        # Benchmark mode: the mask alone, in the photo's frame.
        diagnostics["inferenceMs"] = int((time.perf_counter() - started) * 1000)
        return {"version": 2, "protectedMaskBase64": png_base64(protect), "diagnostics": diagnostics}

    generated = decode_image(payload, "generatedImageBase64")
    alignment = compose.estimate_alignment(source, generated, focus_mask=protect)
    # Nothing legitimately stands in front of the car in a background swap: no occluders.
    image_out, alpha, stats = compose.compose(source, generated, protect, None, alignment.homography)

    diagnostics.update({
        "alignment": alignment.diagnostics,
        **stats,
        "inferenceMs": int((time.perf_counter() - started) * 1000),
    })
    if stats["protectedCoverage"] < 0.005:
        raise RuntimeError("The vehicle is not visible in the render; nothing to restore")
    return {
        "version": 2,
        "imageBase64": png_base64(image_out),
        "protectedMaskBase64": png_base64(alpha),
        "diagnostics": diagnostics,
    }


def _authorized(request: Request) -> bool:
    expected = os.environ.get("VEHICLE_PROTECTION_TOKEN", "")
    supplied = request.headers.get("authorization", "")
    return bool(expected) and hmac.compare_digest(supplied.encode(), f"Bearer {expected}".encode())


@app.function(
    image=image,
    gpu="L4",
    timeout=120,
    scaledown_window=300,
    min_containers=MIN_CONTAINERS,
    secrets=[modal.Secret.from_name("autostudio-vehicle-protection")],
)
@modal.asgi_app()
def web():
    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @api.post("/segment")
    async def segment_route(request: Request):
        if not _authorized(request):
            raise HTTPException(status_code=401, detail="Unauthorized")
        try:
            payload = await request.json()
            if not isinstance(payload, dict):
                raise ValueError("JSON object expected")
            return infer(payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            # Reason in the body: the AutoStudio route records why nothing was restored.
            print(f"[vehicle-protection] skipped: {type(exc).__name__}: {exc}")
            raise HTTPException(status_code=422, detail=str(exc)[:200]) from exc

    @api.post("/warmup")
    async def warmup(request: Request):
        """Loads the models; called by AutoStudio when a render starts, to hide the cold start."""
        if not _authorized(request):
            raise HTTPException(status_code=401, detail="Unauthorized")
        load_models()
        return {"status": "warm"}

    @api.get("/health")
    async def healthcheck():
        return {"status": "ok", "models": [GROUNDING_MODEL, SAM_MODEL]}

    return api
