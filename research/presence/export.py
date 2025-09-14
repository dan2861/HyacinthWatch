import argparse, json
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--version", required=True)
    ap.add_argument("--models-dir", default="../models")
    args = ap.parse_args()

    target = Path(args.models_dir) / "presence" / args.version
    target.mkdir(parents=True, exist_ok=True)
    (target / "model.onnx").write_bytes(b"stub onnx")
    (target / "meta.json").write_text(json.dumps({"type":"presence"}, indent=2))
    print(f"[export_presence] wrote {target}")

if __name__ == "__main__":
    main()