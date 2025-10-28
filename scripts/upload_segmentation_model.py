"""Upload segmentation model artifacts from ./models/segmentation to Supabase.

Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python scripts/upload_segmentation_model.py --version 1.0.1

This script uploads model_meta.json and the first .pt file it finds to the
bucket configured by STORAGE_BUCKET_MODELS (env var). It prints the uploaded
paths on success.
"""
import os
import argparse
import json

from utils import storage


def find_files(base_path):
    meta = os.path.join(base_path, 'model_meta.json')
    weights = None
    for fname in os.listdir(base_path):
        if fname.endswith('.pt') or fname.endswith('.pth'):
            weights = os.path.join(base_path, fname)
            break
    return meta if os.path.exists(meta) else None, weights


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--version', required=True)
    p.add_argument('--bucket', default=os.environ.get('STORAGE_BUCKET_MODELS'))
    args = p.parse_args()

    if not args.bucket:
        raise SystemExit(
            'STORAGE_BUCKET_MODELS env var or --bucket is required')

    repo_root = os.path.dirname(os.path.dirname(__file__))
    model_dir = os.path.join(repo_root, 'models', 'segmentation')
    if args.version:
        model_dir = os.path.join(model_dir, args.version)

    meta_path, weights_path = find_files(model_dir)
    if not meta_path:
        raise SystemExit(f'model_meta.json not found under {model_dir}')
    if not weights_path:
        raise SystemExit(f'no weights (.pt/.pth) found under {model_dir}')

    # Upload files
    bucket = args.bucket
    meta_data = open(meta_path, 'rb').read()
    meta_remote = f'models/segmentation/{args.version}/model_meta.json'
    print('Uploading', meta_path, '->', meta_remote)
    storage.upload_bytes(bucket, meta_remote, meta_data, 'application/json')

    weights_data = open(weights_path, 'rb').read()
    weights_remote = f'models/segmentation/{args.version}/{os.path.basename(weights_path)}'
    print('Uploading', weights_path, '->', weights_remote)
    storage.upload_bytes(bucket, weights_remote,
                         weights_data, 'application/octet-stream')

    print('Uploaded model meta and weights to', bucket)


if __name__ == '__main__':
    main()
