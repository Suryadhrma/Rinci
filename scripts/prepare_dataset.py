"""Unduh N sampel dari CORD-v2 lewat HuggingFace datasets-server API.

Cuma ambil row yang diminta (streaming per-row), BUKAN download seluruh
file parquet split-nya -- biar hemat storage buat kebutuhan sampel kecil.
Sekali jalan, stdlib saja (tanpa dependency tambahan). Hasil disimpan ke
data/cord/<split>/<idx>.jpg + ground_truth.json (isinya gt_parse tiap gambar).

Pakai:
    python scripts/prepare_dataset.py --split test --n 20
"""

import argparse
import json
import urllib.request
from pathlib import Path

API_URL = "https://datasets-server.huggingface.co/rows"
DATASET = "naver-clova-ix/cord-v2"


def fetch_rows(split: str, offset: int, length: int) -> list[dict]:
    url = (
        f"{API_URL}?dataset={DATASET.replace('/', '%2F')}"
        f"&config=default&split={split}&offset={offset}&length={length}"
    )
    with urllib.request.urlopen(url) as resp:
        payload = json.load(resp)
    return payload["rows"]


def download_image(src_url: str, dest: Path) -> None:
    with urllib.request.urlopen(src_url) as resp:
        dest.write_bytes(resp.read())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", default="test", choices=["test", "validation", "train"])
    parser.add_argument("--n", type=int, default=20, help="jumlah sampel yang diunduh")
    parser.add_argument("--offset", type=int, default=0)
    args = parser.parse_args()

    out_dir = Path("data/cord") / args.split
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Ambil {args.n} sampel dari split '{args.split}' (offset {args.offset})...")
    rows = fetch_rows(args.split, args.offset, args.n)

    gt_path = out_dir / "ground_truth.json"
    # Gabung ke ground_truth.json yang sudah ada, jangan ditimpa -- biar
    # script ini bisa dipanggil ulang buat nambah sampel tanpa menghapus
    # yang sudah diunduh sebelumnya.
    ground_truth = json.loads(gt_path.read_text(encoding="utf-8")) if gt_path.exists() else {}
    for entry in rows:
        filename = f"{entry['row_idx']:04d}.jpg"
        row = entry["row"]

        download_image(row["image"]["src"], out_dir / filename)

        gt = json.loads(row["ground_truth"])
        ground_truth[filename] = gt["gt_parse"]

        print(f"  {filename} tersimpan")

    gt_path.write_text(json.dumps(ground_truth, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Selesai. {len(rows)} gambar baru, {len(ground_truth)} total di ground_truth.json ({out_dir}/)")


if __name__ == "__main__":
    main()
