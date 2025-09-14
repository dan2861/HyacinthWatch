.PHONY: install train-seg eval-seg export-seg train-pres export-pres

PY=python

install:
	$(PY) -m pip install -r requirements.txt

train-seg:
	$(PY) segmentation/train_seg.py --config segmentation/configs/example.yaml

eval-seg:
	$(PY) segmentation/eval_seg.py --config segmentation/configs/example.yaml

export-seg:
	$(PY) segmentation/export.py --checkpoint research/outputs/checkpoints/seg_best.ckpt --version v0.1 --models-dir ../models

train-pres:
	$(PY) presence/train_presence.py

export-pres:
	$(PY) presence/export.py --checkpoint research/outputs/checkpoints/pres_best.ckpt --version v0.1 --models-dir ../models