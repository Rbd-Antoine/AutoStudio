# AutoStudio vehicle-protection service

GPU service that puts the dealer's car back, exactly as photographed, into an AutoStudio
render: Grounding DINO finds the vehicles, the one being sold is kept (largest and most
central), SAM 2.1 gives its pixel mask, the glass is left to the render, and `compose.py`
aligns, matches colours and blends. Deployed separately from Next.js/Vercel. Adapted from the
house-protection service of the sister product Florelis.

The contract and how the restoration works: [docs/vehicle-protection.md](../../docs/vehicle-protection.md).

## Models

- Detection: `IDEA-Research/grounding-dino-base`
- Promptable segmentation: `facebook/sam2.1-hiera-large`
- Runtime: Modal serverless GPU, L4 (about 0.80 USD an hour while a container is up; it
  scales to zero after 5 idle minutes).

## Deploy

Requires a Modal account and CLI, plus a secret named `autostudio-vehicle-protection`
containing `VEHICLE_PROTECTION_TOKEN`.

```bash
python -m pip install -r services/vehicle-protection/requirements.txt
modal setup
export VEHICLE_PROTECTION_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
modal secret create autostudio-vehicle-protection VEHICLE_PROTECTION_TOKEN="$VEHICLE_PROTECTION_TOKEN"
modal deploy services/vehicle-protection/modal_app.py
```

Windows PowerShell:

```powershell
$env:VEHICLE_PROTECTION_TOKEN = python -c "import secrets; print(secrets.token_urlsafe(32))"
modal secret create autostudio-vehicle-protection VEHICLE_PROTECTION_TOKEN="$env:VEHICLE_PROTECTION_TOKEN"
modal deploy services/vehicle-protection/modal_app.py
```

Modal prints the HTTPS base URL of the app. On Vercel:

- `VEHICLE_PROTECTION_URL`: that URL followed by `/segment`.
- `VEHICLE_PROTECTION_TOKEN`: the same token. Keep it in a password manager; never commit it.

Without `VEHICLE_PROTECTION_URL`, AutoStudio makes no call and renders exactly as before.

Tunable without a code change (Modal environment): `KEEP_GLASS=1` restores the windows too,
`VEHICLE_MASK_INSET_PX` (default 2) how far the body mask is pulled in, `SCENE_MIN_CONTAINERS=1`
keeps a container warm (no cold start, a GPU billed around the clock).

## Test without a GPU

```bash
python -m pip install "numpy<2" opencv-python-headless pillow pytest
python -m pytest services/vehicle-protection/tests -q
```

The client side (when AutoStudio calls the service, what it keeps on failure) is tested by
`npm run check:vehicle-protection`.
