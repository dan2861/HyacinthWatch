import torch
import torch.nn as nn

class TinyUNet(nn.Module):
    # Placeholder; swap with proper UNet/DeepLab implementation or import from your lib
    def __init__(self, in_ch=3, out_ch=1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_ch, 16, 3, padding=1), nn.ReLU(),
            nn.Conv2d(16, 1, 1)
        )
    def forward(self, x): return self.net(x)