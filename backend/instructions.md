Perfect — here’s a ready-to-drop `.md` file for **Copilot / Cursor Agent** that gives it full context about your **Supabase models storage layout** and how to **patch your Celery workers** to dynamically load them.

📄 Save this at the root of your backend repo as
`scripts/patch_workers_for_supabase_models.md`
(or any `.md` name you like).
Then tell Copilot:

> “Follow the file edit instructions in `scripts/patch_workers_for_supabase_models.md`.”

---

```markdown
# 🤖 HyacinthWatch — Supabase Model Storage & Worker Patch Instructions

This document defines the **structure of Supabase Storage for model weights** and how workers should dynamically download, cache, and load models for inference.

---

## 🧱 1. Supabase Storage Structure

All model artifacts live in the **`models`** bucket on Supabase Storage.  
Each model has its own **task directory**, versioned subfolder, and includes:

```

models/
├── presence/
│   └── 1.0.0/
│       ├── presence_mobilenetv2.pt
│       └── model_meta.json
└── segmentation/
└── 1.0.1/
├── unet_aquavplant.pt
└── model_meta.json

````

Each `model_meta.json` file defines how to interpret and load the weights.

---

## 🧩 2. Example model_meta.json files

### Presence model
`models/presence/1.0.0/model_meta.json`
```json
{
  "task": "presence",
  "name": "presence_mobilenetv2",
  "version": "1.0.0",
  "format": "state_dict",
  "weights_filename": "presence_mobilenetv2.pt",
  "architecture": "mobilenet_v2",
  "num_classes": 1,
  "input_size": [224, 224],
  "normalize": { "mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225] },
  "activation": "sigmoid",
  "threshold": 0.50,
  "metrics": { "youden_j": 0.3520047962665558, "f1": 0.9 },
  "sha256": "",
  "exported_at": ""
}
````

### Segmentation model

`models/segmentation/1.0.1/model_meta.json`

```json
{
  "task": "segmentation",
  "name": "unet_aquavplant",
  "version": "1.0.1",
  "format": "state_dict",
  "weights_filename": "unet_aquavplant.pt",
  "architecture": "unet_resnet34",
  "num_classes": 1,
  "input_size": [512, 512],
  "normalize": { "mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225] },
  "activation": "sigmoid",
  "logit_threshold": 0.50,
  "postprocess": { "min_area_px": 0, "morph": null },
  "metrics": {},
  "sha256": "",
  "exported_at": ""
}
```

---

## ⚙️ 3. Worker environment variables

Update your `.env` or Docker Compose environment for the workers:

```bash
# Supabase credentials
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# Versioned model references
PRESENCE_MODEL_VERSION=1.0.0
SEGMENTATION_MODEL_VERSION=1.0.1
```

This allows hot-swapping model versions without code changes.

---

## 🧠 4. Create model loader utility

### File: `backend/workers/model_loader.py`

```python
import io, os, json, torch
from functools import lru_cache
from supabase import create_client
import segmentation_models_pytorch as smp
import torchvision.models as tv

SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

def _download(bucket: str, path: str) -> bytes:
    return SB.storage.from_(bucket).download(path)

def _load_meta(task: str, version: str):
    meta_b = _download("models", f"{task}/{version}/model_meta.json")
    return json.loads(meta_b.decode())

def _load_weights(bucket: str, path: str) -> bytes:
    return _download(bucket, path)

@lru_cache(maxsize=None)
def load_presence(version: str):
    meta = _load_meta("presence", version)
    w = _load_weights("models", f"presence/{version}/{meta['weights_filename']}")
    model = tv.mobilenet_v2()
    model.classifier[1] = torch.nn.Linear(model.last_channel, meta.get("num_classes", 1))
    sd = torch.load(io.BytesIO(w), map_location=DEVICE)
    model.load_state_dict(sd, strict=False)
    model.eval().to(DEVICE)
    return model, meta

@lru_cache(maxsize=None)
def load_segmenter(version: str):
    meta = _load_meta("segmentation", version)
    w = _load_weights("models", f"segmentation/{version}/{meta['weights_filename']}")
    model = smp.Unet(encoder_name="resnet34", encoder_weights=None, classes=1, activation=None)
    sd = torch.load(io.BytesIO(w), map_location=DEVICE)
    model.load_state_dict(sd, strict=False)
    model.eval().to(DEVICE)
    return model, meta
```

---

## 🧩 5. Patch worker tasks to use dynamic loading

### File: `backend/workers/tasks.py`

Locate the presence + segmentation functions and patch them as follows:

```python
from workers.model_loader import load_presence, load_segmenter

@shared_task
def classify_presence(obs_id: str):
    from observations.models import Observation
    from utils.storage import download_bytes
    from PIL import Image
    import io, numpy as np, torch

    obs = Observation.objects.get(id=obs_id)
    model, meta = load_presence(os.getenv("PRESENCE_MODEL_VERSION", "1.0.0"))
    thr = float(meta.get("threshold", 0.5))

    img = Image.open(io.BytesIO(download_bytes(obs.bucket, obs.path))).convert("RGB")
    img = img.resize(tuple(meta["input_size"]))
    x = torch.tensor(np.array(img) / 255.0).permute(2,0,1).unsqueeze(0)
    mean, std = meta["normalize"]["mean"], meta["normalize"]["std"]
    for c in range(3): x[:, c] = (x[:, c] - mean[c]) / std[c]
    x = x.to(next(model.parameters()).device)

    with torch.no_grad():
        score = torch.sigmoid(model(x)).item()
    label = "present" if score >= thr else "absent"

    obs.pred = {"presence": {"score": score, "label": label, "model_v": meta["version"]}}
    obs.status = "processing" if label == "present" else "done"
    obs.save()

@shared_task
def segment_and_cover(obs_id: str):
    from observations.models import Observation
    from utils.storage import download_bytes, upload_png
    from PIL import Image
    import io, numpy as np, torch

    obs = Observation.objects.get(id=obs_id)
    model, meta = load_segmenter(os.getenv("SEGMENTATION_MODEL_VERSION", "1.0.1"))
    img = Image.open(io.BytesIO(download_bytes(obs.bucket, obs.path))).convert("RGB")
    img = img.resize(tuple(meta["input_size"]))
    x = torch.tensor(np.array(img) / 255.0).permute(2,0,1).unsqueeze(0)
    mean, std = meta["normalize"]["mean"], meta["normalize"]["std"]
    for c in range(3): x[:, c] = (x[:, c] - mean[c]) / std[c]
    x = x.to(next(model.parameters()).device)

    with torch.no_grad():
        logits = model(x)
        probs = torch.sigmoid(logits)
        mask = (probs >= meta.get("logit_threshold", 0.5)).float()[0,0].cpu().numpy().astype("uint8") * 255

    buf = io.BytesIO()
    Image.fromarray(mask).save(buf, format="PNG")

    mask_path = f"{obs.user.id}/{obs.id}.png"
    upload_png(os.environ["STORAGE_BUCKET_MASKS"], mask_path, buf.getvalue())

    obs.pred["seg"] = {
        "mask_url": f"supabase://{os.environ['STORAGE_BUCKET_MASKS']}/{mask_path}",
        "cover_pct": float(mask.mean()/255*100),
        "model_v": meta["version"]
    }
    obs.status = "done"
    obs.save()
```

---

## 🧠 6. Verification

Run this in Django shell (inside the worker container):

```python
from workers.model_loader import load_presence, load_segmenter
m1, meta1 = load_presence("1.0.0")
m2, meta2 = load_segmenter("1.0.1")
print(meta1["name"], meta2["name"], "✅ Loaded from Supabase")
```

Expected output:

```
presence_mobilenetv2 unet_aquavplant ✅ Loaded from Supabase
```

---

## ✅ 7. Summary

| Task         | Bucket                       | Example path              | Worker env var               | Model version |
| ------------ | ---------------------------- | ------------------------- | ---------------------------- | ------------- |
| Presence     | `models/presence/1.0.0/`     | `presence_mobilenetv2.pt` | `PRESENCE_MODEL_VERSION`     | 1.0.0         |
| Segmentation | `models/segmentation/1.0.1/` | `unet_aquavplant.pt`      | `SEGMENTATION_MODEL_VERSION` | 1.0.1         |

This setup ensures:

* Models are fetched dynamically from Supabase Storage.
* Versions are swappable via env vars.
* Workers load the correct preprocessing pipeline defined in each model’s metadata.

```

---

✅ **Once Copilot applies this file**, your workers will:
1. Download model weights from Supabase.
2. Cache them in memory.
3. Use the correct preprocessing + thresholds from metadata.
4. Automatically adapt if you update model versions in `.env`.
```
