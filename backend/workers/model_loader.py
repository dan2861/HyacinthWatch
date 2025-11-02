import io
import os
import json
from functools import lru_cache

try:
    import torch
except Exception:
    torch = None

try:
    from supabase import create_client
except Exception:
    create_client = None

DEVICE = "cuda" if (torch is not None and torch.cuda.is_available()) else "cpu"


def _sb_client():
    if create_client is None:
        raise RuntimeError('supabase client not available')
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise RuntimeError('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return create_client(url, key)


def _download(bucket: str, path: str) -> bytes:
    sb = _sb_client()
    res = sb.storage.from_(bucket).download(path)
    # download returns bytes-like for typical client
    if isinstance(res, (bytes, bytearray)):
        return bytes(res)
    if isinstance(res, dict):
        # normalize shapes
        return res.get('data') or res.get('body') or res.get('content') or b''
    return b''


def _load_meta(task: str, version: str):
    raw = _download('models', f"{task}/{version}/model_meta.json")
    return json.loads(raw.decode('utf-8'))


def _load_weights_bytes(task: str, version: str, filename: str) -> bytes:
    return _download('models', f"{task}/{version}/{filename}")


@lru_cache(maxsize=None)
def load_presence(version: str = '1.0.0'):
    meta = _load_meta('presence', version)
    w = _load_weights_bytes('presence', version, meta['weights_filename'])
    if torch is None:
        raise RuntimeError('torch not available')
    import torchvision.models as tv
    model = tv.mobilenet_v2()
    # adapt classifier for possibly single output
    try:
        last_channel = model.last_channel
    except Exception:
        last_channel = getattr(model.classifier[1], 'in_features', None)
    if last_channel is None:
        # best-effort fallback
        pass
    model.classifier[1] = torch.nn.Linear(
        last_channel, meta.get('num_classes', 1))
    sd = torch.load(io.BytesIO(w), map_location=DEVICE)
    model.load_state_dict(sd, strict=False)
    model.eval().to(DEVICE)
    return model, meta


@lru_cache(maxsize=None)
def load_segmenter(version: str = '1.0.0'):
    meta = _load_meta('segmentation', version)
    w = _load_weights_bytes('segmentation', version, meta['weights_filename'])
    if torch is None:
        raise RuntimeError('torch not available')
    try:
        import segmentation_models_pytorch as smp
    except Exception:
        smp = None
    if smp is None:
        raise RuntimeError('segmentation_models_pytorch not available')
    model = smp.Unet(encoder_name='resnet34',
                     encoder_weights=None, classes=1, activation=None)
    sd = torch.load(io.BytesIO(w), map_location=DEVICE)
    # Convert state_dict weights to float32 if they're in double precision
    if sd:
        for key in sd:
            if sd[key].dtype == torch.float64:
                sd[key] = sd[key].float()
    model.load_state_dict(sd, strict=False)
    # Ensure model parameters use float32 for stable inference.
    model = model.float()
    model.eval().to(DEVICE)
    return model, meta
