from PIL import Image
import numpy as np


def _laplacian_var(gray: np.ndarray) -> float:
    # gray: 2D uint8 array
    k = np.array([[0,  1, 0],
                  [1, -4, 1],
                  [0,  1, 0]], dtype=np.int32)
    # manual conv (valid) without scipy
    H, W = gray.shape
    if H < 3 or W < 3:
        return 0.0
    # pad 1px
    pad = np.pad(gray.astype(np.int32), 1)
    out = (
        k[0, 0]*pad[0:H,   0:W] + k[0, 1]*pad[0:H,   1:W+1] + k[0, 2]*pad[0:H,   2:W+2] +
        k[1, 0]*pad[1:H+1, 0:W] + k[1, 1]*pad[1:H+1, 1:W+1] + k[1, 2]*pad[1:H+1, 2:W+2] +
        k[2, 0]*pad[2:H+2, 0:W] + k[2, 1] *
        pad[2:H+2, 1:W+1] + k[2, 2]*pad[2:H+2, 2:W+2]
    )
    return float(out.var())


def compute_qc(image_path: str) -> dict:
    with Image.open(image_path) as im:
        im = im.convert('L')  # grayscale
        arr = np.array(im, dtype=np.uint8)
    brightness = float(arr.mean())                 # 0..255
    blur_var = _laplacian_var(arr)                 # higher = sharper
    # Optional normalization to a 0..1 score (tune thresholds later)
    # Treat blur_var>=200 as sharp, <=20 as very blurry; brightness ~[50, 200] ok
    blur_score = max(0.0, min(1.0, (blur_var - 20.0) / (200.0 - 20.0)))
    bright_score = max(0.0, min(1.0, (brightness - 50.0) / (200.0 - 50.0)))
    qc_score = round(0.6 * blur_score + 0.4 * bright_score, 3)

    return {
        "brightness": round(brightness, 2),
        "blur_var": round(blur_var, 2),
        "score": qc_score
    }
