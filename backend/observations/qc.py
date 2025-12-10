from PIL import Image
import numpy as np


def _laplacian_var(gray: np.ndarray) -> float:
    """Compute Laplacian variance to measure image sharpness.
    
    Higher variance indicates sharper image. Uses manual convolution
    with a Laplacian kernel to avoid scipy dependency.
    
    Args:
        gray: 2D uint8 grayscale image array
        
    Returns:
        Variance of Laplacian response (higher = sharper)
    """
    k = np.array([[0,  1, 0],
                  [1, -4, 1],
                  [0,  1, 0]], dtype=np.int32)
    H, W = gray.shape
    if H < 3 or W < 3:
        return 0.0
    pad = np.pad(gray.astype(np.int32), 1)
    out = (
        k[0, 0]*pad[0:H,   0:W] + k[0, 1]*pad[0:H,   1:W+1] + k[0, 2]*pad[0:H,   2:W+2] +
        k[1, 0]*pad[1:H+1, 0:W] + k[1, 1]*pad[1:H+1, 1:W+1] + k[1, 2]*pad[1:H+1, 2:W+2] +
        k[2, 0]*pad[2:H+2, 0:W] + k[2, 1] *
        pad[2:H+2, 1:W+1] + k[2, 2]*pad[2:H+2, 2:W+2]
    )
    return float(out.var())


def compute_qc(image_path: str) -> dict:
    """Compute quality control metrics for an image.
    
    Calculates brightness and blur metrics, then combines them into
    a single quality score. Blur is measured using Laplacian variance
    (higher = sharper). Brightness is the mean pixel value.
    
    Args:
        image_path: Path to image file
        
    Returns:
        Dict with 'brightness' (0-255), 'blur_var' (higher=sharper), and 'score' (0-1)
    """
    with Image.open(image_path) as im:
        im = im.convert('L')
        arr = np.array(im, dtype=np.uint8)
    brightness = float(arr.mean())
    blur_var = _laplacian_var(arr)
    blur_score = max(0.0, min(1.0, (blur_var - 20.0) / (200.0 - 20.0)))
    bright_score = max(0.0, min(1.0, (brightness - 50.0) / (200.0 - 50.0)))
    qc_score = round(0.6 * blur_score + 0.4 * bright_score, 3)

    return {
        "brightness": round(brightness, 2),
        "blur_var": round(blur_var, 2),
        "score": qc_score
    }
