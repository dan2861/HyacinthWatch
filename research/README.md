# Research (Training & Experiments)

This folder holds all **training**, **evaluation**, and **export** code for:
- **segmentation/** (RQ-A robustness)
- **presence/** (presence classifier)

## Workflow
1. Edit configs in `segmentation/configs/` or `presence/configs/` (if added).
2. `make install` to get deps.
3. `make train-seg` / `make eval-seg` / `make export-seg` to produce artifacts.
4. Exported models land in `../models/{segmentation|presence}/vX.Y/` for the backend worker.

> Heavy deps live here; backend only loads exported artifacts.