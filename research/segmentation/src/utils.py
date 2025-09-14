import numpy as np

def iou(pred: np.ndarray, target: np.ndarray, eps: float=1e-7) -> float:
    inter = (pred & target).sum()
    union = (pred | target).sum()
    return (inter + eps) / (union + eps)

def f1(pred: np.ndarray, target: np.ndarray, eps: float=1e-7) -> float:
    tp = (pred & target).sum()
    fp = (pred & ~target).sum()
    fn = (~pred & target).sum()
    return (2*tp + eps) / (2*tp + fp + fn + eps)