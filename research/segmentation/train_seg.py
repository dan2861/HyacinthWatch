import argparse, yaml, os
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    args = ap.parse_args()

    cfg = yaml.safe_load(open(args.config))
    print("[train_seg] loaded config:", cfg)

    # TODO: load datasets from cfg['data'], build model from cfg['model'],
    # train for cfg['train']['epochs'], save best checkpoint:
    out = Path("research/outputs/checkpoints")
    out.mkdir(parents=True, exist_ok=True)
    ckpt_path = out / "seg_best.ckpt"
    with open(ckpt_path, "wb") as f:
        f.write(b"stub checkpoint")
    print(f"[train_seg] wrote {ckpt_path}")

if __name__ == "__main__":
    main()