from pathlib import Path
from typing import Tuple
import cv2
import numpy as np

class SegDataset:
    def __init__(self, root: str, img_size: Tuple[int, int]=(512, 512)):
        self.root = Path(root)
        self.images = sorted((self.root / "images").glob("*"))
        self.masks = sorted((self.root / "masks").glob("*"))
        self.img_size = img_size
        assert len(self.images) == len(self.masks), "images/masks count mismatch"

    def __len__(self): return len(self.images)

    def __getitem__(self, idx:int):
        img = cv2.imread(str(self.images[idx]))[..., ::-1]  # BGR->RGB
        mask = cv2.imread(str(self.masks[idx]), cv2.IMREAD_GRAYSCALE)
        img = cv2.resize(img, self.img_size)
        mask = cv2.resize(mask, self.img_size, interpolation=cv2.INTER_NEAREST)
        mask = (mask > 127).astype(np.uint8)
        return img, mask