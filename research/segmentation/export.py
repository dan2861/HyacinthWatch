import argparse, json
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--version", required=True)
    ap.add_argument("--models-dir", default="../models")
    args = ap.parse_args()

    target = Path(args.models_dir) / "segmentation" / args.version
    target.mkdir(parents=True, exist_ok=True)

    # TODO: convert checkpoint to ONNX/TorchScript and save
    (target / "model.onnx").write_bytes(b"stub onnx")
    meta = {"arch":"unet","input":"RGB 512x512","iou_val":0.0}
    (target / "meta.json").write_text(json.dumps(meta, indent=2))
    print(f"[export_seg] wrote {target}")

if __name__ == "__main__":
    main()