import argparse, yaml
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    args = ap.parse_args()
    cfg = yaml.safe_load(open(args.config))
    print("[eval_seg] evaluating with cfg:", cfg)
    # TODO: compute IoU/F1/% cover error; write CSV/plots to research/outputs/metrics
    Path("research/outputs/metrics").mkdir(parents=True, exist_ok=True)
    (Path("research/outputs/metrics") / "seg_metrics.csv").write_text("iou,f1\n0.00,0.00\n")
    print("[eval_seg] wrote metrics CSV")

if __name__ == "__main__":
    main()